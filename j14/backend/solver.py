from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

import sympy as sp

from .parser import ODEInput, normalize_ode
from .matchers import classify_ode, ODEType


@dataclass
class SolveStep:
    title: str
    description: str
    math: Optional[str] = None
    order: int = 0


@dataclass
class SolveResult:
    ode_input: ODEInput
    normalized_expr: sp.Expr
    matched_types: List[ODEType]
    primary_type: Optional[ODEType]
    general_solutions: List[sp.Expr]
    particular_solutions: List[sp.Expr]
    steps: List[SolveStep]
    raw_sol: Any
    status: str
    error: Optional[str] = None
    numerical_comparison: Optional[Any] = None


def _mk_step(title: str, description: str, math: Optional[str] = None, order: int = 0) -> SolveStep:
    return SolveStep(title=title, description=description, math=math, order=order)


def _add_steps_for_linear_1(params: Dict, f, x, steps: List[SolveStep]):
    P = params.get("P", sp.S.Zero)
    Q = params.get("Q", sp.S.Zero)
    C1 = sp.Symbol("C1")
    try:
        mu = sp.exp(sp.integrate(P, x))
        mu_simp = sp.simplify(mu)
        steps.append(_mk_step("识别为一阶线性方程",
                              r"方程形如 $y' + P(x) y = Q(x)$，其中 $P(x), Q(x)$ 已提取",
                              math=rf"P(x) = {sp.latex(P)}, \quad Q(x) = {sp.latex(Q)}", order=1))
        steps.append(_mk_step("计算积分因子",
                              r"积分因子为 $\mu(x) = e^{\int P(x) dx}$",
                              math=rf"\mu(x) = {sp.latex(mu_simp)}", order=2))
        integral = sp.integrate(sp.simplify(Q * mu_simp), x) + C1
        steps.append(_mk_step("两边乘积分因子并积分",
                              r"$(\mu y)' = \mu Q$，积分后得 $y = \mu^{-1} (\int \mu Q dx + C_1)$",
                              math=rf"y = {sp.latex((integral) / mu_simp)}", order=3))
    except Exception:
        pass


def _add_steps_for_separable(params: Dict, f, x, steps: List[SolveStep]):
    R = params.get("R", sp.S.Zero)
    y = f(x)
    C1 = sp.Symbol("C1")
    steps.append(_mk_step("识别为可分离变量方程",
                          r"方程可写为 $y' = P(x) Q(y)$，分离变量并积分",
                          math=rf"y' = {sp.latex(R)}", order=1))
    try:
        steps.append(_mk_step("分离变量并积分",
                              r"$\int \frac{dy}{Q(y)} = \int P(x) dx$",
                              math=rf"\int \frac{{dy}}{{Q(y)}} = \int P(x) dx + C_1", order=2))
    except Exception:
        pass


def _add_steps_for_bernoulli(params: Dict, f, x, steps: List[SolveStep]):
    P = params.get("P", sp.S.Zero)
    Q = params.get("Q", sp.S.Zero)
    n = params.get("n", 2)
    steps.append(_mk_step("识别为 Bernoulli 方程",
                          rf"方程形如 $y' + P(x) y = Q(x) y^{{{n}}}$",
                          math=rf"n = {n}, \quad P(x) = {sp.latex(P)}, \quad Q(x) = {sp.latex(Q)}", order=1))
    steps.append(_mk_step("变量替换",
                          rf"令 $z = y^{{1-n}}$，则 $z' = (1-n) y^{{-n}} y'$，化为一阶线性方程",
                          math=rf"z = y^{{{1 - n}}}", order=2))
    try:
        Pz = (1 - n) * P
        Qz = (1 - n) * Q
        steps.append(_mk_step("化为关于 z 的一阶线性方程",
                              rf"$z' + ({1 - n})P(x) z = ({1 - n})Q(x)$",
                              math=rf"z' + ({1 - n}) \cdot P(x) \cdot z = ({1 - n}) \cdot Q(x)", order=3))
    except Exception:
        pass


