"""Flask application: DNA/protein sequence alignment service."""
from __future__ import annotations

import hashlib
import json
import os
from typing import Any, Dict, List

from flask import Flask, jsonify, make_response, request
from flask_cors import CORS

from .fasta_utils import parse_fasta, validate_any
from .matrices import list_matrices
from .similarity import export_gff3, multi_sliding_window, sliding_window_similarity
from .smith_waterman import (
    DEFAULT_GAP_EXT,
    DEFAULT_GAP_OPEN,
    align,
    heatmap_diff_regions,
)


MAX_SEQ_LEN = 100000
MAX_SEQUENCES = 5
HEATMAP_BINS = 200

app = Flask(__name__)
CORS(app)


# ---------- Redis caching (optional) ----------
_redis = None
try:
    import redis  # type: ignore

    _redis_host = os.environ.get("REDIS_HOST", "localhost")
    _redis_port = int(os.environ.get("REDIS_PORT", "6379"))
    _redis_db = int(os.environ.get("REDIS_DB", "0"))
    _redis = redis.Redis(host=_redis_host, port=_redis_port, db=_redis_db, decode_responses=True)
    _redis.ping()
except Exception:  # pragma: no cover - Redis is optional
    _redis = None


def _cache_key(seq1: str, seq2: str, matrix: str, go: int, ge: int) -> str:
    h = hashlib.sha1()
    h.update(seq1.encode("ascii"))
    h.update(b"|")
    h.update(seq2.encode("ascii"))
    h.update(f"|{matrix}|{go}|{ge}".encode("ascii"))
    return "sw:" + h.hexdigest()


def _cache_get(key: str) -> Dict[str, Any] | None:
    if _redis is None:
        return None
    try:
        raw = _redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception:
        return None
    return None


def _cache_set(key: str, payload: Dict[str, Any], ttl: int = 3600) -> None:
    if _redis is None:
        return
    try:
        _redis.set(key, json.dumps(payload), ex=ttl)
    except Exception:
        pass


# ---------- Helpers ----------
def _validate_sequences(seqs: List[str], max_seqs: int = MAX_SEQUENCES) -> str | None:
    if len(seqs) < 2:
        return "at least 2 sequences required"
    if len(seqs) > max_seqs:
        return f"maximum {max_seqs} sequences allowed (got {len(seqs)})"
    for i, s in enumerate(seqs):
        if not validate_any(s, MAX_SEQ_LEN):
            return f"sequence {i+1}: must be 1..{MAX_SEQ_LEN} characters (got {len(s)})"
    return None


# ---------- API routes ----------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "redis": "connected" if _redis else "disabled",
            "max_seq_len": MAX_SEQ_LEN,
            "max_sequences": MAX_SEQUENCES,
        }
    )


@app.route("/api/matrices", methods=["GET"])
def list_matrix_api():
    return jsonify({"matrices": list_matrices()})


@app.route("/api/parse-fasta", methods=["POST"])
def parse_fasta_api():
    data = request.get_json(force=True, silent=True) or {}
    text = data.get("text", "") or ""
    try:
        records = parse_fasta(text)
    except Exception as exc:
        return jsonify({"error": f"parse error: {exc}"}), 400
    return jsonify(
        {
            "records": [
                {"header": h, "sequence": s, "length": len(s)} for (h, s) in records
            ]
        }
    )


