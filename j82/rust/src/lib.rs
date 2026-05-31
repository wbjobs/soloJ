use wasm_bindgen::prelude::*;
use rustfft::{FftPlanner, num_complex::Complex};
use serde::Serialize;

#[derive(Serialize)]
pub struct SpectrumResult {
    pub magnitudes: Vec<f32>,
    pub frequencies: Vec<f32>,
    pub sample_rate: u32,
    pub fft_size: usize,
}

#[derive(Serialize)]
pub struct FilteredSpectrumResult {
    pub original_magnitudes: Vec<f32>,
    pub filtered_magnitudes: Vec<f32>,
    pub frequencies: Vec<f32>,
    pub sample_rate: u32,
    pub fft_size: usize,
    pub cutoff_freq: f32,
}

#[wasm_bindgen]
pub struct AudioProcessor {
    fft_size: usize,
    planner: FftPlanner<f32>,
    window: Vec<f32>,
    filter_state: LowPassFilter,
}

#[wasm_bindgen]
impl AudioProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new(fft_size: usize) -> AudioProcessor {
        let planner = FftPlanner::<f32>::new();
        let window = hann_window(fft_size);

        AudioProcessor {
            fft_size,
            planner,
            window,
            filter_state: LowPassFilter::new(),
        }
    }

    #[wasm_bindgen]
    pub fn process(&mut self, samples: &[f32], sample_rate: u32) -> JsValue {
        let fft = self.planner.plan_fft_forward(self.fft_size);

        let mut complex_samples: Vec<Complex<f32>> = samples
            .iter()
            .take(self.fft_size)
            .enumerate()
            .map(|(i, &s)| Complex::new(s * self.window[i], 0.0))
            .collect();

        while complex_samples.len() < self.fft_size {
            complex_samples.push(Complex::new(0.0, 0.0));
        }

        fft.process(&mut complex_samples);

        let magnitudes: Vec<f32> = complex_samples
            .iter()
            .take(self.fft_size / 2)
            .map(|c| c.norm())
            .collect();

        let frequencies: Vec<f32> = (0..self.fft_size / 2)
            .map(|i| i as f32 * sample_rate as f32 / self.fft_size as f32)
            .collect();

        let result = SpectrumResult {
            magnitudes,
            frequencies,
            sample_rate,
            fft_size: self.fft_size,
        };

        serde_json::to_string(&result)
            .map(|s| JsValue::from_str(&s))
            .unwrap_or(JsValue::NULL)
    }

    #[wasm_bindgen]
    pub fn process_with_filter(
        &mut self,
        samples: &[f32],
        sample_rate: u32,
        cutoff_freq: f32,
    ) -> JsValue {
        let fft = self.planner.plan_fft_forward(self.fft_size);

        let mut complex_samples: Vec<Complex<f32>> = samples
            .iter()
            .take(self.fft_size)
            .enumerate()
            .map(|(i, &s)| Complex::new(s * self.window[i], 0.0))
            .collect();

        while complex_samples.len() < self.fft_size {
            complex_samples.push(Complex::new(0.0, 0.0));
        }

        fft.process(&mut complex_samples);

        let original_magnitudes: Vec<f32> = complex_samples
            .iter()
            .take(self.fft_size / 2)
            .map(|c| c.norm())
            .collect();

        self.filter_state.update_coefficients(cutoff_freq, sample_rate as f32);

        let filtered_samples: Vec<f32> = samples
            .iter()
            .take(self.fft_size)
            .enumerate()
            .map(|(i, &s)| self.filter_state.process_sample(s * self.window[i]))
            .collect();

        let mut complex_filtered: Vec<Complex<f32>> = filtered_samples
            .iter()
            .map(|&s| Complex::new(s, 0.0))
            .collect();

        while complex_filtered.len() < self.fft_size {
            complex_filtered.push(Complex::new(0.0, 0.0));
        }

        fft.process(&mut complex_filtered);

        let filtered_magnitudes: Vec<f32> = complex_filtered
            .iter()
            .take(self.fft_size / 2)
            .map(|c| c.norm())
            .collect();

        let frequencies: Vec<f32> = (0..self.fft_size / 2)
            .map(|i| i as f32 * sample_rate as f32 / self.fft_size as f32)
            .collect();

        let result = FilteredSpectrumResult {
            original_magnitudes,
            filtered_magnitudes,
            frequencies,
            sample_rate,
            fft_size: self.fft_size,
            cutoff_freq,
        };

        serde_json::to_string(&result)
            .map(|s| JsValue::from_str(&s))
            .unwrap_or(JsValue::NULL)
    }

    #[wasm_bindgen]
    pub fn reset_filter(&mut self) {
        self.filter_state.reset();
    }

    #[wasm_bindgen]
    pub fn process_batch(&mut self, samples: &[f32], sample_rate: u32, hop_size: usize) -> JsValue {
        let num_frames = (samples.len().saturating_sub(self.fft_size)) / hop_size + 1;
        let mut all_magnitudes: Vec<Vec<f32>> = Vec::with_capacity(num_frames);

        let fft = self.planner.plan_fft_forward(self.fft_size);

        for frame_idx in 0..num_frames {
            let start = frame_idx * hop_size;
            let end = start + self.fft_size;

            let frame: Vec<f32> = samples
                .get(start..end)
                .map(|s| s.to_vec())
                .unwrap_or_else(|| {
                    let mut v = samples[start..].to_vec();
                    v.resize(self.fft_size, 0.0);
                    v
                });

            let mut complex_samples: Vec<Complex<f32>> = frame
                .iter()
                .enumerate()
                .map(|(i, &s)| Complex::new(s * self.window[i], 0.0))
                .collect();

            fft.process(&mut complex_samples);

            let magnitudes: Vec<f32> = complex_samples
                .iter()
                .take(self.fft_size / 2)
                .map(|c| c.norm())
                .collect();

            all_magnitudes.push(magnitudes);
        }

        let frequencies: Vec<f32> = (0..self.fft_size / 2)
            .map(|i| i as f32 * sample_rate as f32 / self.fft_size as f32)
            .collect();

        let result = BatchSpectrumResult {
            frames: all_magnitudes,
            frequencies,
            sample_rate,
            fft_size: self.fft_size,
            hop_size,
        };

        serde_json::to_string(&result)
            .map(|s| JsValue::from_str(&s))
            .unwrap_or(JsValue::NULL)
    }

    #[wasm_bindgen]
    pub fn get_fft_size(&self) -> usize {
        self.fft_size
    }
}

