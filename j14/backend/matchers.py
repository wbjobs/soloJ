from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable, Any

import sympy as sp


@dataclass
class ODEType:
    code: str
    name_cn: str
    name_en: str
    description: str
    canonical_form: str
    params: Dict[str, Any] = field(default_factory=dict)
    match_score: int = 0


def _has_f(expr, f, x):
    return expr.has(f(x))


def _order(expr, f, x):
    ders = list(expr.atoms(sp.Derivative))
    if not ders:
        return 0
    max_order = 0
    for d in ders:
        try:
            max_order = max(max_order, d.derivative_count)
        except AttributeError:
            max_order = max(max_order, len(d.variables))
    return max_order


def _match_separable(expr, f, x) -> Optional[ODEType]:
    """y' = P(x) Q(y)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        sol = sp.solve(expr, yp)
        if not sol:
            return None
        R = sol[0]
    except Exception:
        return None
    try:
        R_simplified = sp.simplify(R)
        parts = sp.fraction(R_simplified)
        num, den = parts[0], parts[1]
        num_x = num.subs(y, 1)
        num_y = num.subs(x, 0)
        if sp.simplify(num_x * num_y - num) == 0 and den.is_constant():
            return ODEType(
                code="separable",
                name_cn="可分离变量方程",
                name_en="Separable ODE",
                description=r"形如 $y' = P(x)Q(y)$ 的方程，可通过分离变量积分求解",
                canonical_form=r"y' = P(x) Q(y)",
                params={"R": R},
                match_score=90,
            )
    except Exception:
        pass
    return None


def _match_homogeneous(expr, f, x) -> Optional[ODEType]:
    """y' = F(y/x)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        sol = sp.solve(expr, yp)
        if not sol:
            return None
        R = sol[0]
    except Exception:
        return None
    u = sp.Dummy("u")
    R_sub = sp.simplify(R.subs(y, u * x))
    if not R_sub.has(x) or R_sub == u:
        return ODEType(
            code="homogeneous",
            name_cn="齐次方程",
            name_en="Homogeneous ODE",
            description=r"形如 $y' = F(y/x)$，可令 $u=y/x$ 化为可分离方程",
            canonical_form=r"y' = F(y/x)",
            params={"R": R},
            match_score=80,
        )
    return None


def _match_linear_first_order(expr, f, x) -> Optional[ODEType]:
    """y' + P(x) y = Q(x)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_yp = expr_expanded.coeff(yp)
        if coeff_yp == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_yp * yp)
        P_coeff = sp.expand(rest).coeff(y)
        Q_term = sp.expand(rest - P_coeff * y)
        P_coeff = sp.simplify(P_coeff / coeff_yp)
        Q_term = sp.simplify(-Q_term / coeff_yp)
        if P_coeff.has(y) or Q_term.has(y):
            return None
        return ODEType(
            code="linear_1",
            name_cn="一阶线性非齐次方程",
            name_en="First-order Linear ODE",
            description=r"形如 $y' + P(x)y = Q(x)$，用积分因子 $e^{\int P(x)dx}$ 求解",
            canonical_form=r"y' + P(x) y = Q(x)",
            params={"P": P_coeff, "Q": Q_term},
            match_score=95,
        )
    except Exception:
        pass
    return None


def _match_exact(expr, f, x) -> Optional[ODEType]:
    """M(x,y) dx + N(x,y) dy = 0 且 ∂M/∂y = ∂N/∂x"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_yp = expr_expanded.coeff(yp)
        M = sp.expand(expr_expanded - coeff_yp * yp)
        N = coeff_yp
        if N == 0:
            return None
        M_func = sp.simplify(M / (-N))
        try:
            dM_dy = sp.diff(M, y)
            dN_dx = sp.diff(N, x)
            if sp.simplify(dM_dy - dN_dx) == 0:
                return ODEType(
                    code="exact",
                    name_cn="全微分方程",
                    name_en="Exact ODE",
                    description=r"形如 $M(x,y)dx + N(x,y)dy = 0$ 且 $\partial M/\partial y = \partial N/\partial x$",
                    canonical_form=r"M(x,y) dx + N(x,y) dy = 0",
                    params={"M": M, "N": N},
                    match_score=85,
                )
        except Exception:
            pass
    except Exception:
        pass
    return None


