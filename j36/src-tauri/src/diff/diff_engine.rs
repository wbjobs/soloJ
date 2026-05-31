use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{info, debug};
use crate::types::*;
use crate::AppResult;

pub struct DiffEngine {
    config: DiffConfig,
}

impl DiffEngine {
    pub fn new(config: DiffConfig) -> Self {
        DiffEngine { config }
    }

    pub fn compare_books(
        &self,
        old_book: &ParsedBook,
        new_book: &ParsedBook,
        old_version_label: &str,
        new_version_label: &str,
    ) -> AppResult<DiffReport> {
        info!(
            "Comparing books: {} vs {}",
            old_book.metadata.title, new_book.metadata.title
        );

        let old_version_id = uuid::Uuid::new_v4().to_string();
        let new_version_id = uuid::Uuid::new_v4().to_string();

        let old_chapters_map: HashMap<&str, &BookChapter> = old_book
            .chapters
            .iter()
            .map(|c| (c.title.as_str(), c))
            .collect();

        let new_chapters_map: HashMap<&str, &BookChapter> = new_book
            .chapters
            .iter()
            .map(|c| (c.title.as_str(), c))
            .collect();

        let mut chapter_diffs = Vec::new();
        let mut total_added = 0u32;
        let mut total_removed = 0u32;
        let mut total_modified = 0u32;
        let mut total_similarity = 0f32;

        let all_titles: Vec<&str> = old_chapters_map
            .keys()
            .chain(new_chapters_map.keys())
            .copied()
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        for title in all_titles {
            match (old_chapters_map.get(title), new_chapters_map.get(title)) {
                (Some(old_chapter), Some(new_chapter)) => {
                    let chapter_diff = self.compare_chapters(old_chapter, new_chapter);
                    
                    if chapter_diff.has_changes {
                        for segment in &chapter_diff.segments {
                            match segment.diff_type {
                                DiffType::Added => total_added += 1,
                                DiffType::Removed => total_removed += 1,
                                DiffType::Modified => total_modified += 1,
                                _ => {}
                            }
                        }
                    }
                    
                    total_similarity += chapter_diff.similarity_score;
                    chapter_diffs.push(chapter_diff);
                }
                (Some(old_chapter), None) => {
                    let chapter_diff = self.create_deleted_chapter_diff(old_chapter);
                    total_removed += 1;
                    chapter_diffs.push(chapter_diff);
                }
                (None, Some(new_chapter)) => {
                    let chapter_diff = self.create_added_chapter_diff(new_chapter);
                    total_added += 1;
                    chapter_diffs.push(chapter_diff);
                }
            }
        }

        let overall_similarity = if !chapter_diffs.is_empty() {
            total_similarity / chapter_diffs.len() as f32
        } else {
            1.0
        };

        let mut report = DiffReport {
            old_version_id,
            new_version_id,
            old_version_label: old_version_label.to_string(),
            new_version_label: new_version_label.to_string(),
            chapter_diffs,
            total_added,
            total_removed,
            total_modified,
            overall_similarity,
            generated_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            html_report: None,
        };

        let html = self.generate_html_report(&report)?;
        report.html_report = Some(html);

        debug!(
            "Diff complete: {} added, {} removed, {} modified, similarity: {:.2}%",
            total_added,
            total_removed,
            total_modified,
            overall_similarity * 100.0
        );

        Ok(report)
    }

    fn compare_chapters(&self, old_chapter: &BookChapter, new_chapter: &BookChapter) -> ChapterDiff {
        let old_text = self.extract_chapter_text(old_chapter);
        let new_text = self.extract_chapter_text(new_chapter);

        let segments = self.compute_diff(&old_text, &new_text);
        let has_changes = segments.iter().any(|s| !matches!(s.diff_type, DiffType::Unchanged));
        let similarity_score = self.calculate_similarity(&old_text, &new_text);

        ChapterDiff {
            chapter_id: old_chapter.id.clone(),
            chapter_title: old_chapter.title.clone(),
            segments,
            has_changes,
            similarity_score,
        }
    }

    fn create_deleted_chapter_diff(&self, chapter: &BookChapter) -> ChapterDiff {
        let text = self.extract_chapter_text(chapter);
        
        ChapterDiff {
            chapter_id: chapter.id.clone(),
            chapter_title: format!("[已删除] {}", chapter.title),
            segments: vec![DiffSegment {
                diff_type: DiffType::Removed,
                content: text,
                old_start: 0,
                old_end: text.chars().count() as u32,
                new_start: 0,
                new_end: 0,
            }],
            has_changes: true,
            similarity_score: 0.0,
        }
    }

    fn create_added_chapter_diff(&self, chapter: &BookChapter) -> ChapterDiff {
        let text = self.extract_chapter_text(chapter);
        
        ChapterDiff {
            chapter_id: chapter.id.clone(),
            chapter_title: format!("[新增] {}", chapter.title),
            segments: vec![DiffSegment {
                diff_type: DiffType::Added,
                content: text,
                old_start: 0,
                old_end: 0,
                new_start: 0,
                new_end: text.chars().count() as u32,
            }],
            has_changes: true,
            similarity_score: 0.0,
        }
    }

