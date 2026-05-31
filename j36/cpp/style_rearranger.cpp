#include "style_rearranger.h"
#include <sstream>
#include <algorithm>
#include <cstring>
#include <cstdlib>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

namespace ebook_styler {

CSSParser::CSSParser() {}

CSSParser::~CSSParser() {}

std::string CSSParser::trim(const std::string& s) const {
    auto start = s.begin();
    while (start != s.end() && std::isspace(*start)) {
        start++;
    }
    auto end = s.end();
    do {
        end--;
    } while (std::distance(start, end) > 0 && std::isspace(*end));
    return std::string(start, end + 1);
}

void CSSParser::parseRule(const std::string& rule) {
    size_t pos = rule.find('{');
    if (pos == std::string::npos) return;
    
    std::string selector = trim(rule.substr(0, pos));
    std::string properties = trim(rule.substr(pos + 1, rule.find('}') - pos - 1));
    
    rules_[selector] = properties;
}

bool CSSParser::parse(const std::string& css_content) {
    std::string css = css_content;
    size_t pos = 0;
    
    while (pos < css.length()) {
        size_t rule_end = css.find('}', pos);
        if (rule_end == std::string::npos) break;
        
        std::string rule = css.substr(pos, rule_end - pos + 1);
        parseRule(rule);
        
        pos = rule_end + 1;
    }
    
    return true;
}

std::string CSSParser::getRule(const std::string& selector) const {
    auto it = rules_.find(selector);
    if (it != rules_.end()) {
        return it->second;
    }
    return "";
}

std::map<std::string, std::string> CSSParser::getAllRules() const {
    return rules_;
}

std::string CSSParser::generateCSS(const StyleConfig& config) const {
    std::ostringstream css;
    
    css << "body {\n";
    css << "  font-family: " << config.text.font_family << ";\n";
    css << "  font-size: " << config.text.font_size << "px;\n";
    css << "  line-height: " << config.text.line_height << ";\n";
    css << "  color: " << config.text.color << ";\n";
    css << "  background-color: " << config.layout.background_color << ";\n";
    css << "  margin: 0;\n";
    css << "  padding: " << config.layout.margin_top << "px " 
        << config.layout.margin_right << "px "
        << config.layout.margin_bottom << "px "
        << config.layout.margin_left << "px;\n";
    css << "  text-align: " << config.text.text_align << ";\n";
    css << "}\n\n";
    
    css << "p {\n";
    css << "  margin: 0 0 " << config.text.line_height * config.text.font_size * 0.5 << "px 0;\n";
    css << "  text-indent: " << config.text.text_indent << "em;\n";
    css << "  letter-spacing: " << config.text.letter_spacing << "px;\n";
    css << "}\n\n";
    
    for (const auto& [tag, style] : config.heading_styles) {
        css << tag << " {\n";
        css << "  font-family: " << style.font_family << ";\n";
        css << "  font-size: " << style.font_size << "px;\n";
        css << "  font-weight: " << style.font_weight << ";\n";
        css << "  font-style: " << style.font_style << ";\n";
        css << "  line-height: " << style.line_height << ";\n";
        css << "  color: " << style.color << ";\n";
        css << "  text-align: " << style.text_align << ";\n";
        css << "  margin: " << style.line_height * style.font_size << "px 0 " 
            << style.line_height * style.font_size * 0.5 << "px 0;\n";
        css << "}\n\n";
    }
    
    if (config.layout.column_count > 1) {
        css << ".content-wrapper {\n";
        css << "  column-count: " << config.layout.column_count << ";\n";
        css << "  column-gap: " << config.layout.column_gap << "px;\n";
        css << "}\n\n";
    }
    
    css << ".chapter-title {\n";
    css << "  page-break-before: always;\n";
    css << "  break-before: page;\n";
    css << "}\n\n";
    
    css << ".highlight {\n";
    css << "  background-color: #ffff00;\n";
    css << "  padding: 0 2px;\n";
    css << "  border-radius: 2px;\n";
    css << "}\n\n";
    
    css << ".toc {\n";
    css << "  margin-bottom: 2em;\n";
    css << "  padding-bottom: 1em;\n";
    css << "  border-bottom: 1px solid #ccc;\n";
    css << "}\n\n";
    
    css << ".toc ul {\n";
    css << "  list-style-type: none;\n";
    css << "  padding-left: 1em;\n";
    css << "}\n\n";
    
    css << ".toc li {\n";
    css << "  margin-bottom: 0.5em;\n";
    css << "}\n\n";
    
    css << ".toc a {\n";
    css << "  text-decoration: none;\n";
    css << "  color: inherit;\n";
    css << "}\n\n";
    
    css << ".toc a:hover {\n";
    css << "  text-decoration: underline;\n";
    css << "}\n\n";
    
    if (!config.custom_css.empty()) {
        css << "/* Custom CSS */\n";
        css << config.custom_css << "\n";
    }
    
    return css.str();
}

StyleRearranger::StyleRearranger() {}

StyleRearranger::~StyleRearranger() {}

std::string StyleRearranger::escapeHtml(const std::string& input) {
    std::string output;
    output.reserve(input.length());
    
    for (char c : input) {
        switch (c) {
            case '&':  output.append("&amp;"); break;
            case '\"': output.append("&quot;"); break;
            case '\'': output.append("&#39;"); break;
            case '<':  output.append("&lt;"); break;
            case '>':  output.append("&gt;"); break;
            default:   output.push_back(c); break;
        }
    }
    
    return output;
}

std::string StyleRearranger::applyTextStyle(const TextStyle& style) {
    std::ostringstream css;
    
    css << "font-family: " << style.font_family << "; ";
    css << "font-size: " << style.font_size << "px; ";
    css << "font-weight: " << style.font_weight << "; ";
    css << "font-style: " << style.font_style << "; ";
    css << "color: " << style.color << "; ";
    css << "line-height: " << style.line_height << "; ";
    css << "text-align: " << style.text_align << "; ";
    css << "letter-spacing: " << style.letter_spacing << "px;";
    
    return css.str();
}

std::string StyleRearranger::getElementCSS(const std::string& element_type, const StyleConfig& config) {
    auto it = config.heading_styles.find(element_type);
    if (it != config.heading_styles.end()) {
        return applyTextStyle(it->second);
    }
    return applyTextStyle(config.text);
}

bool StyleRearranger::isHeading(const std::string& element_type) {
    return element_type.length() == 2 && 
           element_type[0] == 'h' && 
           element_type[1] >= '1' && element_type[1] <= '6';
}

std::string StyleRearranger::generateAnchorId(const std::string& chapter_id, const std::string& element_id) {
    return "ch_" + chapter_id.substr(0, 8) + "_el_" + element_id.substr(0, 8);
}

std::string StyleRearranger::renderElement(
    const ContentElement& element,
    const StyleConfig& config,
    int depth
) {
    std::ostringstream html;
    
    if (!element.raw_html.empty()) {
        return element.raw_html;
    }
    
    std::string tag = element.element_type;
    if (tag.empty()) tag = "div";
    
    if (tag == "text") {
        return escapeHtml(element.content);
    }
    
    if (tag == "table") {
        html << "<div class=\"table-wrapper\" style=\"overflow-x: auto; margin: 1.5em 0;\">";
        html << "<table style=\"border-collapse: collapse; width: 100%; margin: 1em 0; font-family: " 
             << config.text.font_family << "; font-size: " << config.text.font_size * 0.9 << "px;\">";
        
        if (!element.content.empty()) {
            html << escapeHtml(element.content);
        }
        
        for (const auto& child : element.children) {
            html << renderElement(child, config, depth + 1);
        }
        
        html << "</table></div>";
        return html.str();
    }
    
    if (tag == "math") {
        html << "<div class=\"formula\" style=\"";
        html << "text-align: center; ";
        html << "margin: 1.5em 0; ";
        html << "padding: 1em; ";
        html << "background-color: #f8f9fa; ";
        html << "border-radius: 8px; ";
        html << "border-left: 4px solid #3b82f6; ";
        html << "font-family: 'Latin Modern Math', 'Cambria Math', 'Times New Roman', serif; ";
        html << "font-size: " << config.text.font_size * 1.1 << "px; ";
        html << "line-height: 1.6; ";
        html << "white-space: pre-wrap; ";
        html << "overflow-x: auto;";
        html << "\">";
        html << escapeHtml(element.content);
        html << "</div>";
        return html.str();
    }
    
    if (tag == "tr" || tag == "th" || tag == "td") {
        html << "<" << tag;
        if (tag == "th") {
            html << " style=\"background-color: #e2e8f0; font-weight: bold; padding: 12px; text-align: left; border: 1px solid #cbd5e1;\">";
        } else if (tag == "td") {
            html << " style=\"padding: 12px; border: 1px solid #cbd5e1;\">";
        } else {
            html << ">";
        }
        
        if (!element.content.empty()) {
            html << escapeHtml(element.content);
        }
        
        for (const auto& child : element.children) {
            html << renderElement(child, config, depth + 1);
        }
        
        html << "</" << tag << ">";
        return html.str();
    }
    
    html << "<" << tag;
    
    std::string anchor_id;
    if (isHeading(tag)) {
        anchor_id = generateAnchorId("current", element.id);
        html << " id=\"" << anchor_id << "\"";
        if (depth == 0) {
            html << " class=\"chapter-title\"";
        }
    }
    
    html << " style=\"" << getElementCSS(tag, config) << "\"";
    
    for (const auto& [key, value] : element.attributes) {
        if (key != "style") {
            html << " " << key << "=\"" << escapeHtml(value) << "\"";
        }
    }
    
    html << ">";
    
    if (!element.content.empty()) {
        html << escapeHtml(element.content);
    }
    
    for (const auto& child : element.children) {
        html << renderElement(child, config, depth + 1);
    }
    
    html << "</" << tag << ">";
    
    return html.str();
}

std::string StyleRearranger::generateTableOfContents(const std::vector<BookChapter>& chapters) {
    std::ostringstream toc;
    
    toc << "<nav class=\"toc\" role=\"navigation\" aria-label=\"Table of Contents\">\n";
    toc << "  <h2 style=\"text-align: center; margin-bottom: 1em;\">目录</h2>\n";
    toc << "  <ul>\n";
    
    for (const auto& chapter : chapters) {
        std::string chapter_anchor = "ch_" + chapter.id.substr(0, 8);
        toc << "    <li><a href=\"#" << chapter_anchor << "\">" 
            << escapeHtml(chapter.title) << "</a></li>\n";
    }
    
    toc << "  </ul>\n";
    toc << "</nav>\n";
    
    return toc.str();
}

std::string StyleRearranger::extractSearchableText(const std::vector<BookChapter>& chapters) {
    std::ostringstream text;
    
    for (const auto& chapter : chapters) {
        text << chapter.title << "\n";
        
        for (const auto& element : chapter.elements) {
            if (!element.content.empty()) {
                text << element.content << "\n";
            }
            
            for (const auto& child : element.children) {
                if (!child.content.empty()) {
                    text << child.content << "\n";
                }
            }
        }
    }
    
    return text.str();
}

std::vector<std::pair<std::string, std::string>> StyleRearranger::buildNavigation(
    const std::vector<BookChapter>& chapters
) {
    std::vector<std::pair<std::string, std::string>> nav;
    
    for (const auto& chapter : chapters) {
        std::string anchor = "ch_" + chapter.id.substr(0, 8);
        nav.push_back({chapter.title, anchor});
    }
    
    return nav;
}

RearrangedResult StyleRearranger::rearrange(
    const std::vector<BookChapter>& chapters,
    const StyleConfig& config,
    const std::vector<std::string>& original_css
) {
    RearrangedResult result;
    
    for (const auto& css : original_css) {
        css_parser_.parse(css);
    }
    
    std::ostringstream html;
    
    html << "<!DOCTYPE html>\n";
    html << "<html lang=\"zh-CN\">\n";
    html << "<head>\n";
    html << "  <meta charset=\"UTF-8\">\n";
    html << "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
    html << "  <title>重排版电子书</title>\n";
    html << "  <style>\n";
    html << css_parser_.generateCSS(config);
    html << "  </style>\n";
    html << "</head>\n";
    html << "<body>\n";
    
    html << generateTableOfContents(chapters);
    
    html << "<div class=\"content-wrapper\">\n";
    
    for (const auto& chapter : chapters) {
        std::string chapter_anchor = "ch_" + chapter.id.substr(0, 8);
        html << "  <section id=\"" << chapter_anchor << "\" class=\"chapter\">\n";
        html << "    <h1 class=\"chapter-title\" style=\"" 
             << getElementCSS("h1", config) << "\">" 
             << escapeHtml(chapter.title) << "</h1>\n";
        
        for (const auto& element : chapter.elements) {
            html << "    " << renderElement(element, config) << "\n";
        }
        
        html << "  </section>\n";
    }
    
    html << "</div>\n";
    
    html << "</body>\n";
    html << "</html>\n";
    
    result.html_content = html.str();
    result.css_content = css_parser_.generateCSS(config);
    result.searchable_text = extractSearchableText(chapters);
    result.chapter_navigation = buildNavigation(chapters);
    
    return result;
}

}