@app.route("/api/align", methods=["POST"])
def align_api():
    data = request.get_json(force=True, silent=True) or {}
    seq1 = (data.get("seq1") or "").upper()
    seq2 = (data.get("seq2") or "").upper()
    matrix = (data.get("matrix") or "DNA").strip().upper()
    gap_open = int(data.get("gap_open", DEFAULT_GAP_OPEN))
    gap_ext = int(data.get("gap_ext", DEFAULT_GAP_EXT))
    heatmap_bins = int(data.get("heatmap_bins", HEATMAP_BINS))

    if not validate_any(seq1, MAX_SEQ_LEN) or not validate_any(seq2, MAX_SEQ_LEN):
        return jsonify(
            {
                "error": f"each sequence must be 1..{MAX_SEQ_LEN} characters "
                f"(got {len(seq1)} and {len(seq2)})"
            }
        ), 400

    try:
        available = [m.lower() for m in list_matrices()]
        if matrix.lower() not in available:
            return jsonify({"error": f"unknown matrix: {matrix}"}), 400
    except Exception:
        pass

    cache_key = _cache_key(seq1, seq2, matrix, gap_open, gap_ext)
    cached = _cache_get(cache_key)
    if cached:
        cached["cached"] = True
        return jsonify(cached)

    result = align(
        seq1,
        seq2,
        matrix_name=matrix,
        gap_open=gap_open,
        gap_ext=gap_ext,
        heatmap_bins=heatmap_bins,
    )
    payload = {
        "cached": False,
        "score": result.score,
        "score_percent": result.score_percent,
        "length": result.length,
        "matches": result.matches,
        "mismatches": result.mismatches,
        "gaps": result.gaps,
        "seq1": {
            "start": result.seq1_start,
            "end": result.seq1_end,
            "length": result.seq1_len,
            "aligned": result.aligned_seq1,
        },
        "seq2": {
            "start": result.seq2_start,
            "end": result.seq2_end,
            "length": result.seq2_len,
            "aligned": result.aligned_seq2,
        },
        "midline": result.midline,
        "heatmap": {
            "rows": result.heatmap_rows,
            "cols": result.heatmap_cols,
            "data": result.heatmap,
            "seq1_len": result.seq1_len,
            "seq2_len": result.seq2_len,
        },
    }
    _cache_set(cache_key, payload)
    return jsonify(payload)


@app.route("/api/align/multi", methods=["POST"])
def align_multi_api():
    """Align all pairs from a set of sequences (max 5)."""
    data = request.get_json(force=True, silent=True) or {}
    sequences = [str(s).upper() for s in (data.get("sequences") or [])]
    matrix = (data.get("matrix") or "DNA").strip().upper()
    gap_open = int(data.get("gap_open", DEFAULT_GAP_OPEN))
    gap_ext = int(data.get("gap_ext", DEFAULT_GAP_EXT))
    heatmap_bins = int(data.get("heatmap_bins", 100))

    err = _validate_sequences(sequences)
    if err:
        return jsonify({"error": err}), 400

    try:
        available = [m.lower() for m in list_matrices()]
        if matrix.lower() not in available:
            return jsonify({"error": f"unknown matrix: {matrix}"}), 400
    except Exception:
        pass

    results: Dict[str, Any] = {}
    n = len(sequences)
    for i in range(n):
        for j in range(i + 1, n):
            key = f"seq{i+1}_vs_seq{j+1}"
            result = align(
                sequences[i],
                sequences[j],
                matrix_name=matrix,
                gap_open=gap_open,
                gap_ext=gap_ext,
                heatmap_bins=heatmap_bins,
            )
            results[key] = {
                "score": result.score,
                "score_percent": result.score_percent,
                "length": result.length,
                "matches": result.matches,
                "mismatches": result.mismatches,
                "gaps": result.gaps,
                "seq1_start": result.seq1_start,
                "seq1_end": result.seq1_end,
                "seq2_start": result.seq2_start,
                "seq2_end": result.seq2_end,
                "aligned_seq1": result.aligned_seq1,
                "aligned_seq2": result.aligned_seq2,
                "midline": result.midline,
                "heatmap": {
                    "rows": result.heatmap_rows,
                    "cols": result.heatmap_cols,
                    "data": result.heatmap,
                },
            }

    return jsonify(
        {
            "num_sequences": n,
            "num_pairs": len(results),
            "pairs": results,
        }
    )


