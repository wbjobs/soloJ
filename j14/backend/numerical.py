from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple, Callable

import numpy as np
import sympy as sp

try:
    from scipy.integrate import solve_ivp
    _SCIPY_AVAILABLE = True
except ImportError:
    _SCIPY_AVAILABLE = False
    solve_ivp = None


@dataclass
class NumericalComparison:
    x_values: List[float]
    y_symbolic: List[float]
    y_numerical: List[float]
    errors: List[float]
    mae: float
    rmse: float
    max_error: float
    max_error_x: float
    max_error_y_symbolic: float
    max_error_y_numerical: float
    ode_rhs_expr: Optional[str] = None
    initial_condition: Optional[Dict[str, float]] = None
    params_values: Optional[Dict[str, float]] = None
    status: str = "success"
    error_message: Optional[str] = None


def _extract_solution_expression(
    solution_eq: sp.Equality,
    f: sp.Function,
    x: sp.Symbol,
) -> Tuple[Optional[sp.Expr], bool]:
    """
    Extract y(x) expression from a solution equation.
    Returns (expression, is_explicit)
    """
    try:
        y = f(x)
        if isinstance(solution_eq, sp.Equality):
            if solution_eq.lhs == y:
                return solution_eq.rhs, True
            elif solution_eq.rhs == y:
                return solution_eq.lhs, True
            else:
                diff = sp.simplify(solution_eq.lhs - solution_eq.rhs)
                try_solve = True
                if diff.has(sp.log):
                    log_args = [a for a in diff.atoms(sp.log)]
                    for la in log_args:
                        if la.args[0].has(y):
                            try_solve = False
                            break
                if try_solve:
                    try:
                        solved = sp.solve(solution_eq, y, dict=True)
                        if solved and isinstance(solved, list) and len(solved) > 0:
                            if y in solved[0]:
                                expr = solved[0][y]
                                return expr, True
                    except Exception:
                        pass
                return diff, False
        return solution_eq, True
    except Exception:
        return None, False


def _lambdify_solution(
    expr: sp.Expr,
    f: sp.Function,
    x: sp.Symbol,
    params: List[sp.Symbol],
) -> Optional[Callable]:
    """
    Convert symbolic solution expression to a numerical function.
    Enhanced lambdify with parameter support.
    """
    try:
        all_symbols = [x] + sorted(params, key=str)
        modules = ["numpy", "scipy"]
        func = sp.lambdify(all_symbols, expr, modules=modules,
                          use_imps=False, dummify=True)
        return func
    except Exception:
        try:
            modules = ["numpy"]
            all_symbols = [x] + sorted(params, key=str)
            func = sp.lambdify(all_symbols, expr, modules=modules)
            return func
        except Exception:
            return None


def _build_ode_rhs(
    normalized_expr: sp.Expr,
    f: sp.Function,
    x: sp.Symbol,
    params: List[sp.Symbol],
) -> Optional[Tuple[sp.Expr, sp.Expr]]:
    """
    Build RHS expression y' = F(x, y) from normalized ODE.
    For first-order ODEs only.
    Returns (rhs_expr, y_var) or None.
    """
    try:
        y = f(x)
        yp = sp.Derivative(y, x)
        expr_expanded = sp.expand(normalized_expr)
        coeff_yp = expr_expanded.coeff(yp)
        if coeff_yp == 0:
            return None
        rest = sp.expand(expr_expanded - coeff_yp * yp)
        rhs = sp.simplify(-rest / coeff_yp)
        return rhs, y
    except Exception:
        return None


def _numerical_rhs_from_expr(
    rhs_expr: sp.Expr,
    f: sp.Function,
    x: sp.Symbol,
    y_var: sp.Expr,
    params: List[sp.Symbol],
) -> Optional[Callable]:
    """
    Convert symbolic ODE RHS to numerical function for SciPy.
    """
    try:
        y_sym = sp.Symbol('__y')
        rhs_sub = rhs_expr.subs(y_var, y_sym)
        all_symbols = [x, y_sym] + sorted(params, key=str)
        func = sp.lambdify(all_symbols, rhs_sub, modules="numpy")
        return func
    except Exception:
        return None


def _default_param_values(params: List[sp.Symbol]) -> Dict[str, float]:
    """
    Generate default values for parameters (1.0 for all).
    """
    return {str(p): 1.0 for p in params}


