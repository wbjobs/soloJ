const API_BASE = '/api';

export async function startOptimization(targetStart, targetEnd, budget = 50, numWorkers = 2) {
    const response = await fetch(`${API_BASE}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target_start: targetStart,
            target_end: targetEnd,
            budget,
            num_workers: numWorkers
        })
    });

    if (!response.ok) {
        throw new Error(`Optimization request failed: ${response.statusText}`);
    }

    return response.json();
}

export async function getOptimizationStatus(jobId) {
    const response = await fetch(`${API_BASE}/optimize/${jobId}`);
    if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
    }
    return response.json();
}

export async function getOptimizationHistory(jobId) {
    const response = await fetch(`${API_BASE}/optimize/${jobId}/history`);
    if (!response.ok) {
        throw new Error(`History fetch failed: ${response.statusText}`);
    }
    return response.json();
}

export async function computeSingle(params, options = {}) {
    const response = await fetch(`${API_BASE}/compute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            params,
            compute_band_structure: options.computeBandStructure ?? true,
            compute_transmission_loss: options.computeTransmissionLoss ?? false
        })
    });

    if (!response.ok) {
        throw new Error(`Compute request failed: ${response.statusText}`);
    }
    return response.json();
}

export async function getParamRanges() {
    const response = await fetch(`${API_BASE}/param-ranges`);
    if (!response.ok) {
        throw new Error(`Param ranges fetch failed: ${response.statusText}`);
    }
    return response.json();
}

export async function trainSurrogateModel(nSamples = 2000, epochs = 150) {
    const response = await fetch(`${API_BASE}/surrogate/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ n_samples: nSamples, epochs })
    });

    if (!response.ok) {
        throw new Error(`Surrogate training failed: ${response.statusText}`);
    }
    return response.json();
}

export async function getSurrogateModelInfo() {
    const response = await fetch(`${API_BASE}/surrogate/info`);
    if (!response.ok) {
        throw new Error(`Surrogate info fetch failed: ${response.statusText}`);
    }
    return response.json();
}

export async function runSensitivityAnalysis(targetStart = 500, targetEnd = 800, nSamples = 4096) {
    const response = await fetch(`${API_BASE}/sensitivity/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            target_start: targetStart,
            target_end: targetEnd,
            n_samples: nSamples
        })
    });

    if (!response.ok) {
        throw new Error(`Sensitivity analysis failed: ${response.statusText}`);
    }
    return response.json();
}

export async function getSensitivityAnalysisStatus(jobId) {
    const response = await fetch(`${API_BASE}/sensitivity/status/${jobId}`);
    if (!response.ok) {
        throw new Error(`Sensitivity status fetch failed: ${response.statusText}`);
    }
    return response.json();
}

export async function surrogatePredict(params) {
    const response = await fetch(`${API_BASE}/surrogate/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params })
    });

    if (!response.ok) {
        throw new Error(`Surrogate prediction failed: ${response.statusText}`);
    }
    return response.json();
}