def _match_bernoulli(expr, f, x) -> Optional[ODEType]:
    """y' + P(x) y = Q(x) y^n"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_yp = expr_expanded.coeff(yp)
        if coeff_yp == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_yp * yp)
        for n_val in range(-5, 6):
            if n_val in (0, 1, 2):
                continue
            y_n = y ** n_val
            Q_coeff = sp.expand(rest).coeff(y_n)
            if Q_coeff == 0:
                continue
            other = sp.expand(rest - Q_coeff * y_n)
            P_coeff = sp.expand(other).coeff(y)
            leftover = sp.expand(other - P_coeff * y)
            if leftover != 0:
                continue
            if P_coeff.has(y) or Q_coeff.has(y):
                continue
            P_s = P_coeff / coeff_yp
            Q_s = -Q_coeff / coeff_yp
            return ODEType(
                code="bernoulli",
                name_cn="伯努利方程",
                name_en="Bernoulli ODE",
                description="形如 $y' + P(x)y = Q(x)y^n$，用 $z = y^{1-n}$ 化为线性",
                canonical_form=f"y' + P(x) y = Q(x) y^{{{n_val}}}",
                params={"P": P_s, "Q": Q_s, "n": n_val},
                match_score=88,
            )
    except Exception:
        pass
    return None


def _match_riccati(expr, f, x) -> Optional[ODEType]:
    """y' = P(x) + Q(x) y + R(x) y^2"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        R_raw = sp.expand(expr_expanded).coeff(y ** 2)
        Q_raw = sp.expand(expr_expanded - R_raw * y ** 2).coeff(y)
        rest = sp.expand(expr_expanded - R_raw * y ** 2 - Q_raw * y - yp)
        P_raw = sp.simplify(-rest)
        if R_raw != 0 and not Q_raw.has(y) and not P_raw.has(y):
            P = sp.simplify(P_raw)
            Q = sp.simplify(-Q_raw)
            R = sp.simplify(-R_raw)
            return ODEType(
                code="riccati",
                name_cn="里卡蒂方程",
                name_en="Riccati ODE",
                description=r"形如 $y' = P(x) + Q(x)y + R(x)y^2$，特殊情形可化为二阶线性",
                canonical_form=r"y' = P(x) + Q(x) y + R(x) y^2",
                params={"P": P, "Q": Q, "R": R},
                match_score=75,
            )
    except Exception:
        pass
    return None


def _match_abel_first_kind(expr, f, x) -> Optional[ODEType]:
    """y' = f(x) y^3 + g(x) y^2 + h(x) y + k(x)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        f_raw = sp.expand(expr_expanded).coeff(y ** 3)
        if f_raw == 0:
            return None
        rest1 = sp.expand(expr_expanded - f_raw * y ** 3)
        g_raw = sp.expand(rest1).coeff(y ** 2)
        rest2 = sp.expand(rest1 - g_raw * y ** 2)
        h_raw = sp.expand(rest2).coeff(y)
        rest3 = sp.expand(rest2 - h_raw * y - yp)
        k_raw = sp.simplify(-rest3)
        if not any(c.has(y) for c in [f_raw, g_raw, h_raw, k_raw]):
            f_coeff = sp.simplify(-f_raw)
            g_coeff = sp.simplify(-g_raw)
            h_coeff = sp.simplify(-h_raw)
            k_coeff = sp.simplify(k_raw)
            return ODEType(
                code="abel_1",
                name_cn="Abel 第一类方程",
                name_en="Abel ODE of the First Kind",
                description=r"形如 $y' = f(x)y^3 + g(x)y^2 + h(x)y + k(x)$，可通过不变量判别",
                canonical_form=r"y' = f(x) y^3 + g(x) y^2 + h(x) y + k(x)",
                params={"f": f_coeff, "g": g_coeff, "h": h_coeff, "k": k_coeff},
                match_score=70,
            )
    except Exception:
        pass
    return None


def _match_abel_second_kind(expr, f, x) -> Optional[ODEType]:
    """[y + f(x)] y' = g(x) y^2 + h(x) y + k(x)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        if not expr_expanded.has(y * yp):
            return None
        coeff_yyp = sp.expand(expr_expanded).coeff(y * yp)
        if coeff_yyp == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_yyp * y * yp)
        coeff_yp = sp.expand(rest).coeff(yp)
        rest2 = sp.expand(rest - coeff_yp * yp)
        if rest2.has(yp):
            return None
        return ODEType(
            code="abel_2",
            name_cn="Abel 第二类方程",
            name_en="Abel ODE of the Second Kind",
            description=r"形如 $(y+f(x))y' = g(x)y^2+h(x)y+k(x)$",
            canonical_form=r"(y + f(x)) y' = g(x) y^2 + h(x) y + k(x)",
            params={"coeff_yyp": coeff_yyp, "coeff_yp": coeff_yp, "rest": rest2},
            match_score=65,
        )
    except Exception:
        pass
    return None


