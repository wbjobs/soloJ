package main

import (
	"strings"
	"time"
	"unicode"

	"github.com/fcnet/func-compute/types"
)

type WordCountFunction struct{}

var Function types.PluginFunction = &WordCountFunction{}

func (w *WordCountFunction) GetSpec() types.FunctionSpec {
	return types.FunctionSpec{
		Name:        "wordcount",
		Version:     "1.0.0",
		Description: "Count word frequency in text. Supports sharded execution for large datasets.",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"data": map[string]interface{}{
					"type": "array",
					"items": map[string]interface{}{
						"type": "string",
					},
				},
				"case_sensitive": map[string]interface{}{
					"type": "boolean",
				},
			},
			"required": []string{"data"},
		},
		OutputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"counts": map[string]interface{}{
					"type": "object",
					"additionalProperties": map[string]interface{}{"type": "integer"},
				},
				"total_words": map[string]interface{}{"type": "integer"},
				"unique_words": map[string]interface{}{"type": "integer"},
			},
		},
		Timeout:  30 * time.Second,
		MemoryMB: 256,
	}
}

func (w *WordCountFunction) Execute(input map[string]interface{}) (map[string]interface{}, error) {
	data, ok := input["data"].([]interface{})
	if !ok {
		return nil, &InvalidInputError{Msg: "data must be an array of strings"}
	}

	caseSensitive := false
	if cs, ok := input["case_sensitive"].(bool); ok {
		caseSensitive = cs
	}

	counts := make(map[string]int)
	totalWords := 0

	for _, item := range data {
		text, ok := item.(string)
		if !ok {
			continue
		}

		words := tokenize(text)
		for _, word := range words {
			if !caseSensitive {
				word = strings.ToLower(word)
			}
			counts[word]++
			totalWords++
		}
	}

	countsInterface := make(map[string]interface{})
	for k, v := range counts {
		countsInterface[k] = v
	}

	return map[string]interface{}{
		"counts":       countsInterface,
		"total_words":  totalWords,
		"unique_words": len(counts),
		"map":          countsInterface,
	}, nil
}

func tokenize(text string) []string {
	fields := strings.FieldsFunc(text, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r) && r != '\''
	})

	words := make([]string, 0, len(fields))
	for _, f := range fields {
		word := strings.TrimFunc(f, func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r)
		})
		if len(word) > 0 {
			words = append(words, word)
		}
	}
	return words
}

type InvalidInputError struct {
	Msg string
}

func (e *InvalidInputError) Error() string {
	return "invalid input: " + e.Msg
}
