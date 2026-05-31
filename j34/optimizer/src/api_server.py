import os
import sys
import json
import uuid
from datetime import datetime
from typing import Dict, Optional
from dataclasses import asdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
from rq import Queue

from src import FEMClient, OptimizationConfig, BandGapOptimizer
from src import SurrogateModelTrainer, SobolSensitivityAnalysis, run_sensitivity_analysis

app = Flask(__name__)
CORS(app)

redis_conn = redis.Redis(host='localhost', port=6379, db=0)
task_queue = Queue('optimization', connection=redis_conn)

OPTIMIZATION_JOBS: Dict[str, Dict] = {}
SENSITIVITY_JOBS: Dict[str, Dict] = {}

_surrogate_trainer = None


def get_surrogate_trainer():
    global _surrogate_trainer
    if _surrogate_trainer is None:
        try:
            _surrogate_trainer = SurrogateModelTrainer()
            _surrogate_trainer.load()
        except Exception as e:
            print(f"Failed to initialize surrogate trainer: {e}")
    return _surrogate_trainer

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "fem_service_online": FEMClient().health_check()
    })

@app.route('/api/optimize', methods=['POST'])
def start_optimization():
    try:
        data = request.json
        
        config = OptimizationConfig(
            target_band_gap_start=data.get('target_start', 500.0),
            target_band_gap_end=data.get('target_end', 800.0),
            budget=data.get('budget', 50),
            num_workers=data.get('num_workers', 2)
        )
        
        if 'param_limits' in data:
            config.param_limits.update(data['param_limits'])
        
        job_id = str(uuid.uuid4())
        
        job = task_queue.enqueue(
            'worker.tasks.run_optimization',
            job_id=job_id,
            config=asdict(config),
            job_timeout='2h'
        )
        
        OPTIMIZATION_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "config": asdict(config),
            "created_at": datetime.now().isoformat(),
            "rq_job_id": job.id
        }
        
        return jsonify({
            "success": True,
            "job_id": job_id,
            "message": "Optimization job queued successfully"
        }), 202
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 400

@app.route('/api/optimize/<job_id>', methods=['GET'])
def get_optimization_status(job_id):
    job_info = OPTIMIZATION_JOBS.get(job_id)
    
    if not job_info:
        return jsonify({
            "status": "not_found",
            "job_id": job_id
        }), 404
    
    rq_job_id = job_info.get('rq_job_id')
    if rq_job_id:
        rq_job = task_queue.fetch_job(rq_job_id)
        if rq_job:
            job_info['rq_status'] = rq_job.get_status()
    
    return jsonify(job_info)

@app.route('/api/optimize/<job_id>/history', methods=['GET'])
def get_optimization_history(job_id):
    try:
        result_key = f"optimization_result:{job_id}"
        result_data = redis_conn.get(result_key)
        
        if result_data:
            result = json.loads(result_data)
            return jsonify({
                "job_id": job_id,
                "history": result.get('optimization_history', []),
                "best_params": result.get('best_params'),
                "best_band_gaps": result.get('best_band_gaps')
            })
        
        return jsonify({
            "job_id": job_id,
            "history": [],
            "message": "Results not yet available"
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route('/api/compute', methods=['POST'])
def compute_single():
    try:
        data = request.json
        params = data.get('params', {})
        
        client = FEMClient()
        result = client.compute(
            params,
            compute_band_structure=data.get('compute_band_structure', True),
            compute_transmission_loss=data.get('compute_transmission_loss', False)
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 400

@app.route('/api/param-ranges', methods=['GET'])
def get_param_ranges():
    default_config = OptimizationConfig()
    return jsonify({
        "param_limits": default_config.param_limits,
        "defaults": {
            "lattice_constant": 0.05,
            "cylinder_radius": 0.015,
            "cylinder_height": 0.03,
            "matrix_density": 1200.0,
            "matrix_speed_of_sound": 2500.0,
            "scatterer_density": 7800.0,
            "scatterer_speed_of_sound": 5000.0,
            "filling_fraction": 0.28
        }
    })

@app.route('/api/surrogate/info', methods=['GET'])
def get_surrogate_info():
    trainer = get_surrogate_trainer()
    if trainer is None:
        return jsonify({
            "is_trained": False,
            "error": "Surrogate trainer not initialized"
        }), 500

    info = trainer.get_model_info()
    return jsonify(info)

@app.route('/api/surrogate/train', methods=['POST'])
def train_surrogate():
    try:
        data = request.json
        n_samples = data.get('n_samples', 2000)
        epochs = data.get('epochs', 150)

        trainer = SurrogateModelTrainer()
        trainer.prepare_data(use_synthetic_if_empty=True, n_synthetic=n_samples)
        result = trainer.train(epochs=epochs)

        global _surrogate_trainer
        _surrogate_trainer = trainer

        return jsonify(result)

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route('/api/surrogate/predict', methods=['POST'])
def surrogate_predict():
    try:
        data = request.json
        params = data.get('params', {})

        trainer = get_surrogate_trainer()
        if trainer is None or not trainer.is_trained:
            return jsonify({
                "success": False,
                "message": "Surrogate model not trained"
            }), 400

        prediction, std = trainer.predict(params, return_std=True)

        return jsonify({
            "predicted_score": float(prediction),
            "uncertainty": float(std) if std is not None else None
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route('/api/sensitivity/analyze', methods=['POST'])
def analyze_sensitivity():
    try:
        data = request.json
        target_start = data.get('target_start', 500.0)
        target_end = data.get('target_end', 800.0)
        n_samples = data.get('n_samples', 4096)

        trainer = get_surrogate_trainer()
        if trainer is None or not trainer.is_trained:
            return jsonify({
                "success": False,
                "message": "Surrogate model not trained, please train first",
                "needs_training": True
            }), 400

        job_id = str(uuid.uuid4())

        job = task_queue.enqueue(
            'worker.tasks.run_sensitivity_analysis',
            job_id=job_id,
            target_start=target_start,
            target_end=target_end,
            n_samples=n_samples,
            job_timeout='30m'
        )

        SENSITIVITY_JOBS[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "target_start": target_start,
            "target_end": target_end,
            "n_samples": n_samples,
            "created_at": datetime.now().isoformat(),
            "rq_job_id": job.id
        }

        try:
            result = run_sensitivity_analysis(
                n_samples=n_samples,
                target_start=target_start,
                target_end=target_end,
                train_if_needed=False
            )
            SENSITIVITY_JOBS[job_id]["status"] = "completed"
            SENSITIVITY_JOBS[job_id]["result"] = result
            return jsonify(result)
        except Exception as e:
            SENSITIVITY_JOBS[job_id]["status"] = "failed"
            SENSITIVITY_JOBS[job_id]["error"] = str(e)
            raise

    except Exception as e:
        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

@app.route('/api/sensitivity/status/<job_id>', methods=['GET'])
def get_sensitivity_status(job_id):
    job_info = SENSITIVITY_JOBS.get(job_id)

    if not job_info:
        return jsonify({
            "status": "not_found",
            "job_id": job_id
        }), 404

    rq_job_id = job_info.get('rq_job_id')
    if rq_job_id:
        rq_job = task_queue.fetch_job(rq_job_id)
        if rq_job:
            job_info['rq_status'] = rq_job.get_status()

    return jsonify(job_info)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8082, debug=True)