def _match_chini(expr, f, x) -> Optional[ODEType]:
    """y' = f(x) y^n + g(x) y + h(x)   (Chini equation, n != 0,1,2,3)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_yp = expr_expanded.coeff(yp)
        if coeff_yp == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_yp * yp)
        for n_val in range(-5, 7):
            if n_val in (0, 1, 2, 3):
                continue
            y_n = y ** n_val
            f_coeff = sp.expand(rest).coeff(y_n)
            if f_coeff == 0:
                continue
            rest1 = sp.expand(rest - f_coeff * y_n)
            g_coeff = sp.expand(rest1).coeff(y)
            h_coeff = sp.expand(rest1 - g_coeff * y)
            if h_coeff.has(y) or g_coeff.has(y) or f_coeff.has(y):
                continue
            f_coeff = sp.simplify(-f_coeff / coeff_yp)
            g_coeff = sp.simplify(-g_coeff / coeff_yp)
            h_coeff = sp.simplify(-h_coeff / coeff_yp)
            return ODEType(
                code="chini",
                name_cn="Chini 方程",
                name_en="Chini ODE",
                description="形如 $y' = f(x)y^n + g(x)y + h(x)$，推广了伯努利与 Abel",
                canonical_form=f"y' = f(x) y^{{{n_val}}} + g(x) y + h(x)",
                params={"f": f_coeff, "g": g_coeff, "h": h_coeff, "n": n_val},
                match_score=62,
            )
    except Exception:
        pass
    return None


def _match_clairaut(expr, f, x) -> Optional[ODEType]:
    """y = x y' + f(y')"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_y = expr_expanded.coeff(y)
        if coeff_y == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_y * y)
        rest_simp = sp.simplify(rest / coeff_y)
        rhs = sp.simplify(-rest_simp)
        if rhs.has(x * yp) and rhs.has(yp):
            return ODEType(
                code="clairaut",
                name_cn="Clairaut 方程",
                name_en="Clairaut ODE",
                description=r"形如 $y = x y' + f(y')$，含奇解",
                canonical_form=r"y = x y' + f(y')",
                params={"rhs": rhs},
                match_score=82,
            )
    except Exception:
        pass
    return None


