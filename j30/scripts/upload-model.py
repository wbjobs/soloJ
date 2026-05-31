#!/usr/bin/env python3
"""
Model Upload Script for Smart AI Gateway
This script demonstrates how to upload a TensorFlow Lite model to the gateway.
"""

import requests
import json
import os
import sys

MANAGEMENT_API = os.environ.get("MANAGEMENT_API", "http://localhost:8082")


def upload_model(model_path, model_config):
    """Upload a TFLite model to the gateway."""
    
    if not os.path.exists(model_path):
        print(f"Error: Model file not found: {model_path}")
        return False
    
    print(f"Uploading model: {model_path}")
    
    try:
        with open(model_path, 'rb') as f:
            files = {'model': f}
            data = model_config
            
            response = requests.post(
                f"{MANAGEMENT_API}/api/v1/models/upload",
                files=files,
                data=data,
                timeout=60
            )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"Upload error: {e}")
        return False


def register_model_config(model_config):
    """Register a model configuration without uploading a file."""
    
    print(f"Registering model config: {model_config['name']}")
    
    try:
        response = requests.post(
            f"{MANAGEMENT_API}/api/v1/models/config",
            json=model_config,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        return response.status_code == 200
        
    except Exception as e:
        print(f"Registration error: {e}")
        return False


def reload_models():
    """Trigger model reload in the gateway."""
    
    print("\nTriggering model reload...")
    
    try:
        response = requests.post(
            f"{MANAGEMENT_API}/api/v1/models/reload",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
    except Exception as e:
        print(f"Reload error: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python upload-model.py <model_file> [model_name]")
        print("\nExample:")
        print("  python upload-model.py emotion_detection.tflite emotion_detection")
        print("\nOr register only config:")
        print("  python upload-model.py --config-only emotion_detection")
        return
    
    if sys.argv[1] == "--config-only":
        model_name = sys.argv[2] if len(sys.argv) > 2 else "custom_model"
        
        config = {
            "name": model_name,
            "file": f"{model_name}.tflite",
            "type": "image_classification",
            "input_width": 224,
            "input_height": 224,
            "input_channels": 3,
            "mean": 0.5,
            "std": 0.5,
            "use_gpu": False,
            "num_threads": 4
        }
        
        register_model_config(config)
        return
    
    model_path = sys.argv[1]
    model_name = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(os.path.basename(model_path))[0]
    
    config = {
        "name": model_name,
        "type": "image_classification",
        "input_width": 224,
        "input_height": 224,
        "input_channels": 3,
        "mean": 0.5,
        "std": 0.5,
        "use_gpu": False,
        "num_threads": 4
    }
    
    if upload_model(model_path, config):
        print("\nModel uploaded successfully!")
        reload_models()


if __name__ == "__main__":
    main()
