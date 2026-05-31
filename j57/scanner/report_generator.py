"""HTML 合规性报告生成器"""

import os
import json
from datetime import datetime
from typing import Dict, List

from .dependency_tree import DependencyTree, DependencyNode
from .license_checker import LicenseChecker


class HTMLReportGenerator:
    """生成美观的 HTML 合规性报告"""

    def __init__(self, output_dir: str = None):
        if output_dir is None:
            output_dir = os.getcwd()
        self.output_dir = output_dir

    def generate(self,
                 dep_tree: DependencyTree,
                 license_checker: LicenseChecker,
                 output_file: str = None) -> str:
        """生成完整的 HTML 报告"""

        if output_file is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_file = f'license_compliance_report_{timestamp}.html'

        output_path = os.path.join(self.output_dir, output_file)

        risk_summary = license_checker.get_risk_summary()
        dep_summary = dep_tree.summary()
        third_party = dep_tree.get_third_party_dependencies()
        undeclared = dep_tree.get_undeclared_dependencies()
        optional = dep_tree.get_optional_dependencies()
        unused = dep_tree.get_unused_dependencies()
        stdlib = dep_tree.get_standard_libraries()

        html_content = self._render_html(
            dep_tree=dep_tree,
            risk_summary=risk_summary,
            dep_summary=dep_summary,
            third_party=third_party,
            undeclared=undeclared,
            optional=optional,
            unused=unused,
            stdlib=stdlib
        )

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return output_path

    def _render_html(self, **kwargs) -> str:
        """渲染完整的 HTML 页面"""

        dep_tree = kwargs['dep_tree']
        risk_summary = kwargs['risk_summary']
        dep_summary = kwargs['dep_summary']
        third_party = kwargs['third_party']
        undeclared = kwargs['undeclared']
        optional = kwargs['optional']
        unused = kwargs['unused']
        stdlib = kwargs['stdlib']

        overall_risk_color = risk_summary.get('overall_risk_color', '#6b7280')
        overall_risk_label = risk_summary.get('overall_risk_label', '未知')

        return f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Python 依赖许可证合规性报告</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f3f4f6;
            color: #1f2937;
            line-height: 1.6;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; padding: 20px; }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        }}
        .header h1 {{ font-size: 2.5rem; margin-bottom: 10px; }}
        .header .subtitle {{ font-size: 1.1rem; opacity: 0.9; }}
        .header .metadata {{ margin-top: 20px; font-size: 0.9rem; opacity: 0.8; }}

        .risk-overview {{
            display: flex;
            align-items: center;
            gap: 30px;
            background: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }}
        .risk-badge {{
            width: 120px;
            height: 120px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.3rem;
            font-weight: bold;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
        }}
        .risk-details {{ flex: 1; }}
        .risk-details h2 {{ margin-bottom: 15px; color: #374151; }}
        .risk-bars {{ display: flex; gap: 20px; }}
        .risk-bar-item {{ flex: 1; }}
        .risk-bar-label {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 0.9rem;
        }}
        .risk-bar {{
            height: 12px;
            background: #e5e7eb;
            border-radius: 6px;
            overflow: hidden;
        }}
        .risk-bar-fill {{
            height: 100%;
            border-radius: 6px;
            transition: width 0.5s ease;
        }}
        .risk-low {{ background: #10b981; }}
        .risk-medium {{ background: #f59e0b; }}
        .risk-high {{ background: #ef4444; }}
        .risk-critical {{ background: #991b1b; }}

        .contamination-banner {{
            background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 50%, #450a0a 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(153, 27, 27, 0.4);
            border: 2px solid #fca5a5;
            animation: pulse-border 2s ease-in-out infinite;
        }}
        @keyframes pulse-border {{
            0%, 100% {{ border-color: #fca5a5; }}
            50% {{ border-color: #fecaca; }}
        }}
        .contamination-banner h2 {{
            font-size: 1.8rem;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .contamination-banner .warning-icon {{
            display: inline-block;
            animation: blink 1.5s ease-in-out infinite;
        }}
        @keyframes blink {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.4; }}
        }}
        .contamination-banner .desc {{
            opacity: 0.95;
            margin-bottom: 20px;
            line-height: 1.8;
        }}
        .conflict-pairs {{
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }}
        .conflict-pair {{
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }}
        .conflict-pair:last-child {{ border-bottom: none; }}
        .conflict-arrow {{
            color: #fca5a5;
            font-weight: bold;
            font-size: 1.2rem;
        }}
        .pkg-chip {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 500;
        }}
        .pkg-chip.gpl {{
            background: rgba(220, 38, 38, 0.3);
            border: 1px solid #fca5a5;
        }}
        .pkg-chip.proprietary {{
            background: rgba(124, 58, 237, 0.3);
            border: 1px solid #c4b5fd;
        }}
        .recommendation {{
            background: rgba(0, 0, 0, 0.15);
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
            white-space: pre-line;
            line-height: 1.8;
        }}

        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: white;
            padding: 25px;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            text-align: center;
            transition: transform 0.2s;
        }}
        .stat-card:hover {{ transform: translateY(-5px); }}
        .stat-card .number {{
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 5px;
        }}
        .stat-card .label {{ color: #6b7280; font-size: 0.95rem; }}

        .section {{
            background: white;
            border-radius: 12px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }}
        .section-header {{
            padding: 20px 30px;
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
        }}
        .section-header h2 {{
            color: #374151;
            font-size: 1.4rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .section-header .count {{
            background: #667eea;
            color: white;
            padding: 3px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
        }}
        .section-body {{ padding: 20px 30px; }}

        .issues-list {{ list-style: none; }}
        .issue-item {{
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid;
        }}
        .issue-item.risk-high {{
            background: #fef2f2;
            border-color: #ef4444;
        }}
        .issue-item.risk-critical {{
            background: #450a0a;
            border-color: #991b1b;
            color: #fecaca;
        }}
        .issue-item.risk-critical .issue-title {{
            color: #fca5a5;
        }}
        .issue-item.risk-critical .issue-reason {{
            color: #fca5a5;
        }}
        .issue-item.risk-medium {{
            background: #fffbeb;
            border-color: #f59e0b;
        }}
        .issue-item.risk-low {{
            background: #f0fdf4;
            border-color: #10b981;
        }}
        .issue-title {{
            font-weight: 600;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .issue-reason {{ color: #6b7280; font-size: 0.9rem; }}

        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th {{
            background: #f9fafb;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 2px solid #e5e7eb;
        }}
        td {{
            padding: 12px 15px;
            border-bottom: 1px solid #f3f4f6;
        }}
        tr:hover {{ background: #f9fafb; }}

        .license-badge {{
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 500;
            color: white;
        }}

        .status-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }}
        .status-badge.declared {{
            background: #dbeafe;
            color: #1d4ed8;
        }}
        .status-badge.used {{
            background: #d1fae5;
            color: #065f46;
        }}
        .status-badge.optional {{
            background: #ede9fe;
            color: #5b21b6;
        }}
        .status-badge.undeclared {{
            background: #fee2e2;
            color: #991b1b;
        }}
        .status-badge.unused {{
            background: #fef3c7;
            color: #92400e;
        }}

        .file-list {{
            font-size: 0.85rem;
            color: #6b7280;
            max-height: 100px;
            overflow-y: auto;
        }}
        .file-list span {{
            display: inline-block;
            background: #f3f4f6;
            padding: 2px 6px;
            margin: 2px;
            border-radius: 4px;
        }}

        .details-panel {{
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-top: 10px;
            font-size: 0.9rem;
        }}
        .details-panel h4 {{ color: #374151; margin-bottom: 10px; }}
        .permission-tags {{ display: flex; flex-wrap: wrap; gap: 5px; }}
        .perm-tag {{
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
        }}
        .perm-tag.allow {{
            background: #d1fae5;
            color: #065f46;
        }}
        .perm-tag.require {{
            background: #dbeafe;
            color: #1d4ed8;
        }}
        .perm-tag.forbid {{
            background: #fee2e2;
            color: #991b1b;
        }}

        .footer {{
            text-align: center;
            padding: 30px;
            color: #6b7280;
            font-size: 0.9rem;
        }}

        .collapsible {{ cursor: pointer; }}
        .collapsible-content {{ display: none; }}
        .collapsible.open + .collapsible-content {{ display: block; }}
        .arrow {{ display: inline-block; transition: transform 0.2s; }}
        .collapsible.open .arrow {{ transform: rotate(90deg); }}

        .license-dist {{
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }}
        .license-dist-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f9fafb;
            padding: 8px 12px;
            border-radius: 6px;
        }}
        .license-dist-color {{
            width: 12px;
            height: 12px;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Python 依赖许可证合规性报告</h1>
            <p class="subtitle">分析项目依赖的许可证合规性，识别潜在法律风险</p>
            <div class="metadata">
                <p>项目路径: {dep_tree.project_root}</p>
                <p>生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <p>扫描引擎: PyLicenseScanner v1.0</p>
            </div>
        </div>

        <div class="risk-overview">
            <div class="risk-badge" style="background: {overall_risk_color};">
                {overall_risk_label}
            </div>
            <div class="risk-details">
                <h2>整体风险评估</h2>
                <div class="risk-bars">
                    {self._render_risk_bars(risk_summary)}
                </div>
                <div class="license-dist">
                    {self._render_license_distribution(risk_summary)}
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="number">{dep_summary['total_dependencies']}</div>
                <div class="label">第三方依赖总数</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['declared_count']}</div>
                <div class="label">已声明依赖</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['used_count']}</div>
                <div class="label">实际使用依赖</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['undeclared_count']}</div>
                <div class="label">未声明依赖 ⚠️</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['optional_count']}</div>
                <div class="label">可选依赖</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['unused_count']}</div>
                <div class="label">未使用依赖</div>
            </div>
            <div class="stat-card">
                <div class="number">{dep_summary['standard_library_count']}</div>
                <div class="label">标准库引用</div>
            </div>
        </div>

        {self._render_contamination_banner(risk_summary)}

        {self._render_issues_section(risk_summary)}
        {self._render_dependencies_table(third_party, '第三方依赖包清单')}
        {self._render_simple_table(undeclared, '未声明的依赖包', 'undeclared')}
        {self._render_simple_table(optional, '可选依赖（try/except导入）', 'optional')}
        {self._render_simple_table(unused, '未使用的依赖包', 'unused')}
        {self._render_stdlib_table(stdlib)}

        <div class="footer">
            <p>本报告由 Python 依赖许可证扫描器自动生成 | 仅供参考，请结合实际法律意见</p>
        </div>
    </div>

    <script>
        document.querySelectorAll('.collapsible').forEach(el => {{
            el.addEventListener('click', () => {{
                el.classList.toggle('open');
            }});
        }});
    </script>
</body>
</html>'''

    def _render_contamination_banner(self, risk_summary: Dict) -> str:
        """渲染许可证污染警告横幅"""
        warnings = risk_summary.get('contamination_warnings', [])
        if not warnings:
            return ''

        html = ''
        for warning in warnings:
            conflict_pairs_html = ''
            for pair in warning.get('conflict_pairs', []):
                conflict_pairs_html += f'''
                <div class="conflict-pair">
                    <span class="pkg-chip gpl">{pair['copyleft']} ({pair['copyleft_license']})</span>
                    <span class="conflict-arrow">⟷</span>
                    <span class="pkg-chip proprietary">{pair['proprietary']} ({pair['proprietary_license']})</span>
                </div>'''

            html += f'''
        <div class="contamination-banner">
            <h2>
                <span class="warning-icon">🚨</span>
                {warning['title']}
            </h2>
            <p class="desc">{warning['description']}</p>
            <div class="conflict-pairs">
                <h3 style="margin-bottom: 10px;">⚠️ 冲突对：</h3>
                {conflict_pairs_html}
            </div>
            <div class="recommendation">
                <h3 style="margin-bottom: 8px;">📋 修复建议：</h3>
                {warning['recommendation']}
            </div>
        </div>'''

        return html

    def _render_risk_bars(self, risk_summary: Dict) -> str:
        """渲染风险分布图"""
        total = risk_summary['total_packages'] or 1
        risk_dist = risk_summary.get('risk_distribution', {})

        html = ''
        for risk_level, label, color_class in [
            ('low', '低风险', 'risk-low'),
            ('medium', '中风险', 'risk-medium'),
            ('high', '高风险', 'risk-high')
        ]:
            count = risk_dist.get(risk_level, 0)
            percent = (count / total) * 100
            html += f'''
            <div class="risk-bar-item">
                <div class="risk-bar-label">
                    <span>{label}</span>
                    <span>{count} ({percent:.0f}%)</span>
                </div>
                <div class="risk-bar">
                    <div class="risk-bar-fill {color_class}" style="width: {percent}%;"></div>
                </div>
            </div>'''
        return html

    def _render_license_distribution(self, risk_summary: Dict) -> str:
        """渲染许可证分布"""
        colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
                  '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140']

        license_dist = risk_summary.get('license_distribution', {})
        html = ''
        for i, (license_id, count) in enumerate(license_dist.items()):
            color = colors[i % len(colors)]
            html += f'''
            <div class="license-dist-item">
                <div class="license-dist-color" style="background: {color};"></div>
                <span>{license_id}</span>
                <span style="color: #6b7280;">({count})</span>
            </div>'''
        return html

    def _render_issues_section(self, risk_summary: Dict) -> str:
        """渲染问题列表"""
        issues = risk_summary.get('issues', [])
        if not issues:
            return ''

        html = f'''
        <div class="section">
            <div class="section-header">
                <h2>⚠️ 合规性问题 <span class="count">{len(issues)}</span></h2>
            </div>
            <div class="section-body">
                <ul class="issues-list">'''

        for issue in issues:
            html += f'''
                    <li class="issue-item risk-{issue['risk']}">
                        <div class="issue-title">
                            <strong>{issue['package']}</strong>
                            <span class="license-badge" style="background: {self._get_risk_color(issue['risk'])};">
                                {issue['license']}
                            </span>
                            <span style="color: #6b7280; font-weight: normal;">v{issue['version']}</span>
                        </div>
                        <div class="issue-reason">{issue['reason']}</div>
                        <div style="margin-top: 5px;">
                            {self._render_status_badges(issue)}
                        </div>
                    </li>'''

        html += '''
                </ul>
            </div>
        </div>'''
        return html

    def _render_dependencies_table(self, deps: List[DependencyNode], title: str) -> str:
        """渲染完整的依赖表"""
        if not deps:
            return ''

        html = f'''
        <div class="section">
            <div class="section-header">
                <h2>📦 {title} <span class="count">{len(deps)}</span></h2>
            </div>
            <div class="section-body">
                <table>
                    <thead>
                        <tr>
                            <th>包名</th>
                            <th>版本</th>
                            <th>许可证</th>
                            <th>风险等级</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>'''

        for dep in sorted(deps, key=lambda x: x.name.lower()):
            license_info = dep.license or {}
            license_id = license_info.get('license_id', 'Unknown')
            risk_level = license_info.get('risk_level', 'high')
            risk_color = self._get_risk_color(risk_level)

            html += f'''
                        <tr>
                            <td><strong>{dep.name}</strong></td>
                            <td>{dep.version}</td>
                            <td><span class="license-badge" style="background: {risk_color};">{license_id}</span></td>
                            <td><span class="license-badge" style="background: {risk_color};">{self._get_risk_label(risk_level)}</span></td>
                            <td>{self._render_status_badges(dep.__dict__)}</td>
                            <td><span class="collapsible" style="color: #667eea; cursor: pointer;">详情 <span class="arrow">▶</span></span>
                                <div class="collapsible-content">
                                    {self._render_details_panel(dep)}
                                </div>
                            </td>
                        </tr>'''

        html += '''
                    </tbody>
                </table>
            </div>
        </div>'''
        return html

    def _render_simple_table(self, deps: List[DependencyNode], title: str, issue_type: str) -> str:
        """渲染简单的依赖表"""
        if not deps:
            return ''

        html = f'''
        <div class="section">
            <div class="section-header">
                <h2>🔍 {title} <span class="count">{len(deps)}</span></h2>
            </div>
            <div class="section-body">
                <table>
                    <thead>
                        <tr>
                            <th>包名</th>
                            <th>版本</th>
                            <th>许可证</th>
                            <th>风险等级</th>
                            <th>使用位置</th>
                        </tr>
                    </thead>
                    <tbody>'''

        for dep in sorted(deps, key=lambda x: x.name.lower()):
            license_info = dep.license or {}
            license_id = license_info.get('license_id', 'Unknown')
            risk_level = license_info.get('risk_level', 'high')
            risk_color = self._get_risk_color(risk_level)

            locations_html = self._render_file_locations(dep.used_in_files)

            html += f'''
                        <tr>
                            <td><strong>{dep.name}</strong></td>
                            <td>{dep.version}</td>
                            <td><span class="license-badge" style="background: {risk_color};">{license_id}</span></td>
                            <td><span class="license-badge" style="background: {risk_color};">{self._get_risk_label(risk_level)}</span></td>
                            <td>{locations_html}</td>
                        </tr>'''

        html += '''
                    </tbody>
                </table>
            </div>
        </div>'''
        return html

    def _render_stdlib_table(self, stdlib: List[DependencyNode]) -> str:
        """渲染标准库引用表"""
        if not stdlib:
            return ''

        html = f'''
        <div class="section">
            <div class="section-header">
                <h2>📚 引用的 Python 标准库 <span class="count">{len(stdlib)}</span></h2>
            </div>
            <div class="section-body">
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">'''

        for dep in sorted(stdlib, key=lambda x: x.name.lower()):
            html += f'''
                    <span style="background: #f3f4f6; padding: 6px 12px; border-radius: 6px; font-family: monospace;">
                        {dep.name}
                    </span>'''

        html += '''
                </div>
            </div>
        </div>'''
        return html

    def _render_details_panel(self, dep: DependencyNode) -> str:
        """渲染详情面板"""
        license_info = dep.license or {}
        sources = ', '.join(dep.sources) if dep.sources else 'N/A'

        permissions_html = ''
        for perm in license_info.get('permissions', []):
            permissions_html += f'<span class="perm-tag allow">✓ {perm}</span>'
        for cond in license_info.get('conditions', []):
            permissions_html += f'<span class="perm-tag require">⚡ {cond}</span>'
        for lim in license_info.get('limitations', []):
            permissions_html += f'<span class="perm-tag forbid">✗ {lim}</span>'

        locations_html = self._render_file_locations(dep.used_in_files)

        return f'''
        <div class="details-panel">
            <h4>许可证详情: {license_info.get('license_name', 'Unknown')}</h4>
            <p style="margin-bottom: 10px; color: #6b7280;">{license_info.get('description', '')}</p>
            <div class="permission-tags">{permissions_html}</div>

            <h4 style="margin-top: 15px;">来源信息</h4>
            <p>声明来源: {sources}</p>

            {f'<h4 style="margin-top: 15px;">使用位置</h4>{locations_html}' if dep.used_in_files else ''}

            {f'<h4 style="margin-top: 15px;">项目主页</h4><p><a href="{license_info.get("homepage", "#")}" target="_blank" style="color: #667eea;">{license_info.get("homepage", "N/A")}</a></p>' if license_info.get('homepage') else ''}
        </div>'''

    def _render_file_locations(self, locations: List[Dict]) -> str:
        """渲染文件位置列表"""
        if not locations:
            return '<span style="color: #9ca3af;">未使用</span>'

        html = '<div class="file-list">'
        for loc in locations[:10]:
            html += f'<span>{loc["file"]}:{loc["line"]}</span>'
        if len(locations) > 10:
            html += f'<span>... 还有 {len(locations) - 10} 处</span>'
        html += '</div>'
        return html

    def _render_status_badges(self, data: Dict) -> str:
        """渲染状态标签"""
        badges = []
        if data.get('is_optional'):
            badges.append('<span class="status-badge optional">可选</span>')
        if data.get('is_declared'):
            badges.append('<span class="status-badge declared">已声明</span>')
        if data.get('is_used'):
            badges.append('<span class="status-badge used">已使用</span>')
        if not data.get('is_declared') and not data.get('is_optional'):
            badges.append('<span class="status-badge undeclared">未声明</span>')
        if not data.get('is_used'):
            badges.append('<span class="status-badge unused">未使用</span>')
        return ' '.join(badges)

    def _get_risk_color(self, risk_level: str) -> str:
        colors = {'low': '#10b981', 'medium': '#f59e0b', 'high': '#ef4444', 'critical': '#991b1b'}
        return colors.get(risk_level, '#6b7280')

    def _get_risk_label(self, risk_level: str) -> str:
        labels = {'low': '低风险', 'medium': '中风险', 'high': '高风险', 'critical': '严重风险'}
        return labels.get(risk_level, '未知')
