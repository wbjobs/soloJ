#!/usr/bin/env python3
"""Python 依赖许可证扫描器 - 命令行入口"""

import os
import sys
import argparse
import json
from typing import Dict, List

from scanner.dependency_tree import DependencyTree
from scanner.license_checker import LicenseAPI, LicenseChecker
from scanner.report_generator import HTMLReportGenerator


def print_banner():
    """打印程序横幅"""
    banner = '''
╔══════════════════════════════════════════════════════════════╗
║                Python 依赖许可证扫描器                        ║
║              Python License Compliance Scanner                ║
║                                                               ║
║  解析 requirements.txt / pyproject.toml                       ║
║  扫描 .py 源码 import 语句                                    ║
║  构建完整依赖树并检查许可证合规性                              ║
╚══════════════════════════════════════════════════════════════╝
    '''
    print(banner)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='Python 依赖许可证合规性扫描器',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        'project_path',
        nargs='?',
        default='.',
        help='要扫描的项目目录路径 (默认: 当前目录)'
    )

    parser.add_argument(
        '-o', '--output',
        default=None,
        help='输出报告目录 (默认: 当前目录)'
    )

    parser.add_argument(
        '-f', '--format',
        choices=['html', 'json', 'both'],
        default='html',
        help='输出报告格式 (默认: html)'
    )

    parser.add_argument(
        '--license-data',
        default=None,
        help='自定义许可证数据文件路径'
    )

    parser.add_argument(
        '--show-tree',
        action='store_true',
        help='在控制台打印依赖树'
    )

    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='显示详细扫描过程'
    )

    parser.add_argument(
        '--ci',
        action='store_true',
        help='CI/CD 模式: 输出 JSON 结果到 stdout，退出码表示合规状态 (0=通过, 2=高风险, 3=许可证污染)'
    )

    parser.add_argument(
        '--fail-on',
        default=None,
        help='指定失败条件: contamination(许可证污染), high(高风险), medium(中风险)'
    )

    args = parser.parse_args()

    if not args.ci:
        print_banner()

    project_path = os.path.abspath(args.project_path)

    if not os.path.exists(project_path):
        print(f"❌ 错误: 项目路径不存在: {project_path}")
        sys.exit(1)

    if not os.path.isdir(project_path):
        print(f"❌ 错误: 路径不是目录: {project_path}")
        sys.exit(1)

    if not args.ci:
        print(f"📂 扫描项目: {project_path}")
        print("=" * 70)

    try:
        ci = args.ci

        if not ci:
            print("\n[1/5] 🔍 初始化许可证 API...")
        license_api = LicenseAPI(args.license_data) if args.license_data else LicenseAPI()
        if not ci and args.verbose:
            print(f"   - 许可证数据加载完成，共 {len(license_api.packages_data)} 个包信息")

        if not ci:
            print(f"\n[2/5] 📝 解析依赖声明文件并扫描源码...")
        dep_tree = DependencyTree(project_path, license_api)
        nodes = dep_tree.build()
        dep_summary = dep_tree.summary()

        if not ci and args.verbose:
            print(f"   - 解析 requirements.txt 完成")
            print(f"   - 解析 pyproject.toml 完成")

        if not ci:
            print(f"\n[3/5] 🌳 构建依赖树...")
            print(f"   - 第三方依赖: {dep_summary['total_dependencies']} 个")
            print(f"   - 已声明: {dep_summary['declared_count']} 个")
            print(f"   - 实际使用: {dep_summary['used_count']} 个")
            print(f"   - 未声明: {dep_summary['undeclared_count']} 个")
            print(f"   - 可选依赖: {dep_summary['optional_count']} 个")
            print(f"   - 未使用: {dep_summary['unused_count']} 个")
            print(f"   - 标准库: {dep_summary['standard_library_count']} 个")

            print(f"\n[4/5] 📜 查询许可证信息...")
        license_checker = LicenseChecker(license_api)
        nodes = license_checker.check_dependencies(nodes)

        risk_summary = license_checker.get_risk_summary()

        if not ci:
            print(f"   - 整体风险等级: {risk_summary['overall_risk_label']}")
            print(f"   - 低风险: {risk_summary['risk_distribution'].get('low', 0)} 个")
            print(f"   - 中风险: {risk_summary['risk_distribution'].get('medium', 0)} 个")
            print(f"   - 高风险: {risk_summary['risk_distribution'].get('high', 0)} 个")

            if risk_summary.get('has_contamination'):
                print(f"\n   🚨 许可证污染警告!")
                print(f"   项目中同时存在 GPL 和闭源/商业许可证的库，存在许可证兼容性冲突!")
                for warning in risk_summary.get('contamination_warnings', []):
                    print(f"   - GPL 库: {', '.join(p['name'] for p in warning['copyleft_packages'])}")
                    print(f"   - 闭源/商业库: {', '.join(p['name'] for p in warning['proprietary_packages'])}")
                    for pair in warning.get('conflict_pairs', []):
                        print(f"   ⚡ {pair['reason']}")

            issues = risk_summary.get('issues', [])
            if issues:
                print(f"\n   ⚠️  发现 {len(issues)} 个合规性问题:")
                for issue in issues[:5]:
                    risk_icon = {'low': '🟢', 'medium': '🟡', 'high': '🔴', 'critical': '🚨'}.get(issue['risk'], '⚪')
                    print(f"   {risk_icon} {issue['package']} ({issue['license']}): {issue['reason']}")
                if len(issues) > 5:
                    print(f"   ... 还有 {len(issues) - 5} 个问题")

            print(f"\n[5/5] 📊 生成合规性报告...")

        if ci:
            json_data = _generate_json_report(dep_tree, license_checker)
            print(json.dumps(json_data, ensure_ascii=False, indent=2))
        else:
            output_dir = os.path.abspath(args.output) if args.output else os.getcwd()
            report_gen = HTMLReportGenerator(output_dir)

            output_files = []

            if args.format in ['html', 'both']:
                html_path = report_gen.generate(dep_tree, license_checker)
                output_files.append(html_path)
                print(f"   - HTML 报告已生成: {html_path}")

            if args.format in ['json', 'both']:
                json_data = _generate_json_report(dep_tree, license_checker)
                json_path = os.path.join(output_dir, f'license_compliance_report_{_get_timestamp()}.json')
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(json_data, f, ensure_ascii=False, indent=2)
                output_files.append(json_path)
                print(f"   - JSON 报告已生成: {json_path}")

            if args.show_tree:
                _print_dependency_tree(dep_tree, license_checker)

            print("\n" + "=" * 70)
            print("✅ 扫描完成!")
            print(f"\n📄 生成的报告文件:")
            for f in output_files:
                print(f"   - {f}")

        exit_code = _calculate_exit_code(risk_summary, args.fail_on)

        if not ci:
            if risk_summary.get('has_contamination'):
                print("\n🚨 严重警告: 检测到许可证污染! GPL 与闭源/商业许可证共存，存在法律风险!")
                print(f"   退出码: {exit_code} (许可证污染)")
            elif risk_summary['overall_risk'] == 'high':
                print("\n⚠️  警告: 检测到高风险许可证，请仔细审查!")
                print(f"   退出码: {exit_code} (高风险)")
            elif risk_summary['overall_risk'] == 'medium':
                print("\n⚡ 提示: 存在中等风险项，建议关注。")
                print(f"   退出码: {exit_code} (通过)")
            else:
                print("\n✅ 所有依赖许可证风险评估通过。")
                print(f"   退出码: {exit_code} (通过)")

        sys.exit(exit_code)

    except Exception as e:
        if args.ci:
            error_json = {
                'ci': {'passed': False, 'exit_code': 1, 'summary_message': f'ERROR: {str(e)}'},
                'error': str(e)
            }
            print(json.dumps(error_json, ensure_ascii=False, indent=2))
        else:
            print(f"\n❌ 扫描过程中发生错误: {e}")
            if args.verbose:
                import traceback
                traceback.print_exc()
        sys.exit(1)