def _match_dalembert(expr, f, x) -> Optional[ODEType]:
    """y = x f(y') + g(y')"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        coeff_y = expr_expanded.coeff(y)
        if coeff_y == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_y * y)
        rhs = sp.simplify(-rest / coeff_y)
        if rhs.has(x) and rhs.has(yp) and not rhs.has(y):
            return ODEType(
                code="dalembert",
                name_cn="d'Alembert 方程",
                name_en="d'Alembert ODE",
                description=r"形如 $y = x f(y') + g(y')$",
                canonical_form=r"y = x f(y') + g(y')",
                params={"rhs": rhs},
                match_score=78,
            )
    except Exception:
        pass
    return None


def _match_homogeneous_linear_const_coeff(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) < 2:
        return None
    y = f(x)
    try:
        expr_expanded = sp.expand(expr)
        terms = list(expr_expanded.as_ordered_terms())
        all_constant = True
        for t in terms:
            is_deriv_or_func = False
            for sub in sp.preorder_traversal(t):
                if isinstance(sub, sp.Derivative) and sub.has(y):
                    is_deriv_or_func = True
                    break
                if isinstance(sub, sp.Function) and sub.func == f:
                    is_deriv_or_func = True
                    break
            if is_deriv_or_func:
                coeff = sp.expand(t).coeff(list(t.atoms(sp.Derivative))[0]) if any(
                    isinstance(s, sp.Derivative) and s.has(y) for s in sp.preorder_traversal(t)
                ) else sp.expand(t).coeff(y)
                if coeff.has(x):
                    all_constant = False
                    break
        if not all_constant:
            return None
        has_nonhomo = False
        for t in terms:
            is_deriv_or_func = any(
                (isinstance(s, sp.Derivative) and s.has(y)) or
                (isinstance(s, sp.Function) and s.func == f)
                for s in sp.preorder_traversal(t)
            )
            if not is_deriv_or_func and t != 0:
                has_nonhomo = True
                break
        if has_nonhomo:
            return None
        return ODEType(
            code="linear_const_coeff",
            name_cn="常系数线性齐次方程",
            name_en="Linear Homogeneous ODE with Constant Coefficients",
            description=r"形如 $y^{(n)} + a_1 y^{(n-1)} + \cdots + a_n y = 0$",
            canonical_form=r"y^{(n)} + a_1 y^{(n-1)} + \cdots + a_n y = 0",
            params={},
            match_score=90,
        )
    except Exception:
        return None


def _match_linear_nonhomogeneous_const_coeff(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) < 2:
        return None
    y = f(x)
    try:
        expr_expanded = sp.expand(expr)
        terms = list(expr_expanded.as_ordered_terms())
        all_constant = True
        for t in terms:
            is_deriv_or_func = any(
                (isinstance(s, sp.Derivative) and s.has(y)) or
                (isinstance(s, sp.Function) and s.func == f)
                for s in sp.preorder_traversal(t)
            )
            if is_deriv_or_func:
                coeff = sp.expand(t).coeff(list(t.atoms(sp.Derivative))[0]) if any(
                    isinstance(s, sp.Derivative) and s.has(y) for s in sp.preorder_traversal(t)
                ) else sp.expand(t).coeff(y)
                if coeff.has(x):
                    all_constant = False
                    break
        if not all_constant:
            return None
        nonhomo = sp.S.Zero
        has_nonhomo = False
        for t in terms:
            is_deriv_or_func = any(
                (isinstance(s, sp.Derivative) and s.has(y)) or
                (isinstance(s, sp.Function) and s.func == f)
                for s in sp.preorder_traversal(t)
            )
            if not is_deriv_or_func and t != 0:
                has_nonhomo = True
                nonhomo += t
        if not has_nonhomo:
            return None
        homo_part = sp.expand(expr_expanded - nonhomo)
        return ODEType(
            code="linear_const_coeff_nonhomo",
            name_cn="常系数线性非齐次方程",
            name_en="Linear Non-homogeneous ODE with Constant Coefficients",
            description=r"形如 $y^{(n)} + a_1 y^{(n-1)} + \cdots + a_n y = f(x)$，可用待定系数法",
            canonical_form=r"y^{(n)} + a_1 y^{(n-1)} + \cdots + a_n y = f(x)",
            params={"nonhomo": -nonhomo, "homo": homo_part},
            match_score=88,
        )
    except Exception:
        return None


def _match_euler(expr, f, x) -> Optional[ODEType]:
    """x^n y^{(n)} + a_1 x^{n-1} y^{(n-1)} + ..."""
    if _order(expr, f, x) < 2:
        return None
    y = f(x)
    try:
        expr_expanded = sp.expand(expr)
        terms = list(expr_expanded.as_ordered_terms())
        euler_ok = True
        for t in terms:
            is_deriv_or_func = any(
                (isinstance(s, sp.Derivative) and s.has(y)) or
                (isinstance(s, sp.Function) and s.func == f)
                for s in sp.preorder_traversal(t)
            )
            if not is_deriv_or_func:
                continue
            deriv = None
            for s in sp.preorder_traversal(t):
                if isinstance(s, sp.Derivative) and s.has(y):
                    deriv = s
                    break
            if deriv is None:
                coeff = sp.expand(t).coeff(y)
                if coeff.has(x) and not (coeff.has(x ** 0) or coeff == 0):
                    euler_ok = False
                    break
                continue
            try:
                order = deriv.derivative_count
            except AttributeError:
                order = len(deriv.variables)
            coeff = sp.expand(t).coeff(deriv)
            if coeff == 0:
                continue
            ratio = sp.simplify(coeff / (x ** order))
            if ratio.has(x):
                euler_ok = False
                break
        if euler_ok:
            return ODEType(
                code="euler",
                name_cn="欧拉方程",
                name_en="Euler (Cauchy-Euler) ODE",
                description=r"形如 $x^n y^{(n)} + a_1 x^{n-1} y^{(n-1)} + \cdots + a_n y = f(x)$",
                canonical_form=r"x^n y^{(n)} + a_1 x^{n-1} y^{(n-1)} + \cdots = f(x)",
                params={},
                match_score=80,
            )
    except Exception:
        pass
    return None


def _match_bessel(expr, f, x) -> Optional[ODEType]:
    """x^2 y'' + x y' + (x^2 - nu^2) y = 0"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        coeff_y = rest2.coeff(y)
        if coeff_ypp.has(x ** 2) or coeff_ypp == x ** 2:
            return ODEType(
                code="bessel",
                name_cn="贝塞尔方程",
                name_en="Bessel ODE",
                description=r"形如 $x^2 y'' + x y' + (x^2 - \nu^2)y = 0$",
                canonical_form=r"x^2 y'' + x y' + (x^2 - \nu^2) y = 0",
                params={"coeff_ypp": coeff_ypp, "coeff_yp": coeff_yp, "coeff_y": coeff_y},
                match_score=80,
            )
    except Exception:
        pass
    return None


