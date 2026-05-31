import re
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

import sympy as sp

try:
    from importlib.metadata import version as _pkg_version
    _antlr_v = _pkg_version("antlr4-python3-runtime")
    if not _antlr_v.startswith("4.11"):
        import sympy.parsing.latex._parse_latex_antlr as _latex_antlr_mod
        _orig_version = getattr(_latex_antlr_mod, "version", None) or _pkg_version
        _latex_antlr_mod.version = lambda pkg: "4.11.1" if pkg == "antlr4-python3-runtime" else _orig_version(pkg)
except Exception:
    pass

from sympy.parsing.latex import parse_latex


LATEX_TO_SYMPY = {
    r"\dfrac": "frac",
    r"\tfrac": "frac",
    r"\ln": "log",
    r"\operatorname{ln}": "log",
    r"\operatorname": "",
    r"\,": "",
    r"\;": "",
    r"\!": "",
    r"\left": "",
    r"\right": "",
    r"\big": "",
    r"\Big": "",
    r"\bigg": "",
    r"\Bigg": "",
    r"\times": "*",
    r"\cdot": "*",
    r"\div": "/",
    r"\sqrt": "sqrt",
    r"\exp": "exp",
    r"\sin": "sin",
    r"\cos": "cos",
    r"\tan": "tan",
    r"\cot": "cot",
    r"\sec": "sec",
    r"\csc": "csc",
    r"\arcsin": "asin",
    r"\arccos": "acos",
    r"\arctan": "atan",
    r"\sinh": "sinh",
    r"\cosh": "cosh",
    r"\tanh": "tanh",
    r"\pi": "pi",
    r"\Pi": "pi",
    r"\e": "E",
    r"\infty": "oo",
    r"\partial": "",
    r"\mathrm": "",
    r"\rm": "",
    r"\Delta": "Delta",
    r"\delta": "delta",
    r"\alpha": "alpha",
    r"\beta": "beta",
    r"\gamma": "gamma",
    r"\epsilon": "epsilon",
    r"\varepsilon": "varepsilon",
    r"\theta": "theta",
    r"\mu": "mu",
    r"\lambda": "lambda",
    r"\sigma": "sigma",
    r"\omega": "omega",
    r"\Omega": "Omega",
    r"\phi": "phi",
    r"\varphi": "phi",
}


def _preprocess_latex(latex: str) -> str:
    s = latex.strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\$", "", s)
    for k, v in LATEX_TO_SYMPY.items():
        s = s.replace(k, v)
    s = re.sub(r"\\mathrm\{([^}]*)\}", r"\1", s)
    s = re.sub(r"\\operatorname\{([^}]*)\}", r"\1", s)
    s = re.sub(r"([a-zA-Z])_([a-zA-Z0-9]+)", r"\1_\2", s)
    return s