@app.route("/api/similarity/windows", methods=["POST"])
def similarity_windows_api():
    """Sliding-window similarity scan between two sequences."""
    data = request.get_json(force=True, silent=True) or {}
    seq1 = (data.get("seq1") or "").upper()
    seq2 = (data.get("seq2") or "").upper()
    window_size = int(data.get("window_size", 100))
    step = int(data.get("step", 10))
    min_similarity = float(data.get("min_similarity", 0.85))
    min_region_length = int(data.get("min_region_length", 50))
    merge_distance = int(data.get("merge_distance", 20))

    if not validate_any(seq1, MAX_SEQ_LEN) or not validate_any(seq2, MAX_SEQ_LEN):
        return jsonify({"error": f"each sequence must be 1..{MAX_SEQ_LEN} characters"}), 400

    if window_size < 10 or window_size > 2000:
        return jsonify({"error": "window_size must be 10..2000"}), 400

    regions = sliding_window_similarity(
        seq1,
        seq2,
        window_size=window_size,
        step=step,
        min_similarity=min_similarity,
        min_region_length=min_region_length,
        merge_distance=merge_distance,
    )
    return jsonify(
        {
            "window_size": window_size,
            "step": step,
            "min_similarity": min_similarity,
            "regions": [
                {
                    "seq_id": r.seq_id,
                    "start": r.start,
                    "end": r.end,
                    "score": r.score,
                    "length": r.end - r.start + 1,
                }
                for r in regions
            ],
        }
    )


@app.route("/api/similarity/multi", methods=["POST"])
def similarity_multi_api():
    """Sliding-window similarity across multiple sequences (all pairs)."""
    data = request.get_json(force=True, silent=True) or {}
    sequences = [str(s).upper() for s in (data.get("sequences") or [])]
    window_size = int(data.get("window_size", 100))
    step = int(data.get("step", 10))
    min_similarity = float(data.get("min_similarity", 0.85))

    err = _validate_sequences(sequences)
    if err:
        return jsonify({"error": err}), 400

    results = multi_sliding_window(
        sequences,
        window_size=window_size,
        step=step,
        min_similarity=min_similarity,
    )
    response = {}
    for key, regions in results.items():
        response[key] = [
            {
                "seq_id": r.seq_id,
                "start": r.start,
                "end": r.end,
                "score": r.score,
                "length": r.end - r.start + 1,
            }
            for r in regions
        ]
    return jsonify(
        {
            "num_sequences": len(sequences),
            "window_size": window_size,
            "min_similarity": min_similarity,
            "pairs": response,
        }
    )


@app.route("/api/export/gff3", methods=["POST"])
def export_gff3_api():
    """Export similarity regions as GFF3 annotation file."""
    data = request.get_json(force=True, silent=True) or {}
    regions_raw = data.get("regions") or []
    ref_seq = str(data.get("ref_seq") or "reference")
    source = str(data.get("source") or "dna_align_tool")
    seq_id_prefix = str(data.get("seq_id_prefix") or "region")

    regions = []
    from .similarity import SimilarityRegion

    for i, r in enumerate(regions_raw):
        regions.append(
            SimilarityRegion(
                seq_id=r.get("seq_id", f"{seq_id_prefix}_{i+1}"),
                start=int(r.get("start", 0)),
                end=int(r.get("end", 0)),
                score=float(r.get("score", 0)),
                source=r.get("source", source),
                feature=r.get("feature", "similarity_region"),
            )
        )

    gff_text = export_gff3(
        regions,
        ref_seq=ref_seq,
        header_comments=[f"source={source}", f"num_regions={len(regions)}"],
    )

    response = make_response(gff_text)
    response.headers["Content-Type"] = "text/plain; charset=utf-8"
    response.headers["Content-Disposition"] = 'attachment; filename="similarity_regions.gff3"'
    return response


@app.route("/api/heatmap/diff", methods=["POST"])
def heatmap_diff_api():
    data = request.get_json(force=True, silent=True) or {}
    heatmap = data.get("heatmap") or []
    threshold = float(data.get("threshold", 0.5))
    if not isinstance(heatmap, list) or not heatmap:
        return jsonify({"error": "heatmap data required"}), 400
    regions = heatmap_diff_regions(heatmap, threshold=threshold)
    return jsonify({"threshold": threshold, "regions": regions})


def create_app():
    return app


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5001")), debug=False)
