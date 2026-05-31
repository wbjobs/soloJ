import ast
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple


@dataclass(unsafe_hash=True)
class FunctionInfo:
    name: str
    file: str
    start_line: int
    end_line: int
    is_method: bool = False
    class_name: Optional[str] = None
    calls: Set[str] = field(default_factory=set)
    called_by: Set[str] = field(default_factory=set)

    @property
    def full_name(self) -> str:
        if self.class_name:
            return f"{self.class_name}.{self.name}"
        return self.name

    @property
    def qualified_name(self) -> str:
        return f"{self.file}:{self.full_name}"


@dataclass
class ClassInfo:
    name: str
    file: str
    start_line: int
    end_line: int
    methods: Dict[str, FunctionInfo] = field(default_factory=dict)
    parent_classes: List[str] = field(default_factory=list)


@dataclass
class FileAnalysis:
    file: str
    functions: Dict[str, FunctionInfo] = field(default_factory=dict)
    classes: Dict[str, ClassInfo] = field(default_factory=dict)
    imports: Set[str] = field(default_factory=set)


class CallGraphVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.current_function: Optional[str] = None
        self.current_class: Optional[str] = None
        self.functions: Dict[str, FunctionInfo] = {}
        self.classes: Dict[str, ClassInfo] = {}
        self.imports: Set[str] = set()
        self._class_stack: List[str] = []

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module:
            self.imports.add(node.module)
            for alias in node.names:
                self.imports.add(f"{node.module}.{alias.name}")
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef):
        class_info = ClassInfo(
            name=node.name,
            file=self.file_path,
            start_line=node.lineno,
            end_line=getattr(node, "end_lineno", node.lineno),
            parent_classes=[b.id for b in node.bases if isinstance(b, ast.Name)],
        )
        self.classes[node.name] = class_info
        self._class_stack.append(node.name)
        old_class = self.current_class
        self.current_class = node.name
        self.generic_visit(node)
        self.current_class = old_class
        self._class_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._handle_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._handle_function(node)

    def _handle_function(self, node: ast.FunctionDef | ast.AsyncFunctionDef):
        is_method = len(self._class_stack) > 0
        func_info = FunctionInfo(
            name=node.name,
            file=self.file_path,
            start_line=node.lineno,
            end_line=getattr(node, "end_lineno", node.lineno),
            is_method=is_method,
            class_name=self._class_stack[-1] if is_method else None,
        )

        full_name = func_info.full_name
        self.functions[full_name] = func_info

        if is_method and self.current_class:
            self.classes[self.current_class].methods[node.name] = func_info

        old_function = self.current_function
        self.current_function = full_name
        self.generic_visit(node)
        self.current_function = old_function

    def visit_Call(self, node: ast.Call):
        func_name = self._get_call_name(node.func)
        if func_name and self.current_function:
            self.functions[self.current_function].calls.add(func_name)
        self.generic_visit(node)

    def _get_call_name(self, node: ast.expr) -> Optional[str]:
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            parts = []
            current = node
            while isinstance(current, ast.Attribute):
                parts.insert(0, current.attr)
                current = current.value
            if isinstance(current, ast.Name):
                parts.insert(0, current.id)
                return ".".join(parts)
            elif parts:
                return parts[-1]
        elif isinstance(node, ast.Call):
            return self._get_call_name(node.func)
        return None


class CallGraph:
    def __init__(self):
        self.files: Dict[str, FileAnalysis] = {}
        self.all_functions: Dict[str, FunctionInfo] = {}
        self.all_classes: Dict[str, ClassInfo] = {}

    def add_file(self, file_path: str, source_code: str) -> Optional[FileAnalysis]:
        try:
            tree = ast.parse(source_code)
        except SyntaxError:
            return None

        visitor = CallGraphVisitor(file_path)
        visitor.visit(tree)

        file_analysis = FileAnalysis(
            file=file_path,
            functions=visitor.functions,
            classes=visitor.classes,
            imports=visitor.imports,
        )

        self.files[file_path] = file_analysis

        for func_name, func in visitor.functions.items():
            qualified = f"{file_path}:{func_name}"
            self.all_functions[qualified] = func

        for class_name, cls in visitor.classes.items():
            qualified = f"{file_path}:{class_name}"
            self.all_classes[qualified] = cls

        return file_analysis

    def build_call_graph(self):
        for func_qname, func in self.all_functions.items():
            original_calls = list(func.calls)
            for called_name in original_calls:
                for target_qname, target_func in self.all_functions.items():
                    if (
                        called_name == target_func.full_name
                        or called_name.endswith(f".{target_func.name}")
                        or called_name == target_func.name
                    ):
                        func.calls.add(target_qname)
                        target_func.called_by.add(func_qname)

    def get_function_calls(self, func_qname: str) -> List[str]:
        if func_qname not in self.all_functions:
            return []
        return list(self.all_functions[func_qname].calls)

    def get_function_callers(self, func_qname: str) -> List[str]:
        if func_qname not in self.all_functions:
            return []
        return list(self.all_functions[func_qname].called_by)

    def get_call_chain(self, func_qname: str, max_depth: int = 5) -> Dict[str, List[str]]:
        if func_qname not in self.all_functions:
            return {}

        result = {"calls": [], "called_by": []}
        visited_calls = set()
        visited_callers = set()

        def _collect_calls(qname: str, depth: int):
            if depth > max_depth or qname in visited_calls:
                return
            visited_calls.add(qname)
            for call in self.get_function_calls(qname):
                if call not in visited_calls:
                    result["calls"].append(call)
                    _collect_calls(call, depth + 1)

        def _collect_callers(qname: str, depth: int):
            if depth > max_depth or qname in visited_callers:
                return
            visited_callers.add(qname)
            for caller in self.get_function_callers(qname):
                if caller not in visited_callers:
                    result["called_by"].append(caller)
                    _collect_callers(caller, depth + 1)

        _collect_calls(func_qname, 1)
        _collect_callers(func_qname, 1)
        return result

    def find_related_functions(
        self, keyword: str, file_filter: Optional[str] = None
    ) -> List[Tuple[str, FunctionInfo]]:
        results = []
        keyword_lower = keyword.lower()

        for qname, func in self.all_functions.items():
            if file_filter and not qname.startswith(file_filter):
                continue

            name_match = keyword_lower in func.name.lower()
            class_match = func.class_name and keyword_lower in func.class_name.lower()

            if name_match or class_match:
                results.append((qname, func))

        return results

    def get_function_info(self, qname: str) -> Optional[FunctionInfo]:
        return self.all_functions.get(qname)

    def summarize(self) -> Dict:
        return {
            "total_files": len(self.files),
            "total_functions": len(self.all_functions),
            "total_classes": len(self.all_classes),
            "files": list(self.files.keys()),
        }


def analyze_directory(directory: str | Path) -> CallGraph:
    graph = CallGraph()
    dir_path = Path(directory)

    for py_file in dir_path.rglob("*.py"):
        try:
            with open(py_file, "r", encoding="utf-8", errors="ignore") as f:
                source = f.read()
            rel_path = str(py_file.relative_to(dir_path)).replace("\\", "/")
            graph.add_file(rel_path, source)
        except Exception:
            continue

    graph.build_call_graph()
    return graph