def _preprocess_sympy(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", "", s)
    s = _replace_derivatives(s)
    s = _wrap_bare_functions(s)
    s = s.replace("^", "**")
    s = s.replace("·", "*")
    return s


def _replace_derivatives(s: str) -> str:
    """
    Convert y', y'', y''' or y^(3) to D(y(x), x[, n]) style for SymPy.
    Must be applied BEFORE any ^ -> ** replacement.

    The SymPy local_dict defines D as Derivative and y as Function('y'),
    so 'D(y(x), x)' evaluates cleanly via sympify.
    """
    s = re.sub(r"(\w)\^{?\((\d+)\)}?", r"D(\1(x), x, \2)", s)
    s = re.sub(r"(\w)'''", r"D(\1(x), x, 3)", s)
    s = re.sub(r"(\w)''", r"D(\1(x), x, 2)", s)
    s = re.sub(r"(\w)'", r"D(\1(x), x)", s)
    return s


_DEFAULT_FUNCS = ("y", "f", "u", "v", "Y", "p", "q")


def _wrap_bare_functions(s: str, funcs=_DEFAULT_FUNCS) -> str:
    """
    Wrap bare function names with (x) so that sympify can evaluate them
    as Function instances. E.g. 'y' -> 'y(x)'; but 'y(x)' is preserved.
    """
    for name in funcs:
        pat = re.compile(rf"(?<![A-Za-z0-9_]){name}(?![A-Za-z0-9_(])")
        s = pat.sub(f"{name}(x)", s)
    return s


@dataclass
class ODEInput:
    raw_latex: str
    raw_sympy: str
    lhs: sp.Expr
    rhs: sp.Expr
    eq: sp.Equality
    func: sp.Function
    var: sp.Symbol
    order: int
    highest_derivative: sp.Derivative
    free_params: List[sp.Symbol] = field(default_factory=list)
    parsing_steps: List[str] = field(default_factory=list)


def _find_function_and_variable(expr: sp.Expr):
    funcs = list(expr.atoms(sp.Function))
    if not funcs:
        raise ValueError("未找到任何函数表达式，例如 y(x)")
    excluded_names = {"exp", "log", "ln", "sin", "cos", "tan", "cot", "sec", "csc",
                      "asin", "acos", "atan", "sinh", "cosh", "tanh", "Abs",
                      "sqrt", "ceiling", "floor", "sign", "re", "im", "arg",
                      "factorial", "gamma"}
    user_funcs = []
    for f in funcs:
        try:
            name = f.func.__name__
        except AttributeError:
            name = str(f.func)
        if name not in excluded_names:
            user_funcs.append(f)
    if not user_funcs:
        raise ValueError("未识别到用户定义的函数（如 y, f 等）")
    f = user_funcs[0]
    func_class = f.func
    args = f.args
    if not args:
        raise ValueError("函数参数为空")
    var = args[0]
    if not isinstance(var, sp.Symbol):
        var = sp.Symbol(str(var))
    return func_class, var


def _parse_derivative(expr: sp.Expr, func_class, var):
    ders = list(expr.atoms(sp.Derivative))
    order = 0
    highest = None
    if ders:
        for d in ders:
            d_expr = d
            try:
                o = d_expr.derivative_count
            except AttributeError:
                o = len(d_expr.variables)
            if o > order:
                order = o
                highest = d_expr
    if order == 0:
        highest = sp.Derivative(func_class(var), var)
        order = 1
    return order, highest


def parse_ode(input_str: str, format_hint: Optional[str] = None) -> ODEInput:
    """
    Parse an ODE from either LaTeX or sympy-like string.

    Supported forms:
        - "y'' + y = 0"  (sympy-like)
        - r"\frac{d^2 y}{d x^2} + y = 0"  (latex)
        - "y' = x + y"
    """
    if not input_str or not input_str.strip():
        raise ValueError("输入为空")

    steps = []
    s = input_str.strip()

    is_latex = format_hint == "latex" or "\\" in s or "frac" in s or "dfrac" in s

    if "=" in s:
        left, right = s.split("=", 1)
    else:
        left, right = s, "0"

    expr = None
    if is_latex:
        try:
            left_expr = parse_latex(_preprocess_latex(left))
            right_expr = parse_latex(_preprocess_latex(right))
            expr = sp.Eq(left_expr, right_expr)
            steps.append("已使用 LaTeX 解析器解析输入方程")
        except Exception as e:
            raise ValueError(f"LaTeX 解析失败: {e}")
    else:
        try:
            local_dict = {
                "y": sp.Function("y"), "f": sp.Function("f"),
                "u": sp.Function("u"), "v": sp.Function("v"),
                "Y": sp.Function("Y"), "p": sp.Function("p"),
                "q": sp.Function("q"),
                "x": sp.Symbol("x"), "t": sp.Symbol("t"),
                "e": sp.E, "D": sp.Derivative,
            }
            left_expr = sp.sympify(_preprocess_sympy(left), locals=local_dict)
            right_expr = sp.sympify(_preprocess_sympy(right), locals=local_dict)
            expr = sp.Eq(left_expr, right_expr)
            steps.append("已使用 SymPy 解析器解析输入方程")
        except Exception as e:
            raise ValueError(f"表达式解析失败: {e}")

    if expr is None:
        raise ValueError("解析失败")

    if isinstance(expr, sp.Equality):
        lhs = expr.lhs
        rhs = expr.rhs
    else:
        lhs = expr
        rhs = sp.S.Zero
        steps.append("输入不是等式，已默认右侧为 0")

    func_class, var = _find_function_and_variable(lhs - rhs)
    order, highest = _parse_derivative(lhs - rhs, func_class, var)

    steps.append(f"识别到未知函数: {func_class.__name__}({var})")
    steps.append(f"识别到自变量: {var}")
    steps.append(f"方程阶数: {order}")

    combined = lhs - rhs
    free_syms = []
    for sym in combined.free_symbols:
        if sym == var:
            continue
        if str(sym) in ("E", "pi", "oo", "zoo", "nan"):
            continue
        free_syms.append(sym)
    user_syms = free_syms
    return ODEInput(
        raw_latex=input_str if is_latex else "",
        raw_sympy=input_str if not is_latex else "",
        lhs=lhs,
        rhs=rhs,
        eq=sp.Eq(lhs, rhs),
        func=func_class,
        var=var,
        order=order,
        highest_derivative=highest,
        free_params=user_syms,
        parsing_steps=steps,
    )


def normalize_ode(ode_input: ODEInput) -> Tuple[sp.Expr, List[str]]:
    """
    Move all terms to LHS, make highest derivative have coefficient 1 if possible.
    Returns (normalized_expr, steps) where normalized_expr is of form y^{(n)} - F(x, y, y', ...) = 0.

    Note: We avoid full simplify() here because it can be extremely slow on large expressions.
    """
    steps = []
    f = ode_input.func
    x = ode_input.var
    combined = sp.nsimplify(ode_input.lhs - ode_input.rhs) if hasattr(sp, "nsimplify") else sp.expand(ode_input.lhs - ode_input.rhs)
    steps.append(f"移项合并得: ${sp.latex(combined)} = 0$")

    if ode_input.order > 0 and ode_input.highest_derivative is not None:
        y_n = ode_input.highest_derivative
        coeff = sp.expand(combined).coeff(y_n)
        if coeff != 0 and coeff != 1:
            combined = sp.expand(combined / coeff)
            steps.append(f"将最高阶导数系数化为 1: ${sp.latex(combined)} = 0$")

    return combined, steps
