<script>
    import {
        structuralParams, materialParams, fillingFraction,
        paramRanges, allParams
    } from '../stores/params.js';

    const structuralKeys = ['lattice_constant', 'cylinder_radius', 'cylinder_height'];
    const materialKeys = ['matrix_density', 'matrix_speed_of_sound', 'scatterer_density', 'scatterer_speed_of_sound'];

    function formatValue(val, key) {
        if (key === 'filling_fraction') return val.toFixed(2);
        if (val >= 1000) return val.toFixed(0);
        if (val >= 1) return val.toFixed(1);
        return val.toFixed(3);
    }

    function handleSliderChange(key, value, store) {
        const range = $paramRanges[key];
        const numVal = parseFloat(value);
        if (store === 'structural') {
            $structuralParams = { ...$structuralParams, [key]: numVal };
        } else if (store === 'material') {
            $materialParams = { ...$materialParams, [key]: numVal };
        } else {
            $fillingFraction = numVal;
        }
    }

    function resetParams() {
        $structuralParams = {
            lattice_constant: 0.05,
            cylinder_radius: 0.015,
            cylinder_height: 0.03
        };
        $materialParams = {
            matrix_density: 1200.0,
            matrix_speed_of_sound: 2500.0,
            scatterer_density: 7800.0,
            scatterer_speed_of_sound: 5000.0
        };
        $fillingFraction = 0.28;
    }
</script>

<div class="params-panel">
    <div class="panel-header">
        <h3>结构参数</h3>
        <button class="btn btn-secondary btn-sm" on:click={resetParams}>重置</button>
    </div>

    {#each structuralKeys as key}
        {@const range = $paramRanges[key]}
        {@const value = $structuralParams[key]}
        <div class="slider-container">
            <div class="slider-label">
                <span>{range.label}</span>
                <span class="slider-value">{formatValue(value, key)} {range.unit}</span>
            </div>
            <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                on:input={(e) => handleSliderChange(key, e.target.value, 'structural')}
            />
        </div>
    {/each}

    <div class="slider-container">
        <div class="slider-label">
            <span>{$paramRanges.filling_fraction.label}</span>
            <span class="slider-value">{formatValue($fillingFraction, 'filling_fraction')}</span>
        </div>
        <input
            type="range"
            min={$paramRanges.filling_fraction.min}
            max={$paramRanges.filling_fraction.max}
            step={$paramRanges.filling_fraction.step}
            value={$fillingFraction}
            on:input={(e) => handleSliderChange('filling_fraction', e.target.value, 'filling')}
        />
    </div>

    <div class="panel-header" style="margin-top: 16px;">
        <h3>材料参数</h3>
    </div>

    {#each materialKeys as key}
        {@const range = $paramRanges[key]}
        {@const value = $materialParams[key]}
        <div class="slider-container">
            <div class="slider-label">
                <span>{range.label}</span>
                <span class="slider-value">{formatValue(value, key)} {range.unit}</span>
            </div>
            <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                on:input={(e) => handleSliderChange(key, e.target.value, 'material')}
            />
        </div>
    {/each}
</div>

<style>
    .params-panel {
        padding: 4px 0;
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .panel-header h3 {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .btn-sm {
        padding: 4px 10px;
        font-size: 11px;
    }
</style>
