"""pyproject.toml 文件解析器"""

import os
import json
from typing import Dict, List, Optional

try:
    import tomllib
    HAS_TOMLLIB = True
except ImportError:
    try:
        import tomli as tomllib
        HAS_TOMLLIB = True
    except ImportError:
        HAS_TOMLLIB = False


class PyProjectParser:
    """解析 pyproject.toml 文件，提取项目依赖"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.dependencies: Dict[str, Dict] = {}
        self.project_info: Dict = {}

    def parse(self) -> Dict[str, Dict]:
        """解析 pyproject.toml 文件"""
        if not os.path.exists(self.file_path):
            return {}

        if not HAS_TOMLLIB:
            print("警告: 未安装 tomli 模块，无法解析 pyproject.toml")
            print("请安装: pip install tomli")
            return {}

        with open(self.file_path, 'rb') as f:
            try:
                data = tomllib.load(f)
            except Exception as e:
                print(f"解析 pyproject.toml 失败: {e}")
                return {}

        self.project_info = data.get('project', {})
        self._parse_dependencies(data)
        return self.dependencies

    def _parse_dependencies(self, data: Dict) -> None:
        """从 TOML 数据中提取依赖"""
        project = data.get('project', {})
        if 'dependencies' in project:
            for dep in project['dependencies']:
                pkg_info = self._parse_dependency_string(dep)
                if pkg_info:
                    name, version, operator = pkg_info
                    self.dependencies[name.lower()] = {
                        'name': name,
                        'version': version,
                        'operator': operator,
                        'source': 'pyproject.toml',
                        'section': 'dependencies'
                    }

        optional_deps = project.get('optional-dependencies', {})
        for group, deps in optional_deps.items():
            for dep in deps:
                pkg_info = self._parse_dependency_string(dep)
                if pkg_info:
                    name, version, operator = pkg_info
                    key = name.lower()
                    if key not in self.dependencies:
                        self.dependencies[key] = {
                            'name': name,
                            'version': version,
                            'operator': operator,
                            'source': 'pyproject.toml',
                            'section': f'optional-dependencies/{group}'
                        }

        poetry = data.get('tool', {}).get('poetry', {})
        if 'dependencies' in poetry:
            for name, version_spec in poetry['dependencies'].items():
                if name.lower() == 'python':
                    continue
                version, operator = self._parse_poetry_version(version_spec)
                key = name.lower()
                if key not in self.dependencies:
                    self.dependencies[key] = {
                        'name': name,
                        'version': version,
                        'operator': operator,
                        'source': 'pyproject.toml',
                        'section': 'poetry/dependencies'
                    }

    def _parse_dependency_string(self, dep_str: str) -> Optional[tuple]:
        """解析类似 'package>=1.0.0' 的依赖字符串"""
        import re
        patterns = [
            re.compile(r'^([a-zA-Z0-9_.-]+)\s*(==|>=|<=|!=|~=|>|<)\s*([a-zA-Z0-9.*]+)$'),
            re.compile(r'^([a-zA-Z0-9_.-]+)\s*$'),
        ]

        for pattern in patterns:
            match = pattern.match(dep_str.strip())
            if match:
                groups = match.groups()
                name = groups[0]
                if len(groups) == 3:
                    operator = groups[1]
                    version = groups[2]
                else:
                    operator = '=='
                    version = 'latest'
                return name, version, operator
        return None

    def _parse_poetry_version(self, version_spec) -> tuple:
        """解析 Poetry 风格的版本声明"""
        if isinstance(version_spec, str):
            import re
            match = re.match(r'^([\^~]?)([a-zA-Z0-9.*]+)$', version_spec)
            if match:
                prefix, version = match.groups()
                if prefix == '^':
                    return version, '^='
                elif prefix == '~':
                    return version, '~='
                else:
                    return version, '=='
            return version_spec, '=='
        elif isinstance(version_spec, dict):
            version = version_spec.get('version', 'latest')
            return version, version_spec.get('operator', '==')
        return 'latest', '=='
