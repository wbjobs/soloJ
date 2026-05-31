#!/usr/bin/env python3
"""
Smart AI Gateway Test Client
This script demonstrates how to interact with the AI gateway.
"""

import requests
import json
import time
import os

GATEWAY_URL = os.environ.get("GATEWAY_URL", "http://localhost:8080")
MANAGEMENT_API = os.environ.get("MANAGEMENT_API", "http://localhost:8082")


def test_upload_emotion_detection():
    """Test emotion detection on image upload."""
    print("\n=== Testing Emotion Detection (POST /upload) ===")
    
    test_image_data = os.urandom(48 * 48 * 1)
    
    try:
        response = requests.post(
            f"{GATEWAY_URL}/upload",
            data=test_image_data,
            headers={"Content-Type": "application/octet-stream"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        inference_header = response.headers.get("X-Inference-Result")
        if inference_header:
            result = json.loads(inference_header)
            print(f"Inference Result: {json.dumps(result, indent=2)}")
        
        print(f"Response Body: {response.text[:200]}")
        
    except Exception as e:
        print(f"Error: {e}")


def test_sentiment_analysis():
    """Test sentiment analysis on text."""
    print("\n=== Testing Sentiment Analysis (POST /analyze) ===")
    
    payload = {
        "text": "I absolutely love this product! It works amazing and the quality is outstanding.",
        "user_id": "user123"
    }
    
    try:
        response = requests.post(
            f"{GATEWAY_URL}/analyze",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
    except Exception as e:
        print(f"Error: {e}")


def test_image_classification():
    """Test image classification API."""
    print("\n=== Testing Image Classification (POST /api/classify) ===")
    
    test_image_data = os.urandom(224 * 224 * 3)
    
    try:
        response = requests.post(
            f"{GATEWAY_URL}/api/classify",
            data=test_image_data,
            headers={"Content-Type": "application/octet-stream"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        inference_header = response.headers.get("X-Image-Class")
        if inference_header:
            result = json.loads(inference_header)
            print(f"Classification Result: {json.dumps(result, indent=2)}")
        
        print(f"Response Body: {response.text[:200]}")
        
    except Exception as e:
        print(f"Error: {e}")


def get_statistics():
    """Get inference statistics from management API."""
    print("\n=== Getting Statistics ===")
    
    try:
        response = requests.get(f"{MANAGEMENT_API}/api/v1/stats/summary", timeout=5)
        stats = response.json()
        print(f"Statistics: {json.dumps(stats, indent=2)}")
    except Exception as e:
        print(f"Error getting stats: {e}")


def get_models():
    """List loaded models."""
    print("\n=== Getting Loaded Models ===")
    
    try:
        response = requests.get(f"{MANAGEMENT_API}/api/v1/models", timeout=5)
        result = response.json()
        print(f"Loaded models ({result['count']}):")
        for model in result['models']:
            print(f"  - {model['name']} ({model['type']})")
    except Exception as e:
        print(f"Error getting models: {e}")


def get_rules():
    """List routing rules."""
    print("\n=== Getting Routing Rules ===")
    
    try:
        response = requests.get(f"{MANAGEMENT_API}/api/v1/rules", timeout=5)
        result = response.json()
        print(f"Routing rules ({result['count']}):")
        for rule in result['rules']:
            status = "ENABLED" if rule['enabled'] else "DISABLED"
            print(f"  [{status}] {rule['id']}: {rule['method']} {rule['path_pattern']} -> {rule['model_name']}")
    except Exception as e:
        print(f"Error getting rules: {e}")


def main():
    print("=" * 60)
    print("Smart AI Gateway Test Client")
    print("=" * 60)
    
    print(f"\nGateway URL: {GATEWAY_URL}")
    print(f"Management API: {MANAGEMENT_API}")
    
    get_models()
    get_rules()
    
    test_upload_emotion_detection()
    test_sentiment_analysis()
    test_image_classification()
    
    time.sleep(1)
    get_statistics()
    
    print("\n" + "=" * 60)
    print("Tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
