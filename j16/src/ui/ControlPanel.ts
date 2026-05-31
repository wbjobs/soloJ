import type { SimulationParams, RenderMode, FluidType } from '../types/index';

export interface UICallbacks {
  onRenderModeChange: (mode: RenderMode) => void;
  onAddParticles: () => void;
  onAddWater: () => void;
  onAddOil: () => void;
  onAddBubbles: () => void;
  onClearParticles: () => void;
  onGravityChange: (x: number, y: number) => void;
  onFluidTypeChange: (type: FluidType) => void;
  onParamChange: (params: Partial<SimulationParams>) => void;
  onTaaToggle: (enabled: boolean) => void;
  onAutoRotateToggle: (enabled: boolean) => void;
}

export class ControlPanel {
  private _callbacks: UICallbacks;
  private _particleCountSpan: HTMLElement;
  private _fpsDisplay: HTMLElement;

  constructor(callbacks: UICallbacks) {
    this._callbacks = callbacks;
    this._particleCountSpan = document.getElementById('particle-count')!;
    this._fpsDisplay = document.getElementById('fps-display')!;

    this._initEventListeners();
  }

  private _initEventListeners(): void {
    const renderModeRadios = document.querySelectorAll('input[name="renderMode"]') as NodeListOf<HTMLInputElement>;
    renderModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.checked) {
          this._callbacks.onRenderModeChange(target.value as RenderMode);
        }
      });
    });

    const addBtn = document.getElementById('add-particles');
    addBtn?.addEventListener('click', () => {
      this._callbacks.onAddParticles();
    });

    const addWaterBtn = document.getElementById('add-water');
    addWaterBtn?.addEventListener('click', () => {
      this._callbacks.onAddWater();
    });

    const addOilBtn = document.getElementById('add-oil');
    addOilBtn?.addEventListener('click', () => {
      this._callbacks.onAddOil();
    });

    const addBubblesBtn = document.getElementById('add-bubbles');
    addBubblesBtn?.addEventListener('click', () => {
      this._callbacks.onAddBubbles();
    });

    const clearBtn = document.getElementById('clear-particles');
    clearBtn?.addEventListener('click', () => {
      this._callbacks.onClearParticles();
    });

    const gravityButtons = document.querySelectorAll('.gravity-controls button');
    gravityButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const gx = parseFloat(target.dataset.gx || '0');
        const gy = parseFloat(target.dataset.gy || '0');
        this._callbacks.onGravityChange(gx, gy);
      });
    });

    const fluidTypeSelect = document.getElementById('fluid-type') as HTMLSelectElement;
    fluidTypeSelect?.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this._callbacks.onFluidTypeChange(parseInt(target.value) as FluidType);
    });

    this._initSlider('gravity-strength', 'gravity-value', (value) => {
      this._callbacks.onParamChange({ gravityStrength: value });
    });

    this._initSlider('particle-radius', 'radius-value', (value) => {
      this._callbacks.onParamChange({ particleRadius: value });
    });

    this._initSlider('rest-density', 'density-value', (value) => {
      this._callbacks.onParamChange({ restDensity: value });
    });

    this._initSlider('viscosity', 'viscosity-value', (value) => {
      this._callbacks.onParamChange({ viscosity: value });
    });

    this._initSlider('pressure-coeff', 'pressure-value', (value) => {
      this._callbacks.onParamChange({ pressureCoeff: value });
    });

    this._initSlider('time-step', 'dt-value', (value) => {
      this._callbacks.onParamChange({ dt: value });
    });

    this._initSlider('substeps', 'substep-value', (value) => {
      this._callbacks.onParamChange({ substeps: Math.round(value) });
    });

    this._initSlider('surface-tension', 'tension-value', (value) => {
      this._callbacks.onParamChange({ surfaceTension: value });
    });

    this._initSlider('adhesion', 'adhesion-value', (value) => {
      this._callbacks.onParamChange({ adhesionStrength: value });
    });

    this._initSlider('repulsion', 'repulsion-value', (value) => {
      this._callbacks.onParamChange({ repulsionStrength: value });
    });

    const taaToggle = document.getElementById('taa-toggle') as HTMLInputElement;
    taaToggle?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this._callbacks.onTaaToggle(target.checked);
    });

    const autoRotateToggle = document.getElementById('auto-rotate') as HTMLInputElement;
    autoRotateToggle?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      this._callbacks.onAutoRotateToggle(target.checked);
    });
  }

  private _initSlider(sliderId: string, displayId: string, onChange: (value: number) => void): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement;
    const display = document.getElementById(displayId);

    slider?.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      const value = parseFloat(target.value);
      if (display) {
        display.textContent = target.value;
      }
      onChange(value);
    });
  }

  updateParticleCount(count: number): void {
    this._particleCountSpan.textContent = count.toString();
  }

  updateFPS(fps: number): void {
    this._fpsDisplay.textContent = `FPS: ${fps.toFixed(1)}`;
  }
}