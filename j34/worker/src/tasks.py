import os
import sys
import json
import redis
import h5py
import numpy as np
from datetime import datetime
from dataclasses import asdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'optimizer'))

from src import FEMClient, OptimizationConfig, BandGapOptimizer
from src import run_sensitivity_analysis as run_sens_analysis

redis_conn = redis.Redis(host='localhost', port=6379, db=0)

HDF5_BASE_PATH = os.environ.get('HDF5_BASE_PATH', os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'data', 'hdf5'
))

INFLUXDB_URL = os.environ.get('INFLUXDB_URL', 'http://localhost:8086')
INFLUXDB_TOKEN = os.environ.get('INFLUXDB_TOKEN', 'my-secret-token')
INFLUXDB_ORG = os.environ.get('INFLUXDB_ORG', 'acoustic_metamaterial')
INFLUXDB_BUCKET = os.environ.get('INFLUXDB_BUCKET', 'optimization_logs')


def write_to_influxdb(iteration_data: dict):
    try:
        from influxdb_client import InfluxDBClient, Point, WritePrecision
        from influxdb_client.client.write_api import SYNCHRONOUS
        
        client = InfluxDBClient(url=INFLUXDB_URL, token=INFLUXDB_TOKEN, org=INFLUXDB_ORG)
        write_api = client.write_api(write_options=SYNCHRONOUS)
        
        point = Point("optimization_iteration") \
            .tag("job_id", iteration_data.get("job_id", "unknown")) \
            .field("iteration", int(iteration_data.get("iteration", 0))) \
            .field("objective_score", float(iteration_data.get("objective_score", 0))) \
            .field("num_band_gaps", len(iteration_data.get("band_gaps", []))) \
            .time(datetime.utcnow(), WritePrecision.MS)
        
        for param_name, param_value in iteration_data.get("params", {}).items():
            point.field(f"param_{param_name}", float(param_value))
        
        write_api.write(bucket=INFLUXDB_BUCKET, org=INFLUXDB_ORG, record=point)
        client.close()
        
    except Exception as e:
        print(f"InfluxDB write error: {e}")


def save_to_hdf5(job_id: str, result_data: dict):
    os.makedirs(HDF5_BASE_PATH, exist_ok=True)
    filepath = os.path.join(HDF5_BASE_PATH, f"{job_id}.h5")
    
    with h5py.File(filepath, 'w') as f:
        params_grp = f.create_group('parameters')
        for k, v in result_data.get('best_params', {}).items():
            params_grp.attrs[k] = v
        
        config_grp = f.create_group('config')
        config = result_data.get('config', {})
        config_grp.attrs['target_start'] = config.get('target_band_gap_start', 0)
        config_grp.attrs['target_end'] = config.get('target_band_gap_end', 0)
        config_grp.attrs['budget'] = config.get('budget', 0)
        
        gaps = result_data.get('best_band_gaps', [])
        if gaps:
            gap_data = np.array([[g['start'], g['end'], g['width'], g['center']] for g in gaps])
            f.create_dataset('band_gaps', data=gap_data)
        
        history = result_data.get('optimization_history', [])
        if history:
            iterations = np.array([h['iteration'] for h in history])
            scores = np.array([h['objective_score'] for h in history])
            
            hist_grp = f.create_group('history')
            hist_grp.create_dataset('iterations', data=iterations)
            hist_grp.create_dataset('scores', data=scores)
    
    return filepath


def on_iteration_callback(job_id: str, iteration_data: dict):
    iteration_data['job_id'] = job_id
    write_to_influxdb(iteration_data)
    
    progress_key = f"optimization_progress:{job_id}"
    redis_conn.setex(
        progress_key,
        3600,
        json.dumps({
            "iteration": iteration_data["iteration"],
            "score": iteration_data["objective_score"],
            "timestamp": iteration_data["timestamp"]
        })
    )


def run_optimization(job_id: str, config: dict) -> dict:
    try:
        redis_conn.set(
            f"optimization_status:{job_id}",
            json.dumps({"status": "running", "started_at": datetime.now().isoformat()})
        )
        
        opt_config = OptimizationConfig(
            target_band_gap_start=config.get('target_band_gap_start', 500.0),
            target_band_gap_end=config.get('target_band_gap_end', 800.0),
            budget=config.get('budget', 50),
            num_workers=config.get('num_workers', 2),
            optimizer=config.get('optimizer', 'BO'),
            param_limits=config.get('param_limits', OptimizationConfig().param_limits)
        )
        
        fem_client = FEMClient()
        optimizer = BandGapOptimizer(config=opt_config, fem_client=fem_client)
        
        optimizer.set_iteration_callback(
            lambda data: on_iteration_callback(job_id, data)
        )
        
        result = optimizer.optimize()
        
        result_dict = {
            "job_id": job_id,
            "status": "completed",
            "best_params": result.best_params,
            "best_objective": result.best_objective,
            "best_band_gaps": result.best_band_gaps,
            "config": asdict(result.config),
            "optimization_history": result.optimization_history,
            "completed_at": datetime.now().isoformat()
        }
        
        hdf5_path = save_to_hdf5(job_id, result_dict)
        result_dict["hdf5_path"] = hdf5_path
        
        redis_conn.setex(
            f"optimization_result:{job_id}",
            86400,
            json.dumps(result_dict, default=str)
        )
        
        redis_conn.set(
            f"optimization_status:{job_id}",
            json.dumps({"status": "completed", "completed_at": datetime.now().isoformat()})
        )
        
        return result_dict
        
    except Exception as e:
        redis_conn.set(
            f"optimization_status:{job_id}",
            json.dumps({"status": "failed", "error": str(e)})
        )
        raise


def run_sensitivity_analysis(
    job_id: str,
    target_start: float = 500.0,
    target_end: float = 800.0,
    n_samples: int = 4096
) -> dict:
    try:
        redis_conn.set(
            f"sensitivity_status:{job_id}",
            json.dumps({
                "status": "running",
                "target_start": target_start,
                "target_end": target_end,
                "n_samples": n_samples,
                "started_at": datetime.now().isoformat()
            })
        )

        result = run_sens_analysis(
            n_samples=n_samples,
            target_start=target_start,
            target_end=target_end,
            train_if_needed=True
        )

        result_dict = {
            "job_id": job_id,
            "status": "completed",
            "result": result,
            "completed_at": datetime.now().isoformat()
        }

        redis_conn.setex(
            f"sensitivity_result:{job_id}",
            86400,
            json.dumps(result_dict, default=str)
        )

        redis_conn.set(
            f"sensitivity_status:{job_id}",
            json.dumps({"status": "completed", "completed_at": datetime.now().isoformat()})
        )

        return result_dict

    except Exception as e:
        redis_conn.set(
            f"sensitivity_status:{job_id}",
            json.dumps({"status": "failed", "error": str(e)})
        )
        raise
