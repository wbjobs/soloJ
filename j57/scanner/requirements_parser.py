"""requirements.txt 文件解析器"""

import re
import os
from typing import List, Dict, Tuple, Optional


class RequirementsParser:
    """解析 requirements.txt 文件，提取依赖包和版本信息"""

    VERSION_PATTERNS = [
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*==\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*>=\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*<=\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*>\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*<\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*!=\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*~\s*([a-zA-Z0-9.]+)$'),
        re.compile(r'^([a-zA-Z0-9_.-]+)\s*$'),
    ]

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.dependencies: Dict[str, Dict] = {}

    def parse(self) -> Dict[str, Dict]:
        """解析 requirements.txt 文件"""
        if not os.path.exists(self.file_path):
            return {}

        with open(self.file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                line = line.split('#')[0].strip()

                pkg_info = self._parse_line(line)
                if pkg_info:
                    name, version, operator = pkg_info
                    self.dependencies[name.lower()] = {
                        'name': name,
                        'version': version,
                        'operator': operator,
                        'source': 'requirements.txt'
                    }

        return self.dependencies

    def _parse_line(self, line: str) -> Optional[Tuple[str, str, str]]:
        """解析单行依赖声明"""
        for pattern in self.VERSION_PATTERNS:
            match = pattern.match(line)
            if match:
                groups = match.groups()
                name = groups[0]
                if len(groups) > 1 and groups[1]:
                    version = groups[1]
                    operator = self._extract_operator(line, name)
                else:
                    version = 'latest'
                    operator = '=='
                return name, version, operator
        return None

    def _extract_operator(self, line: str, name: str) -> str:
        """从行中提取版本比较操作符"""
        operators = ['==', '>=', '<=', '>', '<', '!=', '~=']
        for op in operators:
            if op in line:
                return op
        return '=='
