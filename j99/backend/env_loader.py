from dotenv import load_dotenv
import os

load_dotenv()

CODE_DIR = os.getenv("CODE_DIR", os.path.join(os.path.dirname(__file__), "code_repo"))
