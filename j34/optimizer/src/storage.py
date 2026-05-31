import h5py
import numpy as np
import os
from datetime import datetime
from typing import Dict, List, Optional


class HDF5Storage:
    def __init__(self, base_path: str = None):
        if base_path is None:
            base_path = os.environ.get(
                'HDF5_BASE_PATH',
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'hdf5')
            )
        self.base_path = base_path
        os.makedirs(self.base_path, exist_ok=True)

    def _get_filepath(self, job_id: str) -> str:
        return os.path.join(self.base_path, f"{job_id}.h5")

    def save_optimization_result(self, job_id: str, result: Dict) -> str:
        filepath = self._get_filepath(job_id)

        with h5py.File(filepath, 'w') as f:
            f.attrs['job_id'] = job_id
            f.attrs['created_at'] = datetime.now().isoformat()
            f.attrs['format_version'] = '1.0'

            params_grp = f.create_group('best_parameters')
            for k, v in result.get('best_params', {}).items():
                params_grp.attrs[k] = float(v)

            config_grp = f.create_group('config')
            config = result.get('config', {})
            for k, v in config.items():
                if isinstance(v, (int, float, str)):
                    config_grp.attrs[k] = v
                elif isinstance(v, dict):
                    for sk, sv in v.items():
                        config_grp.attrs[f"{k}_{sk}"] = sv

            gaps = result.get('best_band_gaps', [])
            if gaps:
                gap_data = np.array([
                    [g.get('start', 0), g.get('end', 0),
                     g.get('width', 0), g.get('center', 0),
                     g.get('relative_width', 0)]
                    for g in gaps
                ])
                gap_ds = f.create_dataset('band_gaps', data=gap_data)
                gap_ds.attrs['columns'] = 'start,end,width,center,relative_width'

            history = result.get('optimization_history', [])
            if history:
                hist_grp = f.create_group('optimization_history')

                iterations = np.array([h.get('iteration', 0) for h in history])
                scores = np.array([h.get('objective_score', 0) for h in history])
                timestamps = [h.get('timestamp', '') for h in history]

                hist_grp.create_dataset('iterations', data=iterations)
                hist_grp.create_dataset('scores', data=scores)

                max_len = max(len(h.get('params', {})) for h in history) if history else 0
                if max_len > 0:
                    param_keys = list(history[0].get('params', {}).keys()) if history else []
                    for pk in param_keys:
                        values = [h.get('params', {}).get(pk, np.nan) for h in history]
                        hist_grp.create_dataset(f'param_{pk}', data=np.array(values))

                dt = h5py.special_dtype(vlen=str)
                hist_grp.create_dataset('timestamps', data=timestamps, dtype=dt)

        return filepath

    def load_optimization_result(self, job_id: str) -> Optional[Dict]:
        filepath = self._get_filepath(job_id)
        if not os.path.exists(filepath):
            return None

        result = {'job_id': job_id}

        with h5py.File(filepath, 'r') as f:
            result['created_at'] = f.attrs.get('created_at', '')

            if 'best_parameters' in f:
                params_grp = f['best_parameters']
                result['best_params'] = dict(params_grp.attrs)

            if 'config' in f:
                config_grp = f['config']
                result['config'] = dict(config_grp.attrs)

            if 'band_gaps' in f:
                gap_data = f['band_gaps'][:]
                result['best_band_gaps'] = [
                    {
                        'start': row[0], 'end': row[1],
                        'width': row[2], 'center': row[3],
                        'relative_width': row[4]
                    }
                    for row in gap_data
                ]

            if 'optimization_history' in f:
                hist_grp = f['optimization_history']
                n = len(hist_grp['iterations'])
                history = []
                for i in range(n):
                    entry = {
                        'iteration': int(hist_grp['iterations'][i]),
                        'objective_score': float(hist_grp['scores'][i]),
                        'params': {}
                    }
                    for key in hist_grp.keys():
                        if key.startswith('param_'):
                            param_name = key[6:]
                            entry['params'][param_name] = float(hist_grp[key][i])
                    history.append(entry)
                result['optimization_history'] = history

        return result

    def list_results(self) -> List[str]:
        files = [f[:-3] for f in os.listdir(self.base_path) if f.endswith('.h5')]
        return sorted(files)

    def delete_result(self, job_id: str) -> bool:
        filepath = self._get_filepath(job_id)
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
