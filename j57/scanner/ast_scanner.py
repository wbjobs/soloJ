"""使用 AST 扫描 Python 源码文件中的 import 语句"""

import ast
import os
from typing import Dict, List, Set, Tuple, Optional


class ImportScanner(ast.NodeVisitor):
    """AST 访问者，用于提取 import 语句"""

    IMPORT_ERROR_EXCEPTIONS = {
        'ImportError',
        'ModuleNotFoundError',
        'Exception',
        'OSError'
    }

    def __init__(self):
        self.imports: List[Dict] = []
        self._try_stack: List[bool] = []
        self._in_optional_import_block: bool = False

    def _is_in_try_except(self) -> bool:
        """判断当前是否在 try/except 块中"""
        return len(self._try_stack) > 0 and any(self._try_stack)

    def _check_exception_handles_import_error(self, handler: ast.ExceptHandler) -> bool:
        """检查异常处理器是否处理导入相关错误"""
        if handler.type is None:
            return True

        if isinstance(handler.type, ast.Name):
            return handler.type.id in self.IMPORT_ERROR_EXCEPTIONS
        elif isinstance(handler.type, ast.Tuple):
            for elt in handler.type.elts:
                if isinstance(elt, ast.Name) and elt.id in self.IMPORT_ERROR_EXCEPTIONS:
                    return True
        return False

    def visit_Try(self, node: ast.Try) -> None:
        """处理 try/except 块"""
        handles_import_error = any(
            self._check_exception_handles_import_error(handler)
            for handler in node.handlers
        )

        self._try_stack.append(handles_import_error)
        try:
            for stmt in node.body:
                self.visit(stmt)
        finally:
            self._try_stack.pop()

        for handler in node.handlers:
            self.visit(handler)
        for stmt in node.orelse:
            self.visit(stmt)
        for stmt in node.finalbody:
            self.visit(stmt)

    def visit_Import(self, node: ast.Import) -> None:
        """处理 import xxx 语句"""
        is_optional = self._is_in_try_except()

        for alias in node.names:
            self.imports.append({
                'module': alias.name,
                'alias': alias.asname,
                'type': 'import',
                'lineno': node.lineno,
                'is_optional': is_optional
            })
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        """处理 from xxx import yyy 语句"""
        if node.module is None:
            return

        is_optional = self._is_in_try_except()

        module_parts = []
        if node.level > 0:
            module_parts.append('.' * node.level)
        module_parts.append(node.module)
        module_path = ''.join(module_parts)

        for alias in node.names:
            self.imports.append({
                'module': module_path,
                'name': alias.name,
                'alias': alias.asname,
                'type': 'from-import',
                'lineno': node.lineno,
                'is_optional': is_optional
            })
        self.generic_visit(node)


