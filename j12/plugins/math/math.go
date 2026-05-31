package main

import (
	"time"

	"github.com/fcnet/func-compute/types"
)

type MathFunction struct{}

var Function types.PluginFunction = &MathFunction{}

func (m *MathFunction) GetSpec() types.FunctionSpec {
	return types.FunctionSpec{
		Name:        "math",
		Version:     "1.0.0",
		Description: "Basic math operations: add, subtract, multiply, divide",
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"operation": map[string]interface{}{
					"type": "string",
					"enum": []string{"add", "subtract", "multiply", "divide"},
				},
				"a": map[string]interface{}{"type": "number"},
				"b": map[string]interface{}{"type": "number"},
			},
			"required": []string{"operation", "a", "b"},
		},
		OutputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"result": map[string]interface{}{"type": "number"},
			},
		},
		Timeout:  5 * time.Second,
		MemoryMB: 128,
	}
}

func (m *MathFunction) Execute(input map[string]interface{}) (map[string]interface{}, error) {
	op, ok := input["operation"].(string)
	if !ok {
		return nil, &ErrInvalidInput{Msg: "operation must be a string"}
	}

	a, err := getNumber(input, "a")
	if err != nil {
		return nil, err
	}

	b, err := getNumber(input, "b")
	if err != nil {
		return nil, err
	}

	var result float64
	switch op {
	case "add":
		result = a + b
	case "subtract":
		result = a - b
	case "multiply":
		result = a * b
	case "divide":
		if b == 0 {
			return nil, &ErrDivisionByZero{}
		}
		result = a / b
	default:
		return nil, &ErrInvalidOperation{Op: op}
	}

	return map[string]interface{}{
		"result": result,
	}, nil
}

func getNumber(input map[string]interface{}, key string) (float64, error) {
	v, ok := input[key]
	if !ok {
		return 0, &ErrMissingField{Field: key}
	}

	switch val := v.(type) {
	case float64:
		return val, nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	default:
		return 0, &ErrInvalidInput{Msg: key + " must be a number"}
	}
}

type ErrInvalidInput struct {
	Msg string
}

func (e *ErrInvalidInput) Error() string {
	return "invalid input: " + e.Msg
}

type ErrMissingField struct {
	Field string
}

func (e *ErrMissingField) Error() string {
	return "missing field: " + e.Field
}

type ErrInvalidOperation struct {
	Op string
}

func (e *ErrInvalidOperation) Error() string {
	return "invalid operation: " + e.Op
}

type ErrDivisionByZero struct{}

func (e *ErrDivisionByZero) Error() string {
	return "division by zero"
}