    fn extract_chapter_text(&self, chapter: &BookChapter) -> String {
        let mut text = String::new();
        self.extract_element_text(&chapter.elements, &mut text);
        text
    }

    fn extract_element_text(&self, elements: &[ContentElement], text: &mut String) {
        for element in elements {
            if !element.content.is_empty() {
                text.push_str(&element.content);
                text.push('\n');
            }
            self.extract_element_text(&element.children, text);
        }
    }

    fn compute_diff(&self, old_text: &str, new_text: &str) -> Vec<DiffSegment> {
        let mut segments = Vec::new();
        
        let old_sentences = self.split_into_sentences(old_text);
        let new_sentences = self.split_into_sentences(new_text);

        debug!(
            "Computing diff: {} old sentences vs {} new sentences",
            old_sentences.len(),
            new_sentences.len()
        );

        let diff = self.lcs_diff(&old_sentences, &new_sentences);

        let mut old_pos = 0u32;
        let mut new_pos = 0u32;

        for item in diff {
            match item {
                DiffItem::Common(sentence) => {
                    let len = sentence.chars().count() as u32;
                    segments.push(DiffSegment {
                        diff_type: DiffType::Unchanged,
                        content: sentence,
                        old_start: old_pos,
                        old_end: old_pos + len,
                        new_start: new_pos,
                        new_end: new_pos + len,
                    });
                    old_pos += len;
                    new_pos += len;
                }
                DiffItem::Added(sentence) => {
                    let len = sentence.chars().count() as u32;
                    segments.push(DiffSegment {
                        diff_type: DiffType::Added,
                        content: sentence,
                        old_start: old_pos,
                        old_end: old_pos,
                        new_start: new_pos,
                        new_end: new_pos + len,
                    });
                    new_pos += len;
                }
                DiffItem::Removed(sentence) => {
                    let len = sentence.chars().count() as u32;
                    segments.push(DiffSegment {
                        diff_type: DiffType::Removed,
                        content: sentence,
                        old_start: old_pos,
                        old_end: old_pos + len,
                        new_start: new_pos,
                        new_end: new_pos,
                    });
                    old_pos += len;
                }
            }
        }

        self.merge_segments(segments)
    }

    fn split_into_sentences(&self, text: &str) -> Vec<String> {
        let mut sentences = Vec::new();
        let mut current = String::new();

        let separators = ['。', '！', '？', '；', '\n', '.', '!', '?', ';'];

        for c in text.chars() {
            current.push(c);
            
            if separators.contains(&c) {
                let trimmed = current.trim();
                if trimmed.chars().count() >= self.config.min_diff_length as usize {
                    sentences.push(trimmed.to_string());
                }
                current.clear();
            }
        }

        if !current.trim().is_empty() {
            sentences.push(current.trim().to_string());
        }

        sentences
    }