def _add_steps_for_homogeneous(params: Dict, f, x, steps: List[SolveStep]):
    R = params.get("R", sp.S.Zero)
    steps.append(_mk_step("识别为齐次方程",
                          r"方程形如 $y' = F(y/x)$",
                          math=rf"y' = {sp.latex(R)}", order=1))
    steps.append(_mk_step("变量替换",
                          r"令 $u = y/x$，则 $y = u x$，$y' = u + x u'$，方程化为可分离",
                          math=r"u = y/x \quad \Rightarrow \quad x u' = F(u) - u", order=2))


def _add_steps_for_exact(params: Dict, f, x, steps: List[SolveStep]):
    M = params.get("M", sp.S.Zero)
    N = params.get("N", sp.S.Zero)
    steps.append(_mk_step("识别为全微分方程",
                          r"方程 $M dx + N dy = 0$，且满足 $\partial M/\partial y = \partial N/\partial x$",
                          math=rf"M = {sp.latex(M)}, \quad N = {sp.latex(N)}", order=1))
    steps.append(_mk_step("构造势函数",
                          r"求 $u(x,y)$ 使得 $du = M dx + N dy$，即 $u = \int M dx + \phi(y)$",
                          math=r"u(x,y) = \int M\,dx + \phi(y) = C", order=2))


def _add_steps_for_riccati(params: Dict, f, x, steps: List[SolveStep]):
    P = params.get("P", sp.S.Zero)
    Q = params.get("Q", sp.S.Zero)
    R = params.get("R", sp.S.Zero)
    steps.append(_mk_step("识别为 Riccati 方程",
                          r"方程形如 $y' = P(x) + Q(x) y + R(x) y^2$",
                          math=rf"P={sp.latex(P)}, \; Q={sp.latex(Q)}, \; R={sp.latex(R)}", order=1))
    steps.append(_mk_step("Riccati 方程求解",
                          r"若已知一个特解 $y_1$，令 $y = y_1 + 1/z$ 可化为线性方程",
                          math=r"y = y_1 + 1/z \quad \Rightarrow \quad z' + (Q + 2 R y_1) z = -R", order=2))


def _add_steps_for_clairaut(params: Dict, f, x, steps: List[SolveStep]):
    rhs = params.get("rhs", sp.S.Zero)
    steps.append(_mk_step("识别为 Clairaut 方程",
                          r"方程形如 $y = x y' + f(y')$",
                          math=rf"y = {sp.latex(rhs)}", order=1))
    steps.append(_mk_step("求通解",
                          r"令 $p = y'$，得 $y = x p + f(p)$，两边求导并整理：$(x + f'(p)) p' = 0$",
                          math=r"p' = 0 \Rightarrow p = C \Rightarrow y = C x + f(C)", order=2))
    steps.append(_mk_step("求奇解",
                          r"由 $x + f'(p) = 0$ 与原方程联立消去 $p$ 得奇解",
                          math=r"\begin{cases} x + f'(p) = 0 \\ y = x p + f(p) \end{cases}", order=3))


def _add_steps_for_const_coeff(ode_type: ODEType, f, x, steps: List[SolveStep]):
    steps.append(_mk_step("识别为常系数线性方程",
                          r"方程为常系数线性方程，使用特征方程法求解",
                          math=ode_type.canonical_form, order=1))
    y = f(x)
    try:
        homo = ode_type.params.get("homo")
        if homo is None:
            return
        lam = sp.Symbol("lambda")
        char_poly = sp.S.Zero
        from sympy import Derivative
        terms = list(sp.expand(homo).as_ordered_terms())
        for t in terms:
            coeff = None
            found = False
            for sub in sp.preorder_traversal(t):
                if isinstance(sub, Derivative) and sub.has(y):
                    try:
                        o = sub.derivative_count
                    except AttributeError:
                        o = len(sub.variables)
                    coeff = sp.expand(t).coeff(sub)
                    char_poly += coeff * lam ** o
                    found = True
                    break
            if not found and t.has(y):
                coeff = sp.expand(t).coeff(y)
                char_poly += coeff
        if char_poly != 0:
            steps.append(_mk_step("构造特征方程",
                                  "将 y^{(k)} 替换为 λ^k",
                                  math=rf"{sp.latex(char_poly)} = 0", order=2))
            try:
                roots = sp.solve(char_poly, lam)
                steps.append(_mk_step("求特征根",
                                      "解特征方程",
                                      math=r", ".join([rf"\lambda = {sp.latex(r)}" for r in roots]), order=3))
            except Exception:
                pass
    except Exception as e:
        steps.append(_mk_step("特征方程构造失败", str(e), order=2))


