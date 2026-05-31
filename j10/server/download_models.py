import os
import urllib.request
import argparse


MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')

MODELS = {
    'age_deploy.prototxt': 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt',
    'age_net.caffemodel': 'https://github.com/GilLevi/AgeGenderDeepLearning/raw/master/models/age_net.caffemodel',
    'gender_deploy.prototxt': 'https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt',
    'gender_net.caffemodel': 'https://github.com/GilLevi/AgeGenderDeepLearning/raw/master/models/gender_net.caffemodel',
}

AGE_GENDER_MODELS = {
    'age_deploy.prototxt': 'https://raw.githubusercontent.com/arunponnusamy/cvlib/master/cvlib/config/age_deploy.prototxt',
    'age_net.caffemodel': 'https://raw.githubusercontent.com/arunponnusamy/cvlib/master/cvlib/config/age_net.caffemodel',
    'gender_deploy.prototxt': 'https://raw.githubusercontent.com/arunponnusamy/cvlib/master/cvlib/config/gender_deploy.prototxt',
    'gender_net.caffemodel': 'https://raw.githubusercontent.com/arunponnusamy/cvlib/master/cvlib/config/gender_net.caffemodel',
}


def download_models(model_dir=None):
    save_dir = model_dir or MODEL_DIR
    os.makedirs(save_dir, exist_ok=True)

    for filename, url in AGE_GENDER_MODELS.items():
        filepath = os.path.join(save_dir, filename)
        if os.path.exists(filepath):
            print(f"[SKIP] {filename} already exists")
            continue

        print(f"[DOWNLOAD] {filename} from {url}")
        try:
            urllib.request.urlretrieve(url, filepath)
            print(f"[OK] {filename} downloaded successfully")
        except Exception as e:
            print(f"[ERROR] Failed to download {filename}: {e}")
            print(f"[INFO] The server will use mock estimation if models are not available")

    print("[INFO] Model download complete")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Download age/gender models')
    parser.add_argument('--model-dir', type=str, default=None,
                        help='Directory to save models')
    args = parser.parse_args()
    download_models(args.model_dir)