import hashlib
import json
import os
import time
from typing import Any, Dict, Optional

import sympy as sp
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import config
from backend.parser import parse_ode, ODEInput
from backend.solver import solve_ode, SolveResult
from backend.verify import verify_all


app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)


def _sanitize_for_json(obj):
    if obj is None or isinstance(obj, (str, bool)):
        return obj
    if isinstance(obj, int) and not isinstance(obj, bool):
        return obj
    if isinstance(obj, float):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(o) for o in obj]
    if isinstance(obj, dict):
        return {str(k): _sanitize_for_json(v) for k, v in obj.items()}
    try:
        return int(obj)
    except Exception:
        pass
    try:
        return float(obj)
    except Exception:
        pass
    return str(obj)


_cache_client: Optional[Any] = None


def _get_cache():
    global _cache_client
    if not config.REDIS_ENABLED:
        return None
    if _cache_client is None:
        try:
            import redis
            _cache_client = redis.Redis(
                host=config.REDIS_HOST,
                port=config.REDIS_PORT,
                db=config.REDIS_DB,
                decode_responses=True,
            )
            _cache_client.ping()
        except Exception as e:
            print(f"[cache] Redis not available: {e}")
            _cache_client = None
    return _cache_client


def _cache_key(raw: str, hint: str) -> str:
    h = hashlib.sha256(f"{raw}|{hint}".encode("utf-8")).hexdigest()
    return f"ode:solve:{h}"


def _serialize_sympy(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, (int, float, str, bool)):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_serialize_sympy(o) for o in obj]
    if isinstance(obj, dict):
        return {str(k): _serialize_sympy(v) for k, v in obj.items()}
    try:
        latex = sp.latex(obj)
    except Exception:
        latex = str(obj)
    try:
        expr_str = str(obj)
    except Exception:
        expr_str = latex
    return {"latex": latex, "str": expr_str}


def _serialize_ode_input(o: ODEInput) -> Dict[str, Any]:
    return {
        "raw_latex": o.raw_latex,
        "raw_sympy": o.raw_sympy,
        "lhs": _serialize_sympy(o.lhs),
        "rhs": _serialize_sympy(o.rhs),
        "eq": _serialize_sympy(o.eq),
        "func": str(getattr(o.func, "__name__", o.func)),
        "var": str(o.var),
        "order": o.order,
        "free_params": [str(p) for p in o.free_params],
        "parsing_steps": o.parsing_steps,
    }


def _serialize_result(result: SolveResult, verification) -> Dict[str, Any]:
    matched = []
    for t in result.matched_types:
        params_safe = None
        if t.params is not None:
            try:
                params_safe = json.loads(json.dumps(t.params, default=lambda o: str(o)))
            except Exception:
                params_safe = {k: str(v) for k, v in t.params.items()}
        matched.append({
            "code": t.code,
            "name_cn": t.name_cn,
            "name_en": t.name_en,
            "description": t.description,
            "canonical_form": str(t.canonical_form) if not isinstance(t.canonical_form, str) else t.canonical_form,
            "match_score": int(t.match_score) if hasattr(t.match_score, '__int__') else t.match_score,
            "params": params_safe,
        })
    steps = []
    for s in result.steps:
        math_safe = s.math
        if isinstance(math_safe, dict):
            math_safe = _serialize_sympy(math_safe)
        elif math_safe is not None and not isinstance(math_safe, str):
            math_safe = _serialize_sympy(math_safe)
        steps.append({
            "title": s.title,
            "description": s.description,
            "math": math_safe,
            "order": int(s.order) if hasattr(s.order, '__int__') else s.order,
        })
    return {
        "status": result.status,
        "error": result.error,
        "ode_input": _serialize_ode_input(result.ode_input),
        "normalized_expr": _serialize_sympy(result.normalized_expr),
        "primary_type": matched[0] if matched else None,
        "matched_types": matched,
        "general_solutions": [_serialize_sympy(s) for s in result.general_solutions],
        "particular_solutions": [_serialize_sympy(s) for s in result.particular_solutions],
        "steps": steps,
        "verification": [
            {
                "solution": _serialize_sympy(v["solution"]),
                "verified": v["verified"],
                "residual": _serialize_sympy(v["residual"]),
                "message": v["message"],
            }
            for v in verification
        ],
        "numerical_comparison": _serialize_numerical(result.numerical_comparison),
    }


def _serialize_numerical(num_comp: Any) -> Optional[Dict[str, Any]]:
    if num_comp is None:
        return None
    try:
        return {
            "x_values": [float(x) for x in num_comp.x_values],
            "y_symbolic": [float(y) if y is not None and isinstance(y, (int, float)) else y for y in num_comp.y_symbolic],
            "y_numerical": [float(y) if y is not None and isinstance(y, (int, float)) else y for y in num_comp.y_numerical],
            "errors": [float(e) if e is not None and isinstance(e, (int, float)) else e for e in num_comp.errors],
            "mae": float(num_comp.mae),
            "rmse": float(num_comp.rmse),
            "max_error": float(num_comp.max_error),
            "max_error_x": float(num_comp.max_error_x),
            "max_error_y_symbolic": float(num_comp.max_error_y_symbolic),
            "max_error_y_numerical": float(num_comp.max_error_y_numerical),
            "ode_rhs_expr": str(num_comp.ode_rhs_expr) if num_comp.ode_rhs_expr else None,
            "initial_condition": num_comp.initial_condition,
            "params_values": num_comp.params_values,
            "status": num_comp.status,
            "error_message": num_comp.error_message,
        }
    except Exception:
        return None


