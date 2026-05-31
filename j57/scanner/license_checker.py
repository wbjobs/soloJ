"""许可证查询和风险评估模块"""

import os
import json
from typing import Dict, List, Optional, Tuple

from .dependency_tree import DependencyNode


class LicenseAPI:
    """模拟的许可证 API - 从本地 JSON 文件加载数据"""

    def __init__(self, data_file: str = None):
        if data_file is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_file = os.path.join(base_dir, 'data', 'licenses.json')

        self.data_file = data_file
        self.licenses_data: Dict = {}
        self.packages_data: Dict = {}
        self.package_aliases: Dict[str, str] = {}
        self._load_data()

    def _load_data(self) -> None:
        """加载许可证数据"""
        if not os.path.exists(self.data_file):
            print(f"警告: 许可证数据文件不存在: {self.data_file}")
            self.licenses_data = {}
            self.packages_data = {}
            self.package_aliases = {}
            return

        with open(self.data_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.licenses_data = data.get('licenses', {})
            self.packages_data = data.get('packages', {})
            self.package_aliases = data.get('package_aliases', {})

    def resolve_package_name(self, name: str) -> str:
        """解析包名别名，返回实际的包名"""
        key = name.lower()
        if key in self.package_aliases:
            return self.package_aliases[key]
        return name

    def get_package_license(self, package_name: str) -> Optional[Dict]:
        """查询包的许可证信息"""
        original_key = package_name.lower()
        resolved_key = self.resolve_package_name(original_key).lower()

        lookup_key = resolved_key if resolved_key in self.packages_data else original_key

        if lookup_key in self.packages_data:
            pkg_info = self.packages_data[lookup_key]
            license_id = pkg_info.get('license', 'Unknown')
            license_info = self.licenses_data.get(license_id, self.licenses_data.get('Unknown'))

            return {
                'package': package_name,
                'resolved_package': lookup_key if lookup_key != original_key else None,
                'license_id': license_id,
                'license_name': license_info.get('name', 'Unknown'),
                'risk_level': license_info.get('risk_level', 'high'),
                'description': license_info.get('description', ''),
                'permissions': license_info.get('permissions', []),
                'conditions': license_info.get('conditions', []),
                'limitations': license_info.get('limitations', []),
                'homepage': pkg_info.get('homepage', ''),
                'is_stdlib': pkg_info.get('is_stdlib', False)
            }

        return {
            'package': package_name,
            'resolved_package': None,
            'license_id': 'Unknown',
            'license_name': 'Unknown License',
            'risk_level': 'high',
            'description': 'The license for this package could not be determined.',
            'permissions': [],
            'conditions': [],
            'limitations': ['commercial-use', 'modification', 'distribution', 'private-use'],
            'homepage': '',
            'is_stdlib': False
        }

    def get_license_info(self, license_id: str) -> Optional[Dict]:
        """获取许可证类型的详细信息"""
        return self.licenses_data.get(license_id)


class LicenseCategory:
    """许可证分类体系"""

    COPYLEFT_STRONG = {
        'GPL-2.0', 'GPL-3.0', 'AGPL-3.0'
    }

    COPYLEFT_WEAK = {
        'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0'
    }

    PROPRIETARY = {
        'Proprietary', 'Commercial', 'BUSL-1.1', 'SSPL-1.0',
        'BSL-1.1', 'CC-BY-NC-4.0', 'CC-BY-NC-SA-4.0'
    }

    PERMISSIVE = {
        'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
        'ISC', 'Unlicense', 'WTFPL', 'PSF-2.0', 'CC0-1.0'
    }

    @classmethod
    def classify(cls, license_id: str) -> str:
        """将许可证ID分类"""
        if license_id in cls.COPYLEFT_STRONG:
            return 'copyleft-strong'
        if license_id in cls.COPYLEFT_WEAK:
            return 'copyleft-weak'
        if license_id in cls.PROPRIETARY:
            return 'proprietary'
        if license_id in cls.PERMISSIVE:
            return 'permissive'
        if license_id == 'Unknown':
            return 'unknown'
        return 'other'

    @classmethod
    def get_label(cls, category: str) -> str:
        """获取分类的中文名称"""
        labels = {
            'copyleft-strong': '强Copyleft',
            'copyleft-weak': '弱Copyleft',
            'proprietary': '闭源/商业',
            'permissive': '宽松许可',
            'unknown': '未知',
            'other': '其他'
        }
        return labels.get(category, '其他')

    @classmethod
    def get_color(cls, category: str) -> str:
        """获取分类的显示颜色"""
        colors = {
            'copyleft-strong': '#dc2626',
            'copyleft-weak': '#f59e0b',
            'proprietary': '#7c3aed',
            'permissive': '#10b981',
            'unknown': '#6b7280',
            'other': '#6b7280'
        }
        return colors.get(category, '#6b7280')


class ContaminationDetector:
    """许可证污染检测器 - 检测 GPL 与闭源/商业许可证共存的冲突"""

    def __init__(self):
        self.contamination_warnings: List[Dict] = []

    def detect(self, nodes: Dict[str, DependencyNode]) -> List[Dict]:
        """检测许可证污染情况"""
        self.contamination_warnings = []

        copyleft_packages: List[Dict] = []
        proprietary_packages: List[Dict] = []

        for node in nodes.values():
            if not node.is_third_party or not node.license:
                continue
            if not node.is_used and not node.is_declared:
                continue

            license_id = node.license.get('license_id', 'Unknown')
            category = LicenseCategory.classify(license_id)

            pkg_info = {
                'name': node.name,
                'version': node.version,
                'license_id': license_id,
                'license_name': node.license.get('license_name', 'Unknown'),
                'category': category,
                'category_label': LicenseCategory.get_label(category),
                'is_used': node.is_used,
                'is_declared': node.is_declared,
                'is_optional': node.is_optional
            }

            if category == 'copyleft-strong':
                copyleft_packages.append(pkg_info)
            elif category == 'proprietary':
                proprietary_packages.append(pkg_info)

        if copyleft_packages and proprietary_packages:
            self._generate_contamination_warnings(copyleft_packages, proprietary_packages)

        return self.contamination_warnings

    def _generate_contamination_warnings(self,
                                          copyleft_packages: List[Dict],
                                          proprietary_packages: List[Dict]) -> None:
        """生成许可证污染警告"""
        used_copyleft = [p for p in copyleft_packages if p['is_used']]
        used_proprietary = [p for p in proprietary_packages if p['is_used']]

        if not used_copyleft or not used_proprietary:
            return

        warning = {
            'type': 'license_contamination',
            'severity': 'critical',
            'title': '许可证污染风险',
            'description': (
                '项目中同时使用了强 Copyleft 许可证（GPL/AGPL）和闭源/商业许可证的库。'
                '强 Copyleft 许可证要求衍生作品以相同许可证开源，'
                '这与闭源/商业软件的使用条款存在根本冲突，'
                '可能导致闭源代码被迫开源或违反商业许可协议。'
            ),
            'copyleft_packages': used_copyleft,
            'proprietary_packages': used_proprietary,
            'conflict_pairs': [],
            'recommendation': (
                '1. 审查 GPL/AGPL 库是否可以通过动态链接或独立进程隔离来避免污染；\n'
                '2. 考虑将 GPL 库替换为功能等效的宽松许可（MIT/Apache/BSD）替代品；\n'
                '3. 咨询法律顾问评估合规风险；\n'
                '4. 如无法替换，需确保闭源代码不与 GPL 代码静态链接或形成衍生作品。'
            )
        }

        for gpl_pkg in used_copyleft:
            for prop_pkg in used_proprietary:
                warning['conflict_pairs'].append({
                    'copyleft': gpl_pkg['name'],
                    'copyleft_license': gpl_pkg['license_id'],
                    'proprietary': prop_pkg['name'],
                    'proprietary_license': prop_pkg['license_id'],
                    'reason': (
                        f"{gpl_pkg['license_id']}（{gpl_pkg['name']}）与 "
                        f"{prop_pkg['license_id']}（{prop_pkg['name']}）存在许可证兼容性冲突"
                    )
                })

        self.contamination_warnings.append(warning)

    def has_contamination(self) -> bool:
        """是否存在许可证污染"""
        return len(self.contamination_warnings) > 0


class LicenseChecker:
    """许可证检查器 - 为依赖树添加许可证信息并进行风险评估"""

    RISK_COLORS = {
        'low': '#10b981',
        'medium': '#f59e0b',
        'high': '#ef4444',
        'critical': '#991b1b'
    }

    RISK_LABELS = {
        'low': '低风险',
        'medium': '中风险',
        'high': '高风险',
        'critical': '严重风险'
    }

    def __init__(self, license_api: LicenseAPI = None):
        self.license_api = license_api or LicenseAPI()
        self.risk_summary: Dict = {}
        self.contamination_detector = ContaminationDetector()

    def check_dependencies(self, nodes: Dict[str, DependencyNode]) -> Dict[str, DependencyNode]:
        """为所有依赖节点添加许可证信息"""
        for name, node in nodes.items():
            if node.is_third_party or node.is_standard:
                license_info = self.license_api.get_package_license(node.name)
                node.license = license_info

        self._generate_risk_summary(nodes)
        return nodes

    def _generate_risk_summary(self, nodes: Dict[str, DependencyNode]) -> None:
        """生成风险评估摘要"""
        third_party = [n for n in nodes.values() if n.is_third_party and n.license]

        risk_counts = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
        license_counts: Dict[str, int] = {}
        license_categories: Dict[str, List[Dict]] = {}
        issues: List[Dict] = []

        for node in third_party:
            if not node.license:
                continue

            risk = node.license['risk_level']
            risk_counts[risk] += 1

            license_id = node.license['license_id']
            license_counts[license_id] = license_counts.get(license_id, 0) + 1

            category = LicenseCategory.classify(license_id)
            if category not in license_categories:
                license_categories[category] = []
            license_categories[category].append({
                'name': node.name,
                'version': node.version,
                'license_id': license_id,
                'category': category,
                'category_label': LicenseCategory.get_label(category),
                'is_used': node.is_used,
                'is_declared': node.is_declared
            })

            if risk == 'high':
                issues.append({
                    'package': node.name,
                    'version': node.version,
                    'license': license_id,
                    'license_name': node.license['license_name'],
                    'risk': risk,
                    'reason': self._get_risk_reason(license_id),
                    'is_used': node.is_used,
                    'is_declared': node.is_declared
                })

            if node.is_used and not node.is_declared and not node.is_optional:
                issues.append({
                    'package': node.name,
                    'version': node.version,
                    'license': license_id,
                    'license_name': node.license['license_name'],
                    'risk': 'medium',
                    'reason': '包已在代码中使用但未在依赖文件中声明',
                    'is_used': True,
                    'is_declared': False
                })

            if node.is_optional:
                issues.append({
                    'package': node.name,
                    'version': node.version,
                    'license': license_id,
                    'license_name': node.license['license_name'],
                    'risk': 'low',
                    'reason': '可选依赖（try/except块中导入，未在依赖文件中声明）',
                    'is_used': True,
                    'is_declared': False,
                    'is_optional': True
                })

            if node.is_declared and not node.is_used:
                issues.append({
                    'package': node.name,
                    'version': node.version,
                    'license': license_id,
                    'license_name': node.license['license_name'],
                    'risk': 'low',
                    'reason': '包已声明但未在代码中使用',
                    'is_used': False,
                    'is_declared': True
                })

        contamination_warnings = self.contamination_detector.detect(nodes)

        if contamination_warnings:
            risk_counts['critical'] = 1
            for warning in contamination_warnings:
                issues.insert(0, {
                    'package': '许可证污染',
                    'version': '-',
                    'license': 'GPL + Proprietary',
                    'license_name': '许可证污染冲突',
                    'risk': 'critical',
                    'reason': warning['description'],
                    'is_contamination': True,
                    'conflict_pairs': warning['conflict_pairs'],
                    'recommendation': warning['recommendation']
                })

        total = len(third_party)
        overall_risk = self._calculate_overall_risk(risk_counts, total, contamination_warnings)

        self.risk_summary = {
            'total_packages': total,
            'risk_distribution': risk_counts,
            'license_distribution': license_counts,
            'license_categories': license_categories,
            'issues': issues,
            'overall_risk': overall_risk,
            'overall_risk_label': self.RISK_LABELS[overall_risk],
            'overall_risk_color': self.RISK_COLORS[overall_risk],
            'contamination_warnings': contamination_warnings,
            'has_contamination': len(contamination_warnings) > 0
        }

    def _get_risk_reason(self, license_id: str) -> str:
        """获取高风险许可证的原因说明"""
        high_risk_reasons = {
            'GPL-3.0': 'GPLv3 是强Copyleft许可证，要求衍生作品开源',
            'GPL-2.0': 'GPLv2 是强Copyleft许可证，要求衍生作品开源',
            'AGPL-3.0': 'AGPLv3 是强Copyleft许可证，网络使用也需要开源',
            'Proprietary': '专有软件使用受限，需要仔细审查许可协议',
            'Unknown': '许可证未知，存在法律风险'
        }
        return high_risk_reasons.get(license_id, '需要审查许可证条款')

    def _calculate_overall_risk(self, risk_counts: Dict[str, int],
                                 total: int,
                                 contamination_warnings: List[Dict]) -> str:
        """计算整体风险等级"""
        if contamination_warnings:
            return 'critical'
        if total == 0:
            return 'low'

        high_count = risk_counts.get('high', 0)
        medium_count = risk_counts.get('medium', 0)

        if high_count > 0:
            return 'high'
        elif medium_count > total * 0.3:
            return 'medium'
        else:
            return 'low'

    def get_risk_summary(self) -> Dict:
        """获取风险评估摘要"""
        return self.risk_summary
