"""依赖树构建器 - 整合所有来源的依赖信息"""

from __future__ import annotations

import os
from typing import Dict, List, Set, Optional, TYPE_CHECKING
from collections import defaultdict

from .requirements_parser import RequirementsParser
from .pyproject_parser import PyProjectParser
from .ast_scanner import ASTSourceScanner

if TYPE_CHECKING:
    from .license_checker import LicenseAPI


class DependencyNode:
    """依赖树节点"""

    def __init__(self, name: str, version: str = 'unknown'):
        self.name = name
        self.version = version
        self.operator = '=='
        self.sources: List[str] = []
        self.used_in_files: List[Dict] = []
        self.is_standard: bool = False
        self.is_third_party: bool = False
        self.is_used: bool = False
        self.is_declared: bool = False
        self.is_optional: bool = False
        self.license: Optional[Dict] = None
        self.children: List['DependencyNode'] = []
        self.parents: List['DependencyNode'] = []

    def to_dict(self) -> Dict:
        """转换为字典格式"""
        return {
            'name': self.name,
            'version': self.version,
            'operator': self.operator,
            'sources': self.sources,
            'used_in_files': self.used_in_files,
            'is_standard': self.is_standard,
            'is_third_party': self.is_third_party,
            'is_used': self.is_used,
            'is_declared': self.is_declared,
            'is_optional': self.is_optional,
            'license': self.license,
        }


class DependencyTree:
    """完整的依赖树"""

    def __init__(self, project_root: str, license_api: Optional[object] = None):
        self.project_root = project_root
        self.license_api = license_api
        self.nodes: Dict[str, DependencyNode] = {}
        self.declared_deps: Dict[str, Dict] = {}
        self.used_imports: Dict[str, List[Dict]] = {}
        self.stdlib_imports: Dict[str, List[Dict]] = {}
        self.required_imports: Set[str] = set()
        self.optional_imports: Set[str] = set()

    def build(self) -> Dict[str, DependencyNode]:
        """构建完整依赖树"""
        self._parse_declared_dependencies()
        self._scan_source_imports()
        self._merge_dependencies()
        return self.nodes

    def _parse_declared_dependencies(self) -> None:
        """解析 requirements.txt 和 pyproject.toml 中的声明依赖"""
        req_file = os.path.join(self.project_root, 'requirements.txt')
        if os.path.exists(req_file):
            parser = RequirementsParser(req_file)
            deps = parser.parse()
            for name, info in deps.items():
                self.declared_deps[name] = info

        pyproj_file = os.path.join(self.project_root, 'pyproject.toml')
        if os.path.exists(pyproj_file):
            parser = PyProjectParser(pyproj_file)
            deps = parser.parse()
            for name, info in deps.items():
                if name not in self.declared_deps:
                    self.declared_deps[name] = info

    def _scan_source_imports(self) -> None:
        """扫描源码中的 import 语句"""
        scanner = ASTSourceScanner(self.project_root)
        scanner.scan()
        self.used_imports = scanner.get_import_locations()
        self.stdlib_imports = scanner.get_stdlib_locations()
        self.required_imports = scanner.get_required_imports()
        self.optional_imports = scanner.get_optional_imports()

    def _merge_dependencies(self) -> None:
        """合并声明依赖和实际使用的导入"""
        for name, info in self.declared_deps.items():
            node = self._get_or_create_node(name)
            node.version = info['version']
            node.operator = info['operator']
            node.sources.append(info['source'])
            if 'section' in info:
                node.sources.append(info['section'])
            node.is_declared = True
            if name.lower() in ASTSourceScanner.STDLIB:
                node.is_standard = True
                node.is_third_party = False
            else:
                node.is_third_party = True

        from .license_checker import LicenseAPI
        if not hasattr(self, 'license_api') or self.license_api is None:
            self.license_api = LicenseAPI()

        for name, locations in self.used_imports.items():
            resolved_name = self.license_api.resolve_package_name(name).lower()

            has_required_usage = any(not loc.get('is_optional', False) for loc in locations)
            is_optional_only = not has_required_usage

            if resolved_name in self.declared_deps and resolved_name != name.lower():
                node = self._get_or_create_node(resolved_name)
                node.used_in_files.extend(locations)
                node.is_used = True
                if is_optional_only and not node.is_declared:
                    node.is_optional = True
            else:
                node = self._get_or_create_node(name)
                node.used_in_files = locations
                node.is_used = True
                node.is_third_party = True

                if is_optional_only and name not in self.declared_deps and resolved_name not in self.declared_deps:
                    node.is_optional = True
                    node.version = 'optional'
                elif name not in self.declared_deps and resolved_name not in self.declared_deps:
                    node.version = 'undetected'

        for name, locations in self.stdlib_imports.items():
            node = self._get_or_create_node(name)
            node.used_in_files = locations
            node.is_used = True
            node.is_standard = True
            node.is_third_party = False
            node.version = 'stdlib'

    def _get_or_create_node(self, name: str) -> DependencyNode:
        """获取或创建依赖节点"""
        key = name.lower()
        if key not in self.nodes:
            self.nodes[key] = DependencyNode(name)
        return self.nodes[key]

    def get_third_party_dependencies(self) -> List[DependencyNode]:
        """获取所有第三方依赖"""
        return [n for n in self.nodes.values() if n.is_third_party]

    def get_undeclared_dependencies(self) -> List[DependencyNode]:
        """获取已使用但未声明的依赖（排除可选依赖）"""
        return [n for n in self.nodes.values()
                if n.is_used and not n.is_declared and n.is_third_party and not n.is_optional]

    def get_optional_dependencies(self) -> List[DependencyNode]:
        """获取可选依赖（try/except块中的导入且未声明）"""
        return [n for n in self.nodes.values()
                if n.is_used and not n.is_declared and n.is_third_party and n.is_optional]

    def get_unused_dependencies(self) -> List[DependencyNode]:
        """获取已声明但未使用的依赖"""
        return [n for n in self.nodes.values() if n.is_declared and not n.is_used and n.is_third_party]

    def get_standard_libraries(self) -> List[DependencyNode]:
        """获取使用的标准库"""
        return [n for n in self.nodes.values() if n.is_standard and n.is_used]

    def summary(self) -> Dict:
        """生成依赖摘要"""
        third_party = self.get_third_party_dependencies()
        return {
            'total_dependencies': len(third_party),
            'declared_count': len([n for n in third_party if n.is_declared]),
            'used_count': len([n for n in third_party if n.is_used]),
            'undeclared_count': len(self.get_undeclared_dependencies()),
            'optional_count': len(self.get_optional_dependencies()),
            'unused_count': len(self.get_unused_dependencies()),
            'standard_library_count': len(self.get_standard_libraries()),
        }