def _add_steps_for_euler(ode_type: ODEType, f, x, steps: List[SolveStep]):
    steps.append(_mk_step("识别为 Euler 方程",
                          r"形如 $x^n y^{(n)} + a_1 x^{n-1} y^{(n-1)} + \cdots = f(x)$",
                          math=ode_type.canonical_form, order=1))
    steps.append(_mk_step("变量替换",
                          r"令 $x = e^t$，即 $t = \ln x$，则 $x y' = D y$，$x^2 y'' = D(D-1) y$，"
                          r"化为常系数线性方程",
                          math=r"x = e^t, \quad D = \frac{d}{dt}", order=2))


def _add_steps_for_special(ode_type: ODEType, f, x, steps: List[SolveStep]):
    steps.append(_mk_step(f"识别为 {ode_type.name_cn}",
                          ode_type.description,
                          math=ode_type.canonical_form, order=1))


def _add_steps_for_reducible(ode_type: ODEType, f, x, steps: List[SolveStep]):
    steps.append(_mk_step(f"识别为 {ode_type.name_cn}",
                          ode_type.description,
                          math=ode_type.canonical_form, order=1))
    if ode_type.code == "missing_y":
        steps.append(_mk_step("降阶",
                              r"令 $p = y'$，则 $y'' = p'$，...，方程降一阶",
                              math=r"p = y'", order=2))
    elif ode_type.code == "missing_x":
        steps.append(_mk_step("降阶",
                              r"令 $p = y'$，则 $y'' = p dp/dy$，方程降一阶",
                              math=r"y'' = p \frac{dp}{dy}", order=2))
    elif ode_type.code == "autonomous":
        steps.append(_mk_step("自治系统",
                              r"不显含 x，可令 $p = y'$，利用 $y'' = p dp/dy$ 降阶",
                              math=r"y'' = p \frac{dp}{dy}", order=2))


_STEP_DISPATCH = {
    "linear_1": _add_steps_for_linear_1,
    "separable": _add_steps_for_separable,
    "bernoulli": _add_steps_for_bernoulli,
    "homogeneous": _add_steps_for_homogeneous,
    "exact": _add_steps_for_exact,
    "riccati": _add_steps_for_riccati,
    "riccati_reducible": _add_steps_for_riccati,
    "clairaut": _add_steps_for_clairaut,
    "dalembert": lambda p, f, x, s: s.append(_mk_step("识别为 d'Alembert 方程",
                                                      r"形如 $y = x f(y') + g(y')$，令 $p=y'$ 求解",
                                                      math=r"y = x f(p) + g(p), \; p = y'", order=1)),
    "linear_const_coeff": _add_steps_for_const_coeff,
    "linear_const_coeff_nonhomo": _add_steps_for_const_coeff,
    "euler": _add_steps_for_euler,
    "bessel": _add_steps_for_special,
    "legendre": _add_steps_for_special,
    "hermite": _add_steps_for_special,
    "laguerre": _add_steps_for_special,
    "chebyshev": _add_steps_for_special,
    "airy": _add_steps_for_special,
    "weber": _add_steps_for_special,
    "mathieu": _add_steps_for_special,
    "hill": _add_steps_for_special,
    "emden_fowler": _add_steps_for_special,
    "lane_emden": _add_steps_for_special,
    "thomas_fermi": _add_steps_for_special,
    "blasius": _add_steps_for_special,
    "abel_1": _add_steps_for_special,
    "abel_2": _add_steps_for_special,
    "chini": _add_steps_for_special,
    "missing_y": _add_steps_for_reducible,
    "missing_x": _add_steps_for_reducible,
    "autonomous": _add_steps_for_reducible,
}