    fn lcs_diff(&self, old: &[String], new: &[String]) -> Vec<DiffItem> {
        let m = old.len();
        let n = new.len();
        
        let mut dp = vec![vec![0u32; n + 1]; m + 1];
        
        for i in 1..=m {
            for j in 1..=n {
                if self.sentences_equal(&old[i - 1], &new[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = dp[i - 1][j].max(dp[i][j - 1]);
                }
            }
        }

        let mut result = Vec::new();
        let mut i = m;
        let mut j = n;

        while i > 0 || j > 0 {
            if i > 0 && j > 0 && self.sentences_equal(&old[i - 1], &new[j - 1]) {
                result.push(DiffItem::Common(old[i - 1].clone()));
                i -= 1;
                j -= 1;
            } else if j > 0 && (i == 0 || dp[i][j - 1] >= dp[i - 1][j]) {
                result.push(DiffItem::Added(new[j - 1].clone()));
                j -= 1;
            } else {
                result.push(DiffItem::Removed(old[i - 1].clone()));
                i -= 1;
            }
        }

        result.reverse();
        result
    }

    fn sentences_equal(&self, a: &str, b: &str) -> bool {
        let a = if self.config.ignore_whitespace {
            a.replace(|c: char| c.is_whitespace(), "")
        } else {
            a.to_string()
        };
        
        let b = if self.config.ignore_whitespace {
            b.replace(|c: char| c.is_whitespace(), "")
        } else {
            b.to_string()
        };

        if self.config.ignore_case {
            a.to_lowercase() == b.to_lowercase()
        } else {
            a == b
        }
    }

    fn calculate_similarity(&self, old_text: &str, new_text: &str) -> f32 {
        if old_text.is_empty() && new_text.is_empty() {
            return 1.0;
        }
        if old_text.is_empty() || new_text.is_empty() {
            return 0.0;
        }

        let distance = self.levenshtein_distance(old_text, new_text);
        let max_len = old_text.chars().count().max(new_text.chars().count()) as f32;

        1.0 - (distance as f32 / max_len)
    }

    fn levenshtein_distance(&self, a: &str, b: &str) -> u32 {
        let a_chars: Vec<char> = a.chars().collect();
        let b_chars: Vec<char> = b.chars().collect();
        
        let m = a_chars.len();
        let n = b_chars.len();
        
        let mut dp = vec![vec![0u32; n + 1]; m + 1];
        
        for i in 0..=m {
            dp[i][0] = i as u32;
        }
        for j in 0..=n {
            dp[0][j] = j as u32;
        }
        
        for i in 1..=m {
            for j in 1..=n {
                if a_chars[i - 1] == b_chars[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = dp[i - 1][j]
                        .min(dp[i][j - 1])
                        .min(dp[i - 1][j - 1])
                        + 1;
                }
            }
        }
        
        dp[m][n]
    }

    fn merge_segments(&self, segments: Vec<DiffSegment>) -> Vec<DiffSegment> {
        if segments.is_empty() {
            return segments;
        }

        let mut merged = Vec::new();
        let mut current = segments[0].clone();

        for segment in segments.into_iter().skip(1) {
            if current.diff_type == segment.diff_type
                && current.content.chars().count() < 500
            {
                current.content.push_str(&segment.content);
                current.old_end = segment.old_end;
                current.new_end = segment.new_end;
            } else {
                merged.push(current);
                current = segment;
            }
        }

        merged.push(current);
        merged
    }

    fn generate_html_report(&self, report: &DiffReport) -> AppResult<String> {
        let mut html = String::new();

        html.push_str(&format!(
            r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>版本对比报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            margin: 0 0 15px 0;
            font-size: 28px;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-top: 20px;
        }}
        .stat-card {{
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 32px;
            font-weight: bold;
        }}
        .stat-label {{
            font-size: 14px;
            opacity: 0.9;
        }}
        .chapter {{
            background: #fff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }}
        .chapter-header {{
            background: #f5f5f5;
            padding: 15px 20px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .chapter-title {{
            font-weight: 600;
            font-size: 18px;
        }}
        .similarity {{
            font-size: 14px;
            color: #666;
        }}
        .segments {{
            padding: 20px;
        }}
        .segment {{
            padding: 12px 15px;
            margin: 8px 0;
            border-radius: 6px;
            border-left: 4px solid transparent;
        }}
        .segment-added {{
            background: #e6f4ea;
            border-left-color: #137333;
        }}
        .segment-removed {{
            background: #fce8e6;
            border-left-color: #c5221f;
            text-decoration: line-through;
            opacity: 0.7;
        }}
        .segment-unchanged {{
            background: #f8f9fa;
            border-left-color: #dadce0;
            color: #5f6368;
        }}
        .segment-label {{
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            margin-bottom: 5px;
        }}
        .added-label {{ color: #137333; }}
        .removed-label {{ color: #c5221f; }}
        .unchanged-label {{ color: #5f6368; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📚 电子书版本对比报告</h1>
        <p><strong>旧版本</strong>: {} → <strong>新版本</strong>: {}</p>
        <p>生成时间: {}</p>
        <div class="stats">
            <div class="stat-card">
                <div class="stat-value" style="color: #137333;">{}</div>
                <div class="stat-label">新增段落</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #c5221f;">{}</div>
                <div class="stat-label">删除段落</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #f9ab00;">{}</div>
                <div class="stat-label">修改段落</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{:.1}%</div>
                <div class="stat-label">整体相似度</div>
            </div>
        </div>
    </div>
"#,
            report.old_version_label,
            report.new_version_label,
            {
                let datetime = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(report.generated_at);
                format!("{:?}", datetime)
            },
            report.total_added,
            report.total_removed,
            report.total_modified,
            report.overall_similarity * 100.0
        ));

        for chapter_diff in &report.chapter_diffs {
            html.push_str(&format!(
                r#"    <div class="chapter">
        <div class="chapter-header">
            <span class="chapter-title">{}</span>
            <span class="similarity">相似度: {:.1}%</span>
        </div>
        <div class="segments">
"#,
                chapter_diff.chapter_title,
                chapter_diff.similarity_score * 100.0
            ));

            for segment in &chapter_diff.segments {
                let (class, label) = match segment.diff_type {
                    DiffType::Added => ("segment-added", "新增"),
                    DiffType::Removed => ("segment-removed", "删除"),
                    DiffType::Modified => ("segment-added", "修改"),
                    DiffType::Unchanged => ("segment-unchanged", "未变"),
                };
                
                let label_class = match segment.diff_type {
                    DiffType::Added => "added-label",
                    DiffType::Removed => "removed-label",
                    DiffType::Modified => "added-label",
                    DiffType::Unchanged => "unchanged-label",
                };

                html.push_str(&format!(
                    r#"            <div class="segment {}">
                <div class="segment-label {}">{}</div>
                <div class="segment-content">{}</div>
            </div>
"#,
                    class,
                    label_class,
                    label,
                    self.escape_html(&segment.content).replace('\n', "<br>")
                ));
            }

            html.push_str("        </div>\n    </div>\n");
        }

        html.push_str(
            r#"</body>
</html>
"#,
        );

        Ok(html)
    }

    fn escape_html(&self, text: &str) -> String {
        text.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&#39;")
    }
}

enum DiffItem {
    Common(String),
    Added(String),
    Removed(String),
}