def _get_scanner_results(dep_tree: DependencyTree):
    """获取扫描结果的辅助函数"""
    from scanner.ast_scanner import ASTSourceScanner
    scanner = ASTSourceScanner(dep_tree.project_root)
    scanner.scan()
    return scanner.results.items()


def _calculate_exit_code(risk_summary: Dict, fail_on: str = None) -> int:
    """根据风险摘要和 --fail-on 参数计算退出码"""
    has_contamination = risk_summary.get('has_contamination', False)
    overall_risk = risk_summary.get('overall_risk', 'low')

    if fail_on == 'contamination':
        return 3 if has_contamination else 0
    elif fail_on == 'high':
        if has_contamination:
            return 3
        if overall_risk == 'high':
            return 2
        return 0
    elif fail_on == 'medium':
        if has_contamination:
            return 3
        if overall_risk in ('high', 'medium'):
            return 2
        return 0

    if has_contamination:
        return 3
    if overall_risk == 'high':
        return 2
    return 0


def _get_timestamp() -> str:
    """生成时间戳"""
    from datetime import datetime
    return datetime.now().strftime('%Y%m%d_%H%M%S')


def _generate_json_report(dep_tree: DependencyTree, license_checker: LicenseChecker) -> Dict:
    """生成 JSON 格式报告 - 含 CI/CD 集成字段"""
    third_party = dep_tree.get_third_party_dependencies()
    risk_summary = license_checker.get_risk_summary()

    dependencies = []
    for dep in sorted(third_party, key=lambda x: x.name.lower()):
        dependencies.append({
            **dep.to_dict(),
            'license': dep.license
        })

    contamination_warnings = risk_summary.get('contamination_warnings', [])
    has_contamination = risk_summary.get('has_contamination', False)
    overall_risk = risk_summary.get('overall_risk', 'low')

    ci_passed = overall_risk in ('low', 'medium')
    ci_exit_code = 0 if ci_passed else (3 if has_contamination else 2)

    return {
        'metadata': {
            'project_path': dep_tree.project_root,
            'generated_at': _get_timestamp(),
            'scanner_version': '1.0.0'
        },
        'ci': {
            'passed': ci_passed,
            'exit_code': ci_exit_code,
            'overall_risk': overall_risk,
            'has_contamination': has_contamination,
            'has_high_risk': risk_summary.get('risk_distribution', {}).get('high', 0) > 0,
            'has_critical_risk': overall_risk == 'critical',
            'total_issues': len(risk_summary.get('issues', [])),
            'high_risk_count': risk_summary.get('risk_distribution', {}).get('high', 0),
            'medium_risk_count': risk_summary.get('risk_distribution', {}).get('medium', 0),
            'contamination_count': len(contamination_warnings),
            'summary_message': _generate_ci_summary(risk_summary)
        },
        'summary': {
            'dependency_summary': dep_tree.summary(),
            'risk_summary': risk_summary
        },
        'contamination_warnings': contamination_warnings,
        'dependencies': dependencies,
        'undeclared': [n.to_dict() for n in dep_tree.get_undeclared_dependencies()],
        'optional': [n.to_dict() for n in dep_tree.get_optional_dependencies()],
        'unused': [n.to_dict() for n in dep_tree.get_unused_dependencies()],
        'standard_libraries': [n.name for n in dep_tree.get_standard_libraries()]
    }