def _extract_solutions(raw) -> List[sp.Expr]:
    sols = []
    if raw is None:
        return sols
    if isinstance(raw, (list, tuple)):
        for s in raw:
            sols.extend(_extract_solutions(s))
        return sols
    if isinstance(raw, sp.Equality):
        sols.append(raw)
    elif isinstance(raw, sp.Expr):
        sols.append(raw)
    else:
        try:
            if hasattr(raw, "rhs"):
                sols.append(raw.rhs)
            else:
                sols.append(sp.sympify(raw))
        except Exception:
            sols.append(raw)
    return sols


from .verify import separate_solutions as _separate_solutions


def _separate_general_particular(solutions: List[sp.Expr], f, x) -> Dict[str, List[sp.Expr]]:
    return _separate_solutions(solutions, f, x)


def solve_ode(ode_input: ODEInput, compute_numerical: bool = False,
              num_x_start: float = 0.0, num_x_end: float = 5.0,
              num_points: int = 100, y0: float = 1.0) -> SolveResult:
    f = ode_input.func
    x = ode_input.var
    y = f(x)

    steps: List[SolveStep] = []
    steps.append(_mk_step("输入解析",
                          "已完成方程解析",
                          math=rf"{sp.latex(ode_input.eq)}", order=0))
    for s in ode_input.parsing_steps:
        steps.append(_mk_step("解析阶段", s, order=0))

    raw_combined = sp.simplify(ode_input.lhs - ode_input.rhs)
    matched = classify_ode(raw_combined, f, x)
    primary = matched[0] if matched else None

    normalized_expr, norm_steps = normalize_ode(ode_input)
    for s in norm_steps:
        steps.append(_mk_step("规范化", s, order=0))

    if matched:
        steps.append(_mk_step("方程分类",
                              f"识别到 {len(matched)} 种可能的方程类型，按匹配度排序如下：",
                              order=0))
        for i, t in enumerate(matched[:5]):
            steps.append(_mk_step(f"类型 {i + 1}: {t.name_cn}",
                                  f"{t.name_en} — {t.description}",
                                  math=t.canonical_form, order=0))

    if primary and primary.code in _STEP_DISPATCH:
        try:
            _STEP_DISPATCH[primary.code](primary.params, f, x, steps)
        except Exception as e:
            steps.append(_mk_step("步骤生成失败", str(e), order=0))

    raw_sol = None
    error = None
    status = "success"

    try:
        eq = sp.Eq(normalized_expr, 0)
        try:
            raw_sol = sp.dsolve(eq, y, simplify=False)
        except Exception as e1:
            try:
                raw_sol = sp.dsolve(eq, y)
            except Exception as e2:
                error = f"SymPy 求解失败: {e1}; 回退尝试: {e2}"
                status = "failed"
    except Exception as e:
        error = f"求解异常: {e}"
        status = "failed"

    solutions = _extract_solutions(raw_sol)
    separated = _separate_general_particular(solutions, f, x)
    general_solutions = separated["general"]
    particular_solutions = separated["particular"]

    if solutions:
        steps.append(_mk_step("通解",
                              "由求解器返回的含任意常数的解",
                              math=";\quad ".join([sp.latex(s) for s in general_solutions]) or "—",
                              order=10))
        if particular_solutions:
            steps.append(_mk_step("特解",
                                  "不含任意常数的特解",
                                  math=";\quad ".join([sp.latex(s) for s in particular_solutions]),
                                  order=11))
    elif status == "failed":
        steps.append(_mk_step("求解失败", error or "SymPy 未能给出显式解", order=10))

    numerical_comparison = None
    if compute_numerical and general_solutions and status == "success":
        try:
            from .numerical import compare_solutions
            params = ode_input.free_params
            comparison = compare_solutions(
                general_solutions[0],
                normalized_expr,
                f, x, params,
                x_start=num_x_start,
                x_end=num_x_end,
                num_points=num_points,
                initial_condition={"x0": num_x_start, "y0": y0},
            )
            numerical_comparison = comparison
        except Exception as e:
            numerical_comparison = None

    return SolveResult(
        ode_input=ode_input,
        normalized_expr=normalized_expr,
        matched_types=matched,
        primary_type=primary,
        general_solutions=general_solutions,
        particular_solutions=particular_solutions,
        steps=steps,
        raw_sol=raw_sol,
        status=status,
        error=error,
        numerical_comparison=numerical_comparison,
    )