def _match_legendre(expr, f, x) -> Optional[ODEType]:
    """(1-x^2)y'' - 2x y' + n(n+1) y = 0"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        coeff_y = rest2.coeff(y)
        if coeff_ypp.has(1 - x ** 2) or sp.simplify(coeff_ypp - (1 - x ** 2)) == 0:
            return ODEType(
                code="legendre",
                name_cn="勒让德方程",
                name_en="Legendre ODE",
                description=r"$(1-x^2)y'' - 2x y' + n(n+1)y = 0$",
                canonical_form=r"(1-x^2)y'' - 2x y' + n(n+1) y = 0",
                params={},
                match_score=82,
            )
    except Exception:
        pass
    return None


def _match_hermite(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        coeff_y = rest2.coeff(y)
        if sp.simplify(coeff_yp + 2 * x * coeff_ypp) == 0 or (coeff_ypp == 1 and coeff_yp == -2 * x):
            return ODEType(
                code="hermite",
                name_cn="埃尔米特方程",
                name_en="Hermite ODE",
                description=r"$y'' - 2x y' + 2n y = 0$",
                canonical_form=r"y'' - 2x y' + 2n y = 0",
                params={},
                match_score=78,
            )
    except Exception:
        pass
    return None


def _match_laguerre(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        coeff_y = rest2.coeff(y)
        if coeff_ypp.has(x) and coeff_yp.has(1 - x):
            return ODEType(
                code="laguerre",
                name_cn="拉盖尔方程",
                name_en="Laguerre ODE",
                description=r"$x y'' + (1-x) y' + n y = 0$",
                canonical_form=r"x y'' + (1-x) y' + n y = 0",
                params={},
                match_score=75,
            )
    except Exception:
        pass
    return None


def _match_chebyshev(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        coeff_y = rest2.coeff(y)
        if coeff_ypp.has(1 - x ** 2) or sp.simplify(coeff_ypp - (1 - x ** 2)) == 0:
            if sp.simplify(coeff_yp + x * coeff_ypp) == 0 or coeff_yp == -x:
                return ODEType(
                    code="chebyshev",
                    name_cn="切比雪夫方程",
                    name_en="Chebyshev ODE",
                    description=r"$(1-x^2)y'' - x y' + n^2 y = 0$",
                    canonical_form=r"(1-x^2)y'' - x y' + n^2 y = 0",
                    params={},
                    match_score=76,
                )
    except Exception:
        pass
    return None


def _match_airy(expr, f, x) -> Optional[ODEType]:
    """y'' - x y = 0"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        if expr_expanded.has(yp):
            return None
        coeff_ypp = expr_expanded.coeff(ypp)
        rest = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_y = rest.coeff(y)
        if sp.simplify(coeff_y + x * coeff_ypp) == 0 or coeff_y == -x:
            return ODEType(
                code="airy",
                name_cn="Airy 方程",
                name_en="Airy ODE",
                description=r"$y'' - x y = 0$，解为 Airy 函数",
                canonical_form=r"y'' - x y = 0",
                params={},
                match_score=85,
            )
    except Exception:
        pass
    return None


