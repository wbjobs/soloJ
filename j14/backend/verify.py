from typing import Dict, List, Tuple, Any

import sympy as sp


def separate_solutions(solutions: List[Any], f, x) -> Dict[str, List[Any]]:
    """
    Separate solutions into general (involving constants C1, C2, ...)
    and particular (no such constants).
    """
    general, particular = [], []
    for sol in solutions:
        expr = sol.rhs if isinstance(sol, sp.Equality) else sol
        try:
            free = list(expr.free_symbols)
        except Exception:
            free = []
        has_const = any(str(s).startswith("C") and str(s)[1:].isdigit() for s in free)
        if has_const:
            general.append(sol)
        else:
            particular.append(sol)
    return {"general": general, "particular": particular}


def verify_solution(ode_expr: sp.Expr, solution_expr, f, x,
                    subs_equality: bool = True) -> Tuple[bool, sp.Expr, str]:
    """
    Verify that a candidate solution satisfies the original ODE.

    ode_expr: the normalized LHS expression (we test ode_expr(solution) == 0)
    solution_expr: can be sp.Equality (y = expr) or sp.Expr (y = expr)
    Returns: (verified, residual, message)
    """
    y = f(x)
    if isinstance(solution_expr, sp.Equality):
        candidate = solution_expr.rhs
    else:
        candidate = solution_expr

    try:
        subs_expr = ode_expr.subs(y, candidate)
        subs_expr = sp.simplify(subs_expr.doit())
        residual = sp.simplify(subs_expr)
        verified = sp.simplify(residual) == 0 or (hasattr(residual, "is_zero") and residual.is_zero)
        return verified, residual, "验证通过" if verified else f"残差不为零: {sp.latex(residual)}"
    except Exception as e:
        return False, sp.S.Zero, f"验证失败: {e}"


def verify_all(ode_expr: sp.Expr, solutions: List[Any], f, x) -> List[Dict[str, Any]]:
    results = []
    for sol in solutions:
        ok, residual, msg = verify_solution(ode_expr, sol, f, x)
        results.append({
            "solution": sol,
            "verified": ok,
            "residual": residual,
            "message": msg,
        })
    return results
