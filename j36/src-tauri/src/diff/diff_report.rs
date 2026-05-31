use crate::types::*;
use crate::AppResult;

pub struct DiffReportGenerator;

impl DiffReportGenerator {
    pub fn new() -> Self {
        DiffReportGenerator
    }

    pub fn generate_markdown_report(&self, report: &DiffReport) -> AppResult<String> {
        let mut markdown = String::new();

        markdown.push_str(&format!("# 电子书版本对比报告\n\n"));
        markdown.push_str(&format!(
            "**旧版本**: {}\n\n",
            report.old_version_label
        ));
        markdown.push_str(&format!(
            "**新版本**: {}\n\n",
            report.new_version_label
        ));
        markdown.push_str(&format!("**生成时间**: {}\n\n", report.generated_at));
        markdown.push_str("---\n\n");

        markdown.push_str("## 统计摘要\n\n");
        markdown.push_str(&format!("- **新增段落**: {}\n", report.total_added));
        markdown.push_str(&format!("- **删除段落**: {}\n", report.total_removed));
        markdown.push_str(&format!("- **修改段落**: {}\n", report.total_modified));
        markdown.push_str(&format!(
            "- **整体相似度**: {:.1}%\n\n",
            report.overall_similarity * 100.0
        ));

        markdown.push_str("---\n\n");

        for chapter_diff in &report.chapter_diffs {
            if !chapter_diff.has_changes {
                continue;
            }

            markdown.push_str(&format!(
                "## {} (相似度: {:.1}%)\n\n",
                chapter_diff.chapter_title,
                chapter_diff.similarity_score * 100.0
            ));

            for segment in &chapter_diff.segments {
                match segment.diff_type {
                    DiffType::Added => {
                        markdown.push_str(&format!(
                            "### ✅ 新增\n\n{}\n\n",
                            segment.content
                        ));
                    }
                    DiffType::Removed => {
                        markdown.push_str(&format!(
                            "### ❌ 删除\n\n~~{}~~\n\n",
                            segment.content
                        ));
                    }
                    DiffType::Modified => {
                        markdown.push_str(&format!(
                            "### ⚠️ 修改\n\n{}\n\n",
                            segment.content
                        ));
                    }
                    DiffType::Unchanged => {}
                }
            }

            markdown.push_str("---\n\n");
        }

        Ok(markdown)
    }

    pub fn save_report(&self, content: &str, output_path: &std::path::PathBuf) -> AppResult<()> {
        std::fs::write(output_path, content)?;
        Ok(())
    }
}

impl Default for DiffReportGenerator {
    fn default() -> Self {
        Self::new()
    }
}