def _generate_ci_summary(risk_summary: Dict) -> str:
    """生成 CI/CD 摘要消息"""
    if risk_summary.get('has_contamination'):
        return 'FAIL: 检测到许可证污染 - GPL 与闭源/商业许可证共存'
    if risk_summary.get('overall_risk') == 'high':
        return 'FAIL: 检测到高风险许可证，请审查'
    if risk_summary.get('overall_risk') == 'medium':
        return 'WARN: 存在中等风险许可证，建议关注'
    return 'PASS: 所有依赖许可证合规'


def _print_dependency_tree(dep_tree: DependencyTree, license_checker: LicenseChecker) -> None:
    """在控制台打印依赖树"""
    print("\n" + "=" * 70)
    print("🌳 依赖树详情")
    print("=" * 70)

    third_party = dep_tree.get_third_party_dependencies()
    for dep in sorted(third_party, key=lambda x: x.name.lower()):
        license_info = dep.license or {}
        risk_color = {
            'low': '\033[92m',
            'medium': '\033[93m',
            'high': '\033[91m'
        }.get(license_info.get('risk_level', 'high'), '\033[0m')
        reset = '\033[0m'

        status = []
        if dep.is_declared:
            status.append("已声明")
        if dep.is_used:
            status.append("已使用")

        print(f"\n📦 {dep.name} ({dep.version})")
        print(f"   许可证: {risk_color}{license_info.get('license_id', 'Unknown')}{reset}")
        print(f"   风险等级: {risk_color}{license_info.get('risk_level', 'unknown')}{reset}")
        print(f"   状态: {', '.join(status)}")
        if dep.sources:
            print(f"   来源: {', '.join(dep.sources)}")
        if dep.used_in_files:
            print(f"   使用位置: {len(dep.used_in_files)} 处")
            for loc in dep.used_in_files[:3]:
                print(f"     - {loc['file']}:{loc['line']}")


if __name__ == '__main__':
    main()