struct LowPassFilter {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    current_cutoff: f32,
    current_sample_rate: f32,
}

impl LowPassFilter {
    fn new() -> Self {
        LowPassFilter {
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            current_cutoff: 0.0,
            current_sample_rate: 0.0,
        }
    }

    fn update_coefficients(&mut self, cutoff: f32, sample_rate: f32) {
        if (cutoff - self.current_cutoff).abs() < 0.01
            && (sample_rate - self.current_sample_rate).abs() < 0.01
        {
            return;
        }

        self.current_cutoff = cutoff;
        self.current_sample_rate = sample_rate;

        let nyquist = sample_rate / 2.0;
        if cutoff >= nyquist || cutoff <= 0.0 {
            self.b0 = 1.0;
            self.b1 = 0.0;
            self.b2 = 0.0;
            self.a1 = 0.0;
            self.a2 = 0.0;
            return;
        }

        let fc = cutoff / nyquist;
        let k = (std::f32::consts::PI * fc).tan();
        let k2 = k * k;
        let sqrt2 = std::f32::consts::SQRT_2;

        let norm = 1.0 + sqrt2 * k + k2;
        self.b0 = k2 / norm;
        self.b1 = 2.0 * k2 / norm;
        self.b2 = k2 / norm;
        self.a1 = 2.0 * (k2 - 1.0) / norm;
        self.a2 = (1.0 - sqrt2 * k + k2) / norm;
    }

    fn process_sample(&mut self, x: f32) -> f32 {
        let y = self.b0 * x + self.b1 * self.x1 + self.b2 * self.x2
            - self.a1 * self.y1
            - self.a2 * self.y2;

        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;

        y
    }

    fn reset(&mut self) {
        self.x1 = 0.0;
        self.x2 = 0.0;
        self.y1 = 0.0;
        self.y2 = 0.0;
    }
}

#[derive(Serialize)]
struct BatchSpectrumResult {
    frames: Vec<Vec<f32>>,
    frequencies: Vec<f32>,
    sample_rate: u32,
    fft_size: usize,
    hop_size: usize,
}

fn hann_window(size: usize) -> Vec<f32> {
    (0..size)
        .map(|i| {
            let t = i as f32 / (size as f32 - 1.0);
            0.54 - 0.46 * (2.0 * std::f32::consts::PI * t).cos()
        })
        .collect()
}

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}