@app.route("/", methods=["GET"])
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/parse", methods=["POST"])
def api_parse():
    data = request.get_json(force=True, silent=True) or {}
    raw = (data.get("equation") or "").strip()
    hint = (data.get("format") or "").strip()
    if not raw:
        return jsonify({"ok": False, "error": "方程为空"}), 400
    try:
        ode = parse_ode(raw, format_hint=hint or None)
        return jsonify(_sanitize_for_json({"ok": True, "input": _serialize_ode_input(ode)}))
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/solve", methods=["POST"])
def api_solve():
    t0 = time.time()
    data = request.get_json(force=True, silent=True) or {}
    raw = (data.get("equation") or "").strip()
    hint = (data.get("format") or "").strip()
    if not raw:
        return jsonify({"ok": False, "error": "方程为空"}), 400

    cache = _get_cache()
    key = _cache_key(raw, hint)
    if cache is not None:
        try:
            cached = cache.get(key)
            if cached:
                return jsonify({"ok": True, "cached": True, **json.loads(cached)})
        except Exception as e:
            print(f"[cache] read failed: {e}")

    try:
        ode = parse_ode(raw, format_hint=hint or None)
    except Exception as e:
        return jsonify({"ok": False, "error": f"解析失败: {e}"}), 400

    compute_num = data.get("compute_numerical", False)
    num_x_start = float(data.get("num_x_start", 0.0))
    num_x_end = float(data.get("num_x_end", 5.0))
    num_points = int(data.get("num_points", 100))
    num_y0 = float(data.get("num_y0", 1.0))

    try:
        result = solve_ode(ode, compute_numerical=compute_num,
                          num_x_start=num_x_start, num_x_end=num_x_end,
                          num_points=num_points, y0=num_y0)
    except Exception as e:
        return jsonify({"ok": False, "error": f"求解失败: {e}"}), 500

    all_solutions = list(result.general_solutions) + list(result.particular_solutions)
    verification = verify_all(result.normalized_expr, all_solutions, ode.func, ode.var)

    payload = _serialize_result(result, verification)
    payload["elapsed_ms"] = int((time.time() - t0) * 1000)

    if cache is not None:
        try:
            safe_payload = _sanitize_for_json(payload)
            cache.setex(key, config.CACHE_TTL, json.dumps(safe_payload, ensure_ascii=False))
        except Exception as e:
            print(f"[cache] write failed: {e}")

    return jsonify(_sanitize_for_json({"ok": True, "cached": False, **payload}))


@app.route("/api/types", methods=["GET"])
def api_types():
    from backend.matchers import ALL_MATCHERS
    return jsonify({
        "count": len(ALL_MATCHERS),
        "types": [
            {
                "name_en": getattr(m, "__name__", str(m)),
                "name_cn": _MATCHER_CN.get(getattr(m, "__name__", ""), ""),
            }
            for m in ALL_MATCHERS
        ],
    })


_MATCHER_CN = {
    "_match_linear_first_order": "一阶线性非齐次方程",
    "_match_separable": "可分离变量方程",
    "_match_homogeneous": "齐次方程",
    "_match_exact": "全微分方程",
    "_match_bernoulli": "Bernoulli 方程",
    "_match_riccati": "Riccati 方程",
    "_match_riccati_special": "可约化 Riccati",
    "_match_clairaut": "Clairaut 方程",
    "_match_dalembert": "d'Alembert 方程",
    "_match_abel_first_kind": "Abel 第一类方程",
    "_match_abel_second_kind": "Abel 第二类方程",
    "_match_chini": "Chini 方程",
    "_match_homogeneous_linear_const_coeff": "常系数线性齐次方程",
    "_match_linear_nonhomogeneous_const_coeff": "常系数线性非齐次方程",
    "_match_euler": "Euler (Cauchy-Euler) 方程",
    "_match_bessel": "Bessel 方程",
    "_match_legendre": "Legendre 方程",
    "_match_hermite": "Hermite 方程",
    "_match_laguerre": "Laguerre 方程",
    "_match_chebyshev": "Chebyshev 方程",
    "_match_airy": "Airy 方程",
    "_match_weber": "Weber 方程",
    "_match_mathieu": "Mathieu 方程",
    "_match_hill": "Hill 方程",
    "_match_emden_fowler": "Emden-Fowler 方程",
    "_match_lane_emden": "Lane-Emden 方程",
    "_match_thomas_fermi": "Thomas-Fermi 方程",
    "_match_blasius": "Blasius 方程",
    "_match_missing_y": "不显含 y 的方程",
    "_match_missing_x": "不显含 x 的方程",
    "_match_autonomous": "自治方程",
}


if __name__ == "__main__":
    app.run(host=config.FLASK_HOST, port=config.FLASK_PORT,
            debug=False, use_reloader=False)