def _match_weber(expr, f, x) -> Optional[ODEType]:
    """y'' + (nu + 1/2 - x^2/4) y = 0"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        if expr_expanded.has(yp):
            return None
        coeff_ypp = expr_expanded.coeff(ypp)
        rest = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_y = rest.coeff(y)
        if coeff_y.has(x ** 2):
            return ODEType(
                code="weber",
                name_cn="Weber 方程",
                name_en="Weber ODE",
                description=r"$y'' + (\nu + 1/2 - x^2/4) y = 0$",
                canonical_form=r"y'' + (\nu + 1/2 - x^2/4) y = 0",
                params={},
                match_score=70,
            )
    except Exception:
        pass
    return None


def _match_mathieu(expr, f, x) -> Optional[ODEType]:
    """y'' + (a - 2q cos 2x) y = 0"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        if expr_expanded.has(yp):
            return None
        coeff_ypp = expr_expanded.coeff(ypp)
        rest = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_y = rest.coeff(y)
        if coeff_y.has(sp.cos(2 * x)) or coeff_y.has(sp.cos(x) ** 2):
            return ODEType(
                code="mathieu",
                name_cn="Mathieu 方程",
                name_en="Mathieu ODE",
                description=r"$y'' + (a - 2q\cos 2x) y = 0$",
                canonical_form=r"y'' + (a - 2q \cos 2x) y = 0",
                params={},
                match_score=68,
            )
    except Exception:
        pass
    return None


