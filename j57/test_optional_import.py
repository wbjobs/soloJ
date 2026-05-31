"""测试可选导入（try/except块中的import）的检测"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanner.ast_scanner import ImportScanner
import ast


def test_detect_optional_import():
    """测试检测try/except块中的可选导入"""
    code = '''
import os
import sys

try:
    import numpy as np
    import pandas as pd
except ImportError:
    np = None
    pd = None

try:
    from lxml import etree
except ModuleNotFoundError:
    etree = None

def some_function():
    try:
        import cv2
    except:
        cv2 = None

import requests
'''

    tree = ast.parse(code)
    scanner = ImportScanner()
    scanner.visit(tree)

    print("=" * 60)
    print("测试1: 检测可选导入")
    print("=" * 60)

    imports_by_module = {}
    for imp in scanner.imports:
        module = imp['module']
        if module not in imports_by_module:
            imports_by_module[module] = []
        imports_by_module[module].append(imp)

    expected_optional = {'numpy', 'pandas', 'lxml', 'cv2'}
    expected_required = {'os', 'sys', 'requests'}

    for module, imps in imports_by_module.items():
        is_optional = all(imp.get('is_optional', False) for imp in imps)
        status = "可选" if is_optional else "必需"
        print(f"  {module}: {status} (行号: {[i['lineno'] for i in imps]})")

        if module in expected_optional:
            assert is_optional, f"错误: {module} 应该被标记为可选导入"
        if module in expected_required:
            assert not is_optional, f"错误: {module} 应该被标记为必需导入"

    print("\n✅ 测试1通过: 可选导入检测正确")


def test_mixed_imports():
    """测试同一个模块既有可选导入又有必需导入"""
    code = '''
import requests

def func1():
    try:
        import requests
    except ImportError:
        pass

def func2():
    import requests
'''

    tree = ast.parse(code)
    scanner = ImportScanner()
    scanner.visit(tree)

    print("\n" + "=" * 60)
    print("测试2: 混合导入检测")
    print("=" * 60)

    has_required = any(not imp.get('is_optional', False) for imp in scanner.imports)
    has_optional = any(imp.get('is_optional', False) for imp in scanner.imports)

    for imp in scanner.imports:
        status = "可选" if imp.get('is_optional') else "必需"
        print(f"  行 {imp['lineno']}: {status}")

    assert has_required, "错误: 应该检测到必需导入"
    assert has_optional, "错误: 应该检测到可选导入"

    print("\n✅ 测试2通过: 混合导入检测正确")


def test_nested_try():
    """测试嵌套try/except块中的导入"""
    code = '''
try:
    try:
        import deep_nested_lib
    except ImportError:
        deep_nested_lib = None
except Exception:
    pass
'''

    tree = ast.parse(code)
    scanner = ImportScanner()
    scanner.visit(tree)

    print("\n" + "=" * 60)
    print("测试3: 嵌套try/except块检测")
    print("=" * 60)

    for imp in scanner.imports:
        status = "可选" if imp.get('is_optional') else "必需"
        print(f"  {imp['module']}: {status}")
        assert imp.get('is_optional'), f"错误: {imp['module']} 应该被标记为可选导入"

    print("\n✅ 测试3通过: 嵌套try/except块检测正确")


def test_exception_types():
    """测试不同类型的异常处理"""
    code = '''
try:
    import lib1
except ImportError:
    pass

try:
    import lib2
except ModuleNotFoundError:
    pass

try:
    import lib3
except (ImportError, OSError):
    pass

try:
    import lib4
except Exception:
    pass

try:
    import lib5
except ValueError:
    pass
'''

    tree = ast.parse(code)
    scanner = ImportScanner()
    scanner.visit(tree)

    print("\n" + "=" * 60)
    print("测试4: 不同异常类型检测")
    print("=" * 60)

    for imp in scanner.imports:
        status = "可选" if imp.get('is_optional') else "必需"
        print(f"  {imp['module']}: {status}")

    results = {imp['module']: imp.get('is_optional', False) for imp in scanner.imports}

    assert results.get('lib1') == True, "ImportError 应该被识别"
    assert results.get('lib2') == True, "ModuleNotFoundError 应该被识别"
    assert results.get('lib3') == True, "元组异常应该被识别"
    assert results.get('lib4') == True, "Exception 应该被识别"
    assert results.get('lib5') == False, "ValueError 不应该被识别为导入异常"

    print("\n✅ 测试4通过: 不同异常类型检测正确")


if __name__ == '__main__':
    print("\n" + "#" * 60)
    print("#   Python 依赖许可证扫描器 - 可选导入测试")
    print("#" * 60 + "\n")

    try:
        test_detect_optional_import()
        test_mixed_imports()
        test_nested_try()
        test_exception_types()

        print("\n" + "=" * 60)
        print("🎉 所有测试通过!")
        print("=" * 60 + "\n")
        sys.exit(0)
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"\n❌ 测试出错: {e}")
        sys.exit(1)
