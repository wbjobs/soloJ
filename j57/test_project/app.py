"""主应用入口 - 包含标准库和第三方库的导入"""

import os
import sys
import json
import logging
from datetime import datetime
from typing import List, Dict, Optional

# 已声明的第三方库
import flask
from flask import Flask, request, jsonify
import requests
import jwt

# 未声明的依赖 - 将被检测为问题
import yaml
import bs4
from bs4 import BeautifulSoup

# 标准库导入
from collections import defaultdict
import re
import math

# 相对导入
from .utils import helper_function
from config import settings

logger = logging.getLogger(__name__)

app = Flask(__name__)


def fetch_external_data(url: str) -> Dict:
    """使用 requests 获取外部数据"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"请求失败: {e}")
        return {}


def parse_html(html_content: str) -> str:
    """使用 BeautifulSoup 解析 HTML (未声明依赖)"""
    soup = BeautifulSoup(html_content, 'html.parser')
    return soup.get_text()


@app.route('/')
def index():
    """主页路由"""
    data = {
        'status': 'ok',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    }
    return jsonify(data)


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