def _default_ic(y0: float = 1.0) -> Dict[str, float]:
    """
    Default initial condition y(x0) = y0.
    """
    return {"x0": 0.0, "y0": y0}


def compare_solutions(
    solution_eq: sp.Equality,
    normalized_expr: sp.Expr,
    f: sp.Function,
    x: sp.Symbol,
    params: List[sp.Symbol],
    x_start: float = 0.0,
    x_end: float = 5.0,
    num_points: int = 100,
    params_values: Optional[Dict[str, float]] = None,
    initial_condition: Optional[Dict[str, float]] = None,
) -> NumericalComparison:
    """
    Compare symbolic solution with numerical RK45 solution.

    Args:
        solution_eq: Symbolic solution equation from dsolve
        normalized_expr: Normalized ODE expression
        f: Function symbol (e.g., y)
        x: Independent variable symbol
        params: List of parameter symbols
        x_start: Start of x interval
        x_end: End of x interval
        num_points: Number of evaluation points
        params_values: Dict of parameter name -> value (defaults to 1.0 for all)
        initial_condition: Dict with 'x0' and 'y0' (defaults to x=0, y=1)

    Returns:
        NumericalComparison with x values, y values, errors, and metrics
    """
    if not _SCIPY_AVAILABLE:
        return NumericalComparison(
            x_values=[], y_symbolic=[], y_numerical=[], errors=[],
            mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
            max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
            status="failed", error_message="SciPy 不可用"
        )

    try:
        if params_values is None:
            params_values = _default_param_values(params)
        if initial_condition is None:
            initial_condition = _default_ic()

        x0 = initial_condition.get("x0", 0.0)
        y0 = initial_condition.get("y0", 1.0)

        params_sorted = sorted(params, key=str)
        param_vals = [params_values.get(str(p), 1.0) for p in params_sorted]

        rhs_result = _build_ode_rhs(normalized_expr, f, x, params)
        if rhs_result is None:
            return NumericalComparison(
                x_values=[], y_symbolic=[], y_numerical=[], errors=[],
                mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
                max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
                status="failed",
                error_message="无法构造 ODE 右端（仅支持一阶 ODE）"
            )

        rhs_expr, y_var = rhs_result
        ode_rhs_func = _numerical_rhs_from_expr(rhs_expr, f, x, y_var, params)
        if ode_rhs_func is None:
            return NumericalComparison(
                x_values=[], y_symbolic=[], y_numerical=[], errors=[],
                mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
                max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
                status="failed",
                error_message="无法构造数值右端函数"
            )

        def scipy_rhs(t, y):
            try:
                result = ode_rhs_func(t, y[0], *param_vals)
                if np.isinf(result) or np.isnan(result):
                    return [1e10]
                r = float(np.real_if_close(result))
                if abs(r) > 1e12:
                    return [1e10 * np.sign(r)]
                return [r]
            except Exception:
                return [0.0]

        sol_numerical = solve_ivp(
            scipy_rhs,
            [x_start, x_end],
            [y0],
            method='LSODA',
            rtol=1e-8,
            atol=1e-10,
            dense_output=True,
            max_step=(x_end - x_start) / 100,
        )

        if not sol_numerical.success:
            for fallback_method in ['RK45', 'BDF']:
                sol_numerical = solve_ivp(
                    scipy_rhs,
                    [x_start, x_end],
                    [y0],
                    method=fallback_method,
                    rtol=1e-8,
                    atol=1e-10,
                    dense_output=True,
                    max_step=(x_end - x_start) / 100,
                )
                if sol_numerical.success:
                    break

        if not sol_numerical.success:
            return NumericalComparison(
                x_values=[], y_symbolic=[], y_numerical=[], errors=[],
                mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
                max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
                status="failed",
                error_message=f"数值求解失败: {sol_numerical.message}"
            )

        x_eval = np.linspace(x_start, x_end, num_points)
        y_num = sol_numerical.sol(x_eval)[0]

        sol_expr, is_explicit = _extract_solution_expression(solution_eq, f, x)
        y_sym = np.full_like(x_eval, np.nan, dtype=float)

        if sol_expr is not None:
            resolved_num = sol_expr
            for p, pv in zip(params_sorted, param_vals):
                resolved_num = resolved_num.subs(p, pv)

            has_complex = False
            for atom in resolved_num.atoms(sp.Pow):
                if atom.exp == sp.Rational(1, 2):
                    try:
                        if sp.N(atom.base) < 0:
                            has_complex = True
                            break
                    except Exception:
                        pass

            if has_complex or resolved_num.has(sp.I):
                pass
            else:
                C_syms = sorted(
                    [s for s in resolved_num.atoms(sp.Symbol) if str(s).startswith('C')],
                    key=str
                )
                if C_syms:
                    C1 = C_syms[0]
                    if is_explicit:
                        ic_eq = sp.Eq(resolved_num.subs(x, x0), y0)
                    else:
                        ic_eq = sp.Eq(resolved_num.subs({x: x0, y_var: y0}), 0)
                    try:
                        C_sols = sp.solve(ic_eq, C1, dict=True)
                        if C_sols and isinstance(C_sols, list) and len(C_sols) > 0:
                            resolved_num = resolved_num.subs(C_sols[0])
                    except Exception:
                        pass

                eval_expr = resolved_num
                if is_explicit:
                    sym_func = _lambdify_solution(eval_expr, f, x, [])
                    if sym_func is not None:
                        for i, xi in enumerate(x_eval):
                            try:
                                val = sym_func(xi)
                                y_sym[i] = float(np.real_if_close(val))
                            except Exception:
                                y_sym[i] = np.nan
                else:
                    _Y = sp.Symbol('_Y')
                    eval_expr_sub = eval_expr.subs(y_var, _Y)
                    implicit_func = sp.lambdify([x, _Y], eval_expr_sub, modules="numpy")
                    try:
                        from scipy.optimize import fsolve as _fsolve
                        for i, xi in enumerate(x_eval):
                            try:
                                y_guess = float(y_num[i]) if i < len(y_num) and np.isfinite(y_num[i]) else y0
                                y_guess = np.clip(y_guess, -1e6, 1e6)
                                sol_root, info, ier, msg = _fsolve(
                                    lambda yy: implicit_func(xi, yy[0]),
                                    [y_guess],
                                    full_output=True,
                                    xtol=1e-8
                                )
                                if ier == 1:
                                    y_sym[i] = float(np.real_if_close(sol_root[0]))
                            except Exception:
                                pass
                    except ImportError:
                        for i, xi in enumerate(x_eval):
                            try:
                                eq_at_xi = sp.Eq(eval_expr.subs(x, xi), 0)
                                y_guess = float(y_num[i]) if i < len(y_num) and np.isfinite(y_num[i]) else y0
                                val = sp.nsolve(eq_at_xi, y_var, y_guess, maxiter=50)
                                y_sym[i] = float(np.real_if_close(val))
                            except Exception:
                                pass

        valid_mask = np.isfinite(y_sym) & np.isfinite(y_num)
        if not np.any(valid_mask):
            return NumericalComparison(
                x_values=x_eval.tolist(),
                y_symbolic=y_sym.tolist(),
                y_numerical=y_num.tolist(),
                errors=np.zeros_like(x_eval).tolist(),
                mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
                max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
                status="warning",
                error_message="符号解无法在该区间有效计算"
            )

        x_valid = x_eval[valid_mask]
        y_sym_valid = y_sym[valid_mask]
        y_num_valid = y_num[valid_mask]
        errors = np.abs(y_sym_valid - y_num_valid)

        mae = float(np.mean(errors))
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        max_idx = int(np.argmax(errors))
        max_error = float(errors[max_idx])
        max_error_x = float(x_valid[max_idx])
        max_error_y_sym = float(y_sym_valid[max_idx])
        max_error_y_num = float(y_num_valid[max_idx])

        all_errors = np.abs(y_sym - y_num)
        all_errors[~np.isfinite(all_errors)] = np.nan

        return NumericalComparison(
            x_values=x_eval.tolist(),
            y_symbolic=y_sym.tolist(),
            y_numerical=y_num.tolist(),
            errors=all_errors.tolist(),
            mae=mae,
            rmse=rmse,
            max_error=max_error,
            max_error_x=max_error_x,
            max_error_y_symbolic=max_error_y_sym,
            max_error_y_numerical=max_error_y_num,
            ode_rhs_expr=str(rhs_expr),
            initial_condition=initial_condition,
            params_values=params_values,
            status="success",
        )

    except Exception as e:
        return NumericalComparison(
            x_values=[], y_symbolic=[], y_numerical=[], errors=[],
            mae=0.0, rmse=0.0, max_error=0.0, max_error_x=0.0,
            max_error_y_symbolic=0.0, max_error_y_numerical=0.0,
            status="failed",
            error_message=str(e)
        )