using namespace ebook_styler;

extern "C" {

void* style_rearranger_create() {
    return static_cast<void*>(new StyleRearranger());
}

void style_rearranger_destroy(void* rearranger) {
    if (rearranger) {
        delete static_cast<StyleRearranger*>(rearranger);
    }
}

void* style_config_create() {
    StyleConfig* config = new StyleConfig();
    
    config->text.font_family = "Georgia, serif";
    config->text.font_size = 16.0f;
    config->text.font_weight = "normal";
    config->text.font_style = "normal";
    config->text.color = "#000000";
    config->text.text_align = "justify";
    config->text.line_height = 1.8f;
    config->text.letter_spacing = 0.0f;
    config->text.text_indent = 2.0f;
    
    config->layout.page_width = 0.0f;
    config->layout.page_height = 0.0f;
    config->layout.margin_top = 40.0f;
    config->layout.margin_bottom = 40.0f;
    config->layout.margin_left = 50.0f;
    config->layout.margin_right = 50.0f;
    config->layout.background_color = "#ffffff";
    config->layout.column_count = 1;
    config->layout.column_gap = 20.0f;
    
    TextStyle h1 = config->text;
    h1.font_size = 28.0f;
    h1.font_weight = "bold";
    h1.line_height = 1.4f;
    config->heading_styles["h1"] = h1;
    
    TextStyle h2 = config->text;
    h2.font_size = 24.0f;
    h2.font_weight = "bold";
    h2.line_height = 1.4f;
    config->heading_styles["h2"] = h2;
    
    TextStyle h3 = config->text;
    h3.font_size = 20.0f;
    h3.font_weight = "bold";
    h3.line_height = 1.4f;
    config->heading_styles["h3"] = h3;
    
    return static_cast<void*>(config);
}

void style_config_destroy(void* config) {
    if (config) {
        delete static_cast<StyleConfig*>(config);
    }
}

void style_config_set_text_font(void* config, const char* font_family) {
    if (config && font_family) {
        static_cast<StyleConfig*>(config)->text.font_family = font_family;
    }
}

void style_config_set_text_size(void* config, float font_size) {
    if (config) {
        static_cast<StyleConfig*>(config)->text.font_size = font_size;
    }
}

void style_config_set_text_color(void* config, const char* color) {
    if (config && color) {
        static_cast<StyleConfig*>(config)->text.color = color;
    }
}

void style_config_set_line_height(void* config, float line_height) {
    if (config) {
        static_cast<StyleConfig*>(config)->text.line_height = line_height;
    }
}

void style_config_set_text_align(void* config, const char* text_align) {
    if (config && text_align) {
        static_cast<StyleConfig*>(config)->text.text_align = text_align;
    }
}

void style_config_set_margins(void* config, float top, float bottom, float left, float right) {
    if (config) {
        LayoutStyle& layout = static_cast<StyleConfig*>(config)->layout;
        layout.margin_top = top;
        layout.margin_bottom = bottom;
        layout.margin_left = left;
        layout.margin_right = right;
    }
}

void style_config_set_background_color(void* config, const char* color) {
    if (config && color) {
        static_cast<StyleConfig*>(config)->layout.background_color = color;
    }
}

void style_config_set_columns(void* config, int count, float gap) {
    if (config) {
        LayoutStyle& layout = static_cast<StyleConfig*>(config)->layout;
        layout.column_count = count;
        layout.column_gap = gap;
    }
}

void style_config_set_custom_css(void* config, const char* css) {
    if (config && css) {
        static_cast<StyleConfig*>(config)->custom_css = css;
    }
}

ContentElement parse_element_json(const json& j) {
    ContentElement elem;
    
    if (j.contains("id")) {
        elem.id = j["id"].get<std::string>();
    }
    if (j.contains("element_type")) {
        elem.element_type = j["element_type"].get<std::string>();
    }
    if (j.contains("content")) {
        elem.content = j["content"].get<std::string>();
    }
    if (j.contains("attributes")) {
        elem.attributes = j["attributes"].get<std::map<std::string, std::string>>();
    }
    if (j.contains("children")) {
        for (const auto& child : j["children"]) {
            elem.children.push_back(parse_element_json(child));
        }
    }
    if (j.contains("raw_html") && !j["raw_html"].is_null()) {
        elem.raw_html = j["raw_html"].get<std::string>();
    }
    
    return elem;
}

BookChapter parse_chapter_json(const json& j) {
    BookChapter chapter;
    
    if (j.contains("id")) {
        chapter.id = j["id"].get<std::string>();
    }
    if (j.contains("title")) {
        chapter.title = j["title"].get<std::string>();
    }
    if (j.contains("order")) {
        chapter.order = j["order"].get<uint32_t>();
    }
    if (j.contains("raw_html")) {
        chapter.raw_html = j["raw_html"].get<std::string>();
    }
    if (j.contains("elements")) {
        for (const auto& elem_j : j["elements"]) {
            chapter.elements.push_back(parse_element_json(elem_j));
        }
    }
    
    return chapter;
}

char* rearrange_book(
    void* rearranger,
    const char* chapters_json,
    void* style_config,
    const char* original_css_json
) {
    if (!rearranger || !chapters_json || !style_config) {
        return nullptr;
    }
    
    StyleRearranger* r = static_cast<StyleRearranger*>(rearranger);
    StyleConfig* config = static_cast<StyleConfig*>(style_config);
    
    std::vector<BookChapter> chapters;
    
    try {
        json j_chapters = json::parse(chapters_json);
        for (const auto& chapter_j : j_chapters) {
            chapters.push_back(parse_chapter_json(chapter_j));
        }
    } catch (const std::exception& e) {
        std::string error = "{\"error\": \"Failed to parse chapters JSON: " + std::string(e.what()) + "\"}";
        char* result = static_cast<char*>(std::malloc(error.length() + 1));
        std::strcpy(result, error.c_str());
        return result;
    }
    
    std::vector<std::string> original_css;
    if (original_css_json) {
        try {
            json j_css = json::parse(original_css_json);
            if (j_css.is_array()) {
                for (const auto& css : j_css) {
                    original_css.push_back(css.get<std::string>());
                }
            }
        } catch (...) {
        }
    }
    
    RearrangedResult result = r->rearrange(chapters, *config, original_css);
    
    json j_result;
    j_result["html_content"] = result.html_content;
    j_result["css_content"] = result.css_content;
    j_result["searchable_text"] = result.searchable_text;
    
    json j_nav = json::array();
    for (const auto& nav : result.chapter_navigation) {
        json j_pair = json::array();
        j_pair.push_back(nav.first);
        j_pair.push_back(nav.second);
        j_nav.push_back(j_pair);
    }
    j_result["chapter_navigation"] = j_nav;
    
    std::string json_str = j_result.dump();
    
    char* c_str = static_cast<char*>(std::malloc(json_str.length() + 1));
    std::strcpy(c_str, json_str.c_str());
    
    return c_str;
}

void free_string(char* str) {
    if (str) {
        std::free(str);
    }
}

}