class ASTSourceScanner:
    """扫描目录中所有 .py 文件，提取 import 语句"""

    STDLIB = {
        'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio',
        'asyncore', 'atexit', 'audioop', 'base64', 'bdb', 'binascii',
        'binhex', 'bisect', 'builtins', 'bz2', 'cProfile', 'calendar',
        'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code', 'codecs',
        'codeop', 'collections', 'colorsys', 'compileall', 'concurrent',
        'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
        'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses',
        'datetime', 'dbm', 'decimal', 'difflib', 'dis', 'distutils',
        'doctest', 'email', 'encodings', 'enum', 'errno', 'faulthandler',
        'fcntl', 'filecmp', 'fileinput', 'fnmatch', 'formatter', 'fpectl',
        'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass',
        'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq',
        'hmac', 'html', 'http', 'imaplib', 'imghdr', 'importlib', 'imp',
        'inspect', 'io', 'ipaddress', 'itertools', 'json', 'keyword',
        'lib2to3', 'linecache', 'locale', 'logging', 'lzma', 'mailbox',
        'mailcap', 'marshal', 'math', 'mimetypes', 'mmap', 'modulefinder',
        'msilib', 'msvcrt', 'multiprocessing', 'netrc', 'nis', 'nntplib',
        'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
        'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
        'plistlib', 'poplib', 'posix', 'pprint', 'profile', 'pstats',
        'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri',
        'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter',
        'runpy', 'sched', 'secrets', 'select', 'selectors', 'shelve',
        'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib', 'sndhdr',
        'socket', 'socketserver', 'spwd', 'sqlite3', 'ssl', 'stat',
        'statistics', 'string', 'stringprep', 'struct', 'subprocess',
        'sunau', 'symbol', 'symtable', 'sys', 'sysconfig', 'syslog',
        'tabnanny', 'tarfile', 'telnetlib', 'tempfile', 'termios', 'test',
        'textwrap', 'threading', 'time', 'timeit', 'tkinter', 'token',
        'tokenize', 'trace', 'traceback', 'tracemalloc', 'tty', 'turtle',
        'turtledemo', 'types', 'typing', 'unicodedata', 'unittest',
        'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref',
        'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml',
        'xmlrpc', 'zipapp', 'zipfile', 'zipimport', 'zlib',
    }

    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.results: Dict[str, List[Dict]] = {}
        self.all_imports: Set[str] = set()
        self.third_party_imports: Set[str] = set()
        self.standard_imports: Set[str] = set()
        self.relative_imports: Set[str] = set()
        self.internal_modules: Set[str] = set()
        self._discover_internal_modules()

    def scan(self) -> Dict[str, List[Dict]]:
        """扫描目录下所有 .py 文件"""
        for dirpath, dirnames, filenames in os.walk(self.root_dir):
            if '.git' in dirnames:
                dirnames.remove('.git')
            if '__pycache__' in dirnames:
                dirnames.remove('__pycache__')
            if 'venv' in dirnames or '.venv' in dirnames:
                dirnames.remove('venv') if 'venv' in dirnames else None
                dirnames.remove('.venv') if '.venv' in dirnames else None

            for filename in filenames:
                if filename.endswith('.py'):
                    filepath = os.path.join(dirpath, filename)
                    self._scan_file(filepath)

        self._categorize_imports()
        return self.results

    def _scan_file(self, filepath: str) -> None:
        """扫描单个 .py 文件"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                source = f.read()

            tree = ast.parse(source, filename=filepath)
            scanner = ImportScanner()
            scanner.visit(tree)

            rel_path = os.path.relpath(filepath, self.root_dir)
            self.results[rel_path] = scanner.imports

            for imp in scanner.imports:
                self.all_imports.add(imp['module'])

        except (SyntaxError, UnicodeDecodeError) as e:
            print(f"警告: 无法解析 {filepath}: {e}")

    def _discover_internal_modules(self) -> None:
        """发现项目内部的 Python 模块"""
        for dirpath, dirnames, filenames in os.walk(self.root_dir):
            if '.git' in dirnames:
                dirnames.remove('.git')
            if '__pycache__' in dirnames:
                dirnames.remove('__pycache__')
            if 'venv' in dirnames or '.venv' in dirnames:
                dirnames.remove('venv') if 'venv' in dirnames else None
                dirnames.remove('.venv') if '.venv' in dirnames else None

            rel_dir = os.path.relpath(dirpath, self.root_dir)
            if rel_dir == '.':
                module_prefix = ''
            else:
                module_prefix = rel_dir.replace(os.sep, '.') + '.'

            for filename in filenames:
                if filename.endswith('.py'):
                    module_name = filename[:-3]
                    if module_name == '__init__':
                        if module_prefix:
                            self.internal_modules.add(module_prefix.rstrip('.'))
                    else:
                        full_module = module_prefix + module_name
                        self.internal_modules.add(full_module)

            for dirname in dirnames:
                init_file = os.path.join(dirpath, dirname, '__init__.py')
                if os.path.exists(init_file):
                    if module_prefix:
                        self.internal_modules.add(module_prefix + dirname)
                    else:
                        self.internal_modules.add(dirname)

    def _categorize_imports(self) -> None:
        """将导入分类为标准库、第三方和相对导入"""
        for imp_module in self.all_imports:
            if imp_module.startswith('.'):
                self.relative_imports.add(imp_module)
                continue

            top_level = imp_module.split('.')[0]

            if top_level in self.internal_modules:
                continue

            if top_level in self.STDLIB:
                self.standard_imports.add(imp_module)
            else:
                self.third_party_imports.add(imp_module)

    def get_import_locations(self) -> Dict[str, List[Dict]]:
        """获取每个第三方库在文件中的使用位置"""
        locations: Dict[str, List[Dict]] = {}

        for filepath, imports in self.results.items():
            for imp in imports:
                module = imp['module']
                if module.startswith('.'):
                    continue
                top_level = module.split('.')[0]
                if top_level in self.STDLIB:
                    continue
                if top_level in self.internal_modules:
                    continue

                if top_level not in locations:
                    locations[top_level] = []
                locations[top_level].append({
                    'file': filepath,
                    'line': imp['lineno'],
                    'import_type': imp['type'],
                    'full_module': module,
                    'is_optional': imp.get('is_optional', False)
                })

        return locations

    def has_required_import(self, module_name: str) -> bool:
        """检查模块是否有必需的导入（非可选导入）"""
        for filepath, imports in self.results.items():
            for imp in imports:
                module = imp['module']
                if module.startswith('.'):
                    continue
                top_level = module.split('.')[0]
                if top_level == module_name and not imp.get('is_optional', False):
                    return True
        return False

    def get_required_imports(self) -> Set[str]:
        """获取所有必需的导入集合"""
        required = set()
        for filepath, imports in self.results.items():
            for imp in imports:
                module = imp['module']
                if module.startswith('.'):
                    continue
                top_level = module.split('.')[0]
                if top_level in self.STDLIB:
                    continue
                if top_level in self.internal_modules:
                    continue
                if not imp.get('is_optional', False):
                    required.add(top_level)
        return required

    def get_optional_imports(self) -> Set[str]:
        """获取所有可选的导入集合"""
        optional = set()
        for filepath, imports in self.results.items():
            for imp in imports:
                module = imp['module']
                if module.startswith('.'):
                    continue
                top_level = module.split('.')[0]
                if top_level in self.STDLIB:
                    continue
                if top_level in self.internal_modules:
                    continue
                if imp.get('is_optional', False):
                    optional.add(top_level)
        return optional

    def get_stdlib_locations(self) -> Dict[str, List[Dict]]:
        """获取每个标准库在文件中的使用位置"""
        locations: Dict[str, List[Dict]] = {}

        for filepath, imports in self.results.items():
            for imp in imports:
                module = imp['module']
                if module.startswith('.'):
                    continue
                top_level = module.split('.')[0]
                if top_level not in self.STDLIB:
                    continue

                if top_level not in locations:
                    locations[top_level] = []
                locations[top_level].append({
                    'file': filepath,
                    'line': imp['lineno'],
                    'import_type': imp['type'],
                    'full_module': module
                })

        return locations
