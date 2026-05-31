#ifndef STYLE_REARRANGER_H
#define STYLE_REARRANGER_H

#include <string>
#include <vector>
#include <map>
#include <memory>

namespace ebook_styler {

struct TextStyle {
    std::string font_family;
    float font_size;
    std::string font_weight;
    std::string font_style;
    std::string color;
    std::string text_align;
    float line_height;
    float letter_spacing;
    float text_indent;
};

struct LayoutStyle {
    float page_width;
    float page_height;
    float margin_top;
    float margin_bottom;
    float margin_left;
    float margin_right;
    std::string background_color;
    int column_count;
    float column_gap;
};

struct StyleConfig {
    TextStyle text;
    LayoutStyle layout;
    std::map<std::string, TextStyle> heading_styles;
    std::string custom_css;
};

struct ContentElement {
    std::string id;
    std::string element_type;
    std::string content;
    std::shared_ptr<TextStyle> style;
    std::map<std::string, std::string> attributes;
    std::vector<ContentElement> children;
    std::string raw_html;
};

struct BookChapter {
    std::string id;
    std::string title;
    uint32_t order;
    std::vector<ContentElement> elements;
    std::string raw_html;
};

struct RearrangedResult {
    std::string html_content;
    std::string css_content;
    std::string searchable_text;
    std::vector<std::pair<std::string, std::string>> chapter_navigation;
};

class CSSParser {
public:
    CSSParser();
    ~CSSParser();
    
    bool parse(const std::string& css_content);
    std::string getRule(const std::string& selector) const;
    std::map<std::string, std::string> getAllRules() const;
    std::string generateCSS(const StyleConfig& config) const;
    
private:
    std::map<std::string, std::string> rules_;
    
    void parseRule(const std::string& rule);
    std::string trim(const std::string& s) const;
};

class StyleRearranger {
public:
    StyleRearranger();
    ~StyleRearranger();
    
    RearrangedResult rearrange(
        const std::vector<BookChapter>& chapters,
        const StyleConfig& config,
        const std::vector<std::string>& original_css
    );
    
    std::string renderElement(
        const ContentElement& element,
        const StyleConfig& config,
        int depth = 0
    );
    
    std::string escapeHtml(const std::string& input);
    
private:
    CSSParser css_parser_;
    
    std::string generateDocumentCSS(const StyleConfig& config);
    std::string applyTextStyle(const TextStyle& style);
    std::string getElementCSS(const std::string& element_type, const StyleConfig& config);
    std::string generateTableOfContents(const std::vector<BookChapter>& chapters);
    std::string extractSearchableText(const std::vector<BookChapter>& chapters);
    std::vector<std::pair<std::string, std::string>> buildNavigation(
        const std::vector<BookChapter>& chapters
    );
    
    bool isHeading(const std::string& element_type);
    std::string generateAnchorId(const std::string& chapter_id, const std::string& element_id);
};

}

extern "C" {
    void* style_rearranger_create();
    void style_rearranger_destroy(void* rearranger);
    
    void* style_config_create();
    void style_config_destroy(void* config);
    
    void style_config_set_text_font(void* config, const char* font_family);
    void style_config_set_text_size(void* config, float font_size);
    void style_config_set_text_color(void* config, const char* color);
    void style_config_set_line_height(void* config, float line_height);
    void style_config_set_text_align(void* config, const char* text_align);
    void style_config_set_margins(void* config, float top, float bottom, float left, float right);
    void style_config_set_background_color(void* config, const char* color);
    void style_config_set_columns(void* config, int count, float gap);
    void style_config_set_custom_css(void* config, const char* css);
    
    char* rearrange_book(
        void* rearranger,
        const char* chapters_json,
        void* style_config,
        const char* original_css_json
    );
    
    void free_string(char* str);
}

#endif
