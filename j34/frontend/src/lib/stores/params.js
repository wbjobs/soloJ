import { writable, derived } from 'svelte/store';

export const structuralParams = writable({
    lattice_constant: 0.05,
    cylinder_radius: 0.015,
    cylinder_height: 0.03
});

export const materialParams = writable({
    matrix_density: 1200.0,
    matrix_speed_of_sound: 2500.0,
    scatterer_density: 7800.0,
    scatterer_speed_of_sound: 5000.0
});

export const fillingFraction = writable(0.28);

export const allParams = derived(
    [structuralParams, materialParams, fillingFraction],
    ([$structural, $material, $ff]) => ({
        ...$structural,
        ...$material,
        filling_fraction: $ff
    })
);

export const targetBandGap = writable({
    start: 500,
    end: 800
});

export const optimizationConfig = writable({
    budget: 50,
    num_workers: 2
});

export const optimizationStatus = writable('idle');

export const optimizationJobId = writable(null);

export const optimizationHistory = writable([]);

export const bandStructureData = writable(null);

export const transmissionLossData = writable(null);

export const bestResult = writable(null);

export const sensitivityData = writable(null);
export const sensitivityLoading = writable(false);

export const surrogateModelInfo = writable({
    is_trained: false,
    test_rmse: null,
    n_samples: 0
});

export const surrogateTrainingStatus = writable('idle');

export const paramRanges = writable({
    lattice_constant: { min: 0.02, max: 0.1, step: 0.001, unit: 'm', label: '晶格常数' },
    cylinder_radius: { min: 0.005, max: 0.04, step: 0.001, unit: 'm', label: '柱体半径' },
    cylinder_height: { min: 0.01, max: 0.08, step: 0.001, unit: 'm', label: '柱体高度' },
    matrix_density: { min: 800, max: 2000, step: 10, unit: 'kg/m³', label: '基体密度' },
    matrix_speed_of_sound: { min: 1500, max: 4000, step: 50, unit: 'm/s', label: '基体声速' },
    scatterer_density: { min: 2000, max: 10000, step: 100, unit: 'kg/m³', label: '散射体密度' },
    scatterer_speed_of_sound: { min: 3000, max: 8000, step: 50, unit: 'm/s', label: '散射体声速' },
    filling_fraction: { min: 0.1, max: 0.6, step: 0.01, unit: '', label: '填充率' }
});
