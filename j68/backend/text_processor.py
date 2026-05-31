import os
from typing import Tuple, Optional

ALLOWED_EXTENSIONS = {'.txt', '.md', '.markdown'}
UPLOAD_DIR = "uploads"


def allowed_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def read_file_content(file_path: str) -> Optional[str]:
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading file {file_path}: {e}")
            return None
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None


def save_uploaded_file(file_content: bytes, filename: str) -> Tuple[bool, str, Optional[str]]:
    if not allowed_file(filename):
        return False, f"不支持的文件类型。仅支持: {', '.join(ALLOWED_EXTENSIONS)}", None

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_path = os.path.join(UPLOAD_DIR, filename)

    try:
        with open(file_path, 'wb') as f:
            f.write(file_content)
    except Exception as e:
        return False, f"保存文件失败: {str(e)}", None

    text_content = read_file_content(file_path)
    if text_content is None:
        os.remove(file_path)
        return False, "无法读取文件内容，请检查文件编码", None

    return True, "文件上传成功", text_content


def clean_text(text: str) -> str:
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if line:
            cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)