def _match_hill(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        if expr_expanded.has(yp):
            return None
        coeff_ypp = expr_expanded.coeff(ypp)
        rest = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_y = rest.coeff(y)
        if coeff_y.has(sp.cos(x)) and coeff_y.has(sp.sin(x)):
            return ODEType(
                code="hill",
                name_cn="Hill 方程",
                name_en="Hill ODE",
                description=r"$y'' + Q(x) y = 0$，$Q$ 为周期函数",
                canonical_form=r"y'' + Q(x) y = 0",
                params={},
                match_score=65,
            )
    except Exception:
        pass
    return None


def _match_riccati_special(expr, f, x) -> Optional[ODEType]:
    """Riccati with known particular solution (fallback matcher)"""
    if _order(expr, f, x) != 1:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    try:
        expr_expanded = sp.expand(expr)
        R_raw = sp.expand(expr_expanded).coeff(y ** 2)
        if R_raw == 0:
            return None
        Q_raw = sp.expand(expr_expanded - R_raw * y ** 2).coeff(y)
        rest = sp.expand(expr_expanded - R_raw * y ** 2 - Q_raw * y - yp)
        P_raw = sp.simplify(-rest)
        if R_raw.has(y) or Q_raw.has(y) or P_raw.has(y):
            return None
        P = sp.simplify(P_raw)
        Q = sp.simplify(-Q_raw)
        R = sp.simplify(-R_raw)
        return ODEType(
            code="riccati_reducible",
            name_cn="可约化里卡蒂方程",
            name_en="Reducible Riccati ODE",
            description=r"可通过特定解转化的 Riccati 方程",
            canonical_form=r"y' = P(x) + Q(x) y + R(x) y^2",
            params={"P": P, "Q": Q, "R": R},
            match_score=60,
        )
    except Exception:
        return None


def _match_emden_fowler(expr, f, x) -> Optional[ODEType]:
    """x^2 y'' + 2x y' + x^n y^m = 0  (Emden-Fowler)"""
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        if coeff_ypp.has(x ** 2) or coeff_ypp == x ** 2:
            rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
            coeff_yp = rest1.coeff(yp)
            if coeff_yp.has(x) or coeff_yp == 2 * x:
                rest2 = sp.expand(rest1 - coeff_yp * yp)
                if rest2.has(y) and rest2.has(x):
                    return ODEType(
                        code="emden_fowler",
                        name_cn="Emden-Fowler 方程",
                        name_en="Emden-Fowler ODE",
                        description=r"$x^2 y'' + 2x y' + x^n y^m = 0$",
                        canonical_form=r"x^2 y'' + 2x y' + x^n y^m = 0",
                        params={},
                        match_score=66,
                    )
    except Exception:
        pass
    return None


def _match_thomas_fermi(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        rest2 = sp.expand(rest1)
        if rest2.has(y ** sp.Rational(3, 2)) or rest2.has(y ** 1.5):
            return ODEType(
                code="thomas_fermi",
                name_cn="Thomas-Fermi 方程",
                name_en="Thomas-Fermi ODE",
                description=r"$y'' = x^{-1/2} y^{3/2}$",
                canonical_form=r"y'' = x^{-1/2} y^{3/2}",
                params={},
                match_score=70,
            )
    except Exception:
        pass
    return None


def _match_blasius(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 3:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    yppp = sp.Derivative(y, x, 3)
    try:
        expr_expanded = sp.expand(expr)
        if expr_expanded.has(y * ypp) and expr_expanded.has(yppp):
            return ODEType(
                code="blasius",
                name_cn="Blasius 方程",
                name_en="Blasius ODE",
                description=r"$y''' + y y'' = 0$",
                canonical_form=r"y''' + y y'' = 0",
                params={},
                match_score=72,
            )
    except Exception:
        pass
    return None


def _match_lane_emden(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) != 2:
        return None
    y = f(x)
    yp = sp.Derivative(y, x)
    ypp = sp.Derivative(y, x, 2)
    try:
        expr_expanded = sp.expand(expr)
        coeff_ypp = expr_expanded.coeff(ypp)
        rest1 = sp.expand(expr_expanded - coeff_ypp * ypp)
        coeff_yp = rest1.coeff(yp)
        rest2 = sp.expand(rest1 - coeff_yp * yp)
        if (coeff_ypp.has(x ** 2) or coeff_ypp == x ** 2) and (coeff_yp.has(x) or coeff_yp == 2 * x):
            if rest2.has(y):
                return ODEType(
                    code="lane_emden",
                    name_cn="Lane-Emden 方程",
                    name_en="Lane-Emden ODE",
                    description=r"$x^2 y'' + 2x y' + x^2 y^n = 0$",
                    canonical_form=r"x^2 y'' + 2x y' + x^2 y^n = 0",
                    params={},
                    match_score=67,
                )
    except Exception:
        pass
    return None


def _match_autonomous(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) == 0:
        return None
    y = f(x)
    try:
        if not expr.has(x):
            return ODEType(
                code="autonomous",
                name_cn="自治方程",
                name_en="Autonomous ODE",
                description=r"不显含 x 的方程",
                canonical_form=r"F(y, y', y'', \dots) = 0",
                params={},
                match_score=50,
            )
    except Exception:
        pass
    return None


def _match_missing_y(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) < 2:
        return None
    y = f(x)
    try:
        if not expr.has(y):
            return ODEType(
                code="missing_y",
                name_cn="不显含 y 的方程",
                name_en="ODE Missing y",
                description=r"令 $p = y'$ 降阶",
                canonical_form=r"F(x, y', y'', \dots) = 0",
                params={},
                match_score=70,
            )
    except Exception:
        pass
    return None


def _match_missing_x(expr, f, x) -> Optional[ODEType]:
    if _order(expr, f, x) < 2:
        return None
    try:
        if not expr.has(x):
            return ODEType(
                code="missing_x",
                name_cn="不显含 x 的方程",
                name_en="ODE Missing x",
                description=r"令 $p = y'$，$y'' = p dp/dy$",
                canonical_form=r"F(y, y', y'', \dots) = 0",
                params={},
                match_score=60,
            )
    except Exception:
        pass
    return None


def _match_system_of_odes(expr, f, x) -> Optional[ODEType]:
    return None


ALL_MATCHERS: List[Callable[..., Optional[ODEType]]] = [
    _match_linear_first_order,
    _match_separable,
    _match_homogeneous,
    _match_exact,
    _match_bernoulli,
    _match_abel_first_kind,
    _match_abel_second_kind,
    _match_chini,
    _match_riccati,
    _match_riccati_special,
    _match_clairaut,
    _match_dalembert,
    _match_homogeneous_linear_const_coeff,
    _match_linear_nonhomogeneous_const_coeff,
    _match_euler,
    _match_bessel,
    _match_legendre,
    _match_hermite,
    _match_laguerre,
    _match_chebyshev,
    _match_airy,
    _match_weber,
    _match_mathieu,
    _match_hill,
    _match_emden_fowler,
    _match_lane_emden,
    _match_thomas_fermi,
    _match_blasius,
    _match_missing_y,
    _match_missing_x,
    _match_autonomous,
]


def classify_ode(expr: sp.Expr, f, x) -> List[ODEType]:
    """
    Classify an ODE by trying all matchers. Returns list of matched types
    sorted by match_score descending.
    """
    matches = []
    seen_codes = set()
    for matcher in ALL_MATCHERS:
        try:
            result = matcher(expr, f, x)
            if result and result.code not in seen_codes:
                matches.append(result)
                seen_codes.add(result.code)
        except Exception:
            continue
    matches.sort(key=lambda t: t.match_score, reverse=True)
    return matches
