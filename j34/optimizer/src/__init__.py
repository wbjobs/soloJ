__all__ = [
    "FEMClient",
    "OptimizationConfig",
    "OptimizationResult",
    "BandGapOptimizer",
    "enforce_physical_constraints",
    "validate_params",
    "HDF5Storage",
    "InfluxDBLogger",
    "BandGapDataset",
    "BandGapNN",
    "EnsembleNN",
    "SurrogateModelTrainer",
    "SobolSensitivityAnalysis",
    "SensitivityResult",
    "run_sensitivity_analysis"
]


def __getattr__(name):
    if name == "FEMClient":
        from .fem_client import FEMClient
        return FEMClient
    elif name in ("OptimizationConfig", "OptimizationResult", "BandGapOptimizer",
                  "enforce_physical_constraints", "validate_params"):
        from .bayesian_optimizer import (
            OptimizationConfig, OptimizationResult, BandGapOptimizer,
            enforce_physical_constraints, validate_params
        )
        return locals()[name]
    elif name == "HDF5Storage":
        from .storage import HDF5Storage
        return HDF5Storage
    elif name == "InfluxDBLogger":
        from .influx_logger import InfluxDBLogger
        return InfluxDBLogger
    elif name == "BandGapDataset":
        from .surrogate_model import BandGapDataset
        return BandGapDataset
    elif name in ("BandGapNN", "EnsembleNN", "SurrogateModelTrainer"):
        from .nn_surrogate import BandGapNN, EnsembleNN, SurrogateModelTrainer
        return locals()[name]
    elif name in ("SobolSensitivityAnalysis", "SensitivityResult", "run_sensitivity_analysis"):
        from .sobol_sensitivity import (
            SobolSensitivityAnalysis, SensitivityResult, run_sensitivity_analysis
        )
        return locals()[name]
    else:
        raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
