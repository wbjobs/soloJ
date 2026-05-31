import requests
import time
from typing import Dict, Optional, Tuple
import os
import logging

from .utils import extract_band_gaps as _extract_band_gaps

logger = logging.getLogger(__name__)


class FEMClient:
    def __init__(self, base_url: str = "http://localhost:8081"):
        self.base_url = base_url
        self.connect_timeout = 10
        self.max_total_timeout = 180
        self.max_poll_attempts = 90

    def health_check(self) -> bool:
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.debug(f"Health check failed: {e}")
            return False

    def submit_compute_job(
        self,
        params: Dict[str, float],
        compute_band_structure: bool = True,
        compute_transmission_loss: bool = False
    ) -> str:
        payload = {
            "params": params,
            "compute_band_structure": compute_band_structure,
            "compute_transmission_loss": compute_transmission_loss
        }

        try:
            response = requests.post(
                f"{self.base_url}/api/compute",
                json=payload,
                timeout=self.connect_timeout
            )

            if response.status_code == 202:
                return response.json()["job_id"]
            else:
                raise Exception(f"Job submission failed: HTTP {response.status_code}: {response.text}")
        except requests.exceptions.Timeout:
            raise TimeoutError("Job submission timed out")
        except requests.exceptions.ConnectionError:
            raise ConnectionError(f"Cannot connect to FEM server at {self.base_url}")

    def get_job_result(
        self,
        job_id: str,
        wait: bool = True,
        poll_interval: float = 2.0,
        max_wait: Optional[float] = None
    ) -> Optional[Dict]:
        max_wait = max_wait or self.max_total_timeout
        start_time = time.time()
        poll_attempts = 0

        while True:
            elapsed = time.time() - start_time
            if elapsed > max_wait:
                logger.warning(f"Job {job_id} timed out after {max_wait}s")
                return {
                    "job_id": job_id,
                    "status": "timeout",
                    "error": f"Job timed out after {max_wait}s"
                }

            if poll_attempts >= self.max_poll_attempts:
                logger.warning(f"Job {job_id} exceeded max poll attempts")
                return {
                    "job_id": job_id,
                    "status": "timeout",
                    "error": f"Exceeded max poll attempts ({self.max_poll_attempts})"
                }

            try:
                response = requests.get(
                    f"{self.base_url}/api/result/{job_id}",
                    timeout=self.connect_timeout
                )

                if response.status_code == 404:
                    return None

                result = response.json()
                status = result.get("status")

                if status == "processing" and wait:
                    poll_attempts += 1
                    time.sleep(poll_interval)
                    continue
                else:
                    return result

            except requests.exceptions.Timeout:
                logger.warning(f"Poll timeout for job {job_id} (attempt {poll_attempts})")
                poll_attempts += 1
                time.sleep(poll_interval * 1.5)
                continue
            except requests.exceptions.ConnectionError as e:
                logger.warning(f"Connection error polling job {job_id}: {e}")
                poll_attempts += 1
                time.sleep(poll_interval * 2)
                continue

    def compute(
        self,
        params: Dict[str, float],
        compute_band_structure: bool = True,
        compute_transmission_loss: bool = False,
        timeout: Optional[float] = None
    ) -> Dict:
        try:
            job_id = self.submit_compute_job(
                params,
                compute_band_structure,
                compute_transmission_loss
            )
            return self.get_job_result(job_id, wait=True, max_wait=timeout)
        except (TimeoutError, ConnectionError) as e:
            return {
                "status": "failed",
                "error": str(e)
            }

    @staticmethod
    def extract_band_gaps(eigenvalues: list, threshold_ratio: float = 0.05) -> list:
        return _extract_band_gaps(eigenvalues, threshold_ratio)
