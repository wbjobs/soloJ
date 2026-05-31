use rand::prelude::*;
use rand_distr::{Exp, Distribution};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;

use crate::taint::{TaintTrace, TaintGuidedMutator, TaintGuidedMutatorConfig, BranchCondition};

mod bit_flip;
mod arithmetic;
mod dictionary;

pub use bit_flip::BitFlipMutator;
pub use arithmetic::ArithmeticMutator;
pub use dictionary::DictionaryMutator;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MutatorConfig {
    pub bit_flip_prob: f64,
    pub arithmetic_prob: f64,
    pub dictionary_prob: f64,
    pub crossover_prob: f64,
    pub max_mutations: usize,
    pub dictionary: Option<Vec<Vec<u8>>>,
    pub adaptive_intensity: bool,
    pub stagnation_threshold: u64,
    pub random_inject_prob: f64,
    pub havoc_prob: f64,
    pub taint_guided: bool,
    pub taint_weight: f64,
}

impl Default for MutatorConfig {
    fn default() -> Self {
        Self {
            bit_flip_prob: 0.3,
            arithmetic_prob: 0.3,
            dictionary_prob: 0.2,
            crossover_prob: 0.2,
            max_mutations: 16,
            dictionary: None,
            adaptive_intensity: true,
            stagnation_threshold: 10000,
            random_inject_prob: 0.05,
            havoc_prob: 0.1,
            taint_guided: true,
            taint_weight: 0.6,
        }
    }
}

pub struct SeedEnergy {
    pub energy: f64,
    pub executions_since_discovery: u64,
    pub new_edges_found: u32,
    pub last_new_edge_time: u64,
}

impl SeedEnergy {
    pub fn new(initial_energy: f64) -> Self {
        Self {
            energy: initial_energy,
            executions_since_discovery: 0,
            new_edges_found: 0,
            last_new_edge_time: 0,
        }
    }

    pub fn schedule_energy(&mut self, total_seeds: usize, global_execs: u64, edge_frequencies: Option<&HashMap<u32, f64>>) -> f64 {
        self.executions_since_discovery += 1;
        
        let base_energy = 1.0 / (total_seeds as f64).max(1.0);
        
        let age_factor = 1.0 / (1.0 + (self.executions_since_discovery as f64).log2());
        
        let discovery_factor = if self.new_edges_found > 0 {
            (self.new_edges_found as f64).sqrt()
        } else {
            0.5
        };
        
        let freshness_factor = if self.executions_since_discovery < 100 {
            2.0
        } else if self.executions_since_discovery < 1000 {
            1.0
        } else {
            0.5
        };
        
        self.energy = base_energy * age_factor * discovery_factor * freshness_factor;
        
        self.energy
    }

    pub fn on_new_coverage(&mut self) {
        self.new_edges_found += 1;
        self.executions_since_discovery = 0;
        self.energy *= 1.5;
    }
}

pub struct Mutator {
    rng: ThreadRng,
    config: MutatorConfig,
    bit_flip: BitFlipMutator,
    arithmetic: ArithmeticMutator,
    dictionary: DictionaryMutator,
    stagnation_counter: u64,
    total_mutations: u64,
    last_new_edge_at: u64,
    intensity: usize,
    phase: MutationPhase,
    taint_guided: Option<TaintGuidedMutator>,
    last_taint_trace: Option<TaintTrace>,
    byte_influence: Vec<f64>,
    gradient_ascent_branch: Option<BranchCondition>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum MutationPhase {
    Exploration,
    Exploitation,
    Havoc,
    RandomInjection,
    TaintGuided,
}

impl Mutator {
    pub fn new(config: MutatorConfig) -> Self {
        let taint_guided = if config.taint_guided {
            Some(TaintGuidedMutator::new(TaintGuidedMutatorConfig::default(), 4096))
        } else {
            None
        };

        Self {
            rng: rand::thread_rng(),
            bit_flip: BitFlipMutator::new(),
            arithmetic: ArithmeticMutator::new(),
            dictionary: DictionaryMutator::new(config.dictionary.clone().unwrap_or_default()),
            config,
            stagnation_counter: 0,
            total_mutations: 0,
            last_new_edge_at: 0,
            intensity: 1,
            phase: MutationPhase::Exploration,
            taint_guided,
            last_taint_trace: None,
            byte_influence: vec![1.0; 4096],
            gradient_ascent_branch: None,
        }
    }

    pub fn update_taint_trace(&mut self, trace: TaintTrace) {
        if let Some(tg) = &mut self.taint_guided {
            tg.update_global_taint(&trace);
        }
        
        for i in 0..self.byte_influence.len().min(trace.input_len) {
            let score = trace.get_byte_influence_score(i);
            self.byte_influence[i] = self.byte_influence[i] * 0.7 + score * 0.3;
        }
        
        self.last_taint_trace = Some(trace);
    }

    pub fn select_gradient_ascent_target(&mut self) -> Option<BranchCondition> {
        let trace = self.last_taint_trace.as_ref()?;
        
        let mut candidates: Vec<BranchCondition> = Vec::new();
        for (branch, bytes) in &trace.branch_to_bytes {
            if !bytes.is_empty() {
                candidates.push(*branch);
            }
        }
        
        if candidates.is_empty() {
            return None;
        }
        
        let idx = self.rng.gen_range(0..candidates.len());
        let target = candidates[idx];
        self.gradient_ascent_branch = Some(target);
        
        if let Some(tg) = &mut self.taint_guided {
            tg.set_gradient_ascent_target(target);
        }
        
        Some(target)
    }

    pub fn load_dictionary(&mut self, path: &Path) -> std::io::Result<()> {
        self.dictionary.load_from_file(path)
    }

    pub fn notify_new_coverage(&mut self) {
        self.last_new_edge_at = self.total_mutations;
        self.stagnation_counter = 0;
        
        if self.intensity > 1 {
            self.intensity = (self.intensity - 1).max(1);
        }
        
        self.phase = MutationPhase::Exploration;
    }

    pub fn notify_no_coverage(&mut self) {
        self.stagnation_counter += 1;
        
        if self.config.adaptive_intensity {
            self.adapt_phase();
        }
    }

    fn adapt_phase(&mut self) {
        let gap = self.total_mutations - self.last_new_edge_at;
        
        if gap > self.config.stagnation_threshold * 5 && self.config.taint_guided {
            self.phase = MutationPhase::TaintGuided;
            self.select_gradient_ascent_target();
        } else if gap > self.config.stagnation_threshold * 4 {
            self.phase = MutationPhase::RandomInjection;
            self.intensity = self.config.max_mutations;
        } else if gap > self.config.stagnation_threshold * 2 {
            self.phase = MutationPhase::Havoc;
            self.intensity = (self.config.max_mutations * 3) / 4;
        } else if gap > self.config.stagnation_threshold {
            self.phase = MutationPhase::Exploitation;
            self.intensity = (self.config.max_mutations * 2) / 3;
        } else {
            self.phase = MutationPhase::Exploration;
            self.intensity = (self.config.max_mutations / 4).max(1);
        }
    }

    pub fn mutate(&mut self, data: &mut Vec<u8>, max_len: usize) {
        self.total_mutations += 1;
        
        match self.phase {
            MutationPhase::TaintGuided => {
                if !self.mutate_taint_guided(data, max_len) {
                    self.phase = MutationPhase::Havoc;
                    self.mutate_havoc(data, max_len);
                }
            }
            MutationPhase::RandomInjection => {
                if self.rng.gen_bool(self.config.random_inject_prob) {
                    let new_data = self.generate_random(max_len);
                    *data = new_data;
                    return;
                }
                self.mutate_havoc(data, max_len);
            }
            MutationPhase::Havoc => {
                if self.rng.gen_bool(self.config.havoc_prob) {
                    self.mutate_havoc(data, max_len);
                } else {
                    self.mutate_standard(data, max_len);
                }
            }
            MutationPhase::Exploitation => {
                self.mutate_focused(data, max_len);
            }
            MutationPhase::Exploration => {
                self.mutate_standard(data, max_len);
            }
        }
        
        if data.len() > max_len {
            data.truncate(max_len);
        }
    }

    fn mutate_taint_guided(&mut self, data: &mut [u8], _max_len: usize) -> bool {
        if self.config.taint_weight <= 0.0 {
            return false;
        }

        if let Some(tg) = &mut self.taint_guided {
            if tg.apply_gradient_ascent_mutation(data) {
                return true;
            }
        }

        let num_bytes_to_mutate = self.rng.gen_range(1..=self.intensity.min(8));
        let bytes_to_mutate = self.select_influential_bytes(num_bytes_to_mutate, data.len());
        
        for &byte_idx in &bytes_to_mutate {
            if byte_idx < data.len() {
                let mutation_type = self.rng.gen_range(0..3);
                match mutation_type {
                    0 => {
                        data[byte_idx] = data[byte_idx].wrapping_add(self.rng.gen_range(1..=16) as u8);
                    }
                    1 => {
                        data[byte_idx] = data[byte_idx].wrapping_sub(self.rng.gen_range(1..=16) as u8);
                    }
                    2 => {
                        let bit = self.rng.gen_range(0..8);
                        data[byte_idx] ^= 1 << bit;
                    }
                    _ => {}
                }
            }
        }

        true
    }

    fn select_influential_bytes(&self, num_bytes: usize, data_len: usize) -> Vec<usize> {
        let effective_len = data_len.min(self.byte_influence.len());
        if effective_len == 0 {
            return Vec::new();
        }

        let use_taint = self.rng.gen_bool(self.config.taint_weight);
        if !use_taint {
            return (0..num_bytes).map(|_| self.rng.gen_range(0..effective_len)).collect();
        }

        let mut total_weight = 0.0;
        for i in 0..effective_len {
            total_weight += 1.0 + self.byte_influence[i] * 10.0;
        }

        let mut result = Vec::with_capacity(num_bytes);
        for _ in 0..num_bytes {
            let mut r = self.rng.gen_range(0.0..total_weight);
            for i in 0..effective_len {
                let w = 1.0 + self.byte_influence[i] * 10.0;
                r -= w;
                if r <= 0.0 {
                    result.push(i);
                    break;
                }
            }
        }

        result
    }

    fn mutate_standard(&mut self, data: &mut Vec<u8>, max_len: usize) {
        let num_mutations = self.rng.gen_range(1..=self.intensity);
        
        for _ in 0..num_mutations {
            let selector: f64 = self.rng.gen();
            let mut cumulative = 0.0;
            
            cumulative += self.config.bit_flip_prob;
            if selector < cumulative {
                self.bit_flip.mutate(data, &mut self.rng);
                continue;
            }
            
            cumulative += self.config.arithmetic_prob;
            if selector < cumulative {
                self.arithmetic.mutate(data, &mut self.rng);
                continue;
            }
            
            cumulative += self.config.dictionary_prob;
            if selector < cumulative && !self.dictionary.is_empty() {
                self.dictionary.mutate(data, &mut self.rng);
                continue;
            }
            
            if !self.dictionary.is_empty() {
                self.dictionary.mutate(data, &mut self.rng);
            } else {
                self.bit_flip.mutate(data, &mut self.rng);
            }
        }
    }

    fn mutate_focused(&mut self, data: &mut Vec<u8>, _max_len: usize) {
        if data.len() < 2 {
            self.bit_flip.mutate(data, &mut self.rng);
            return;
        }
        
        let focus_type = self.rng.gen_range(0..4);
        
        match focus_type {
            0 => {
                let start = self.rng.gen_range(0..data.len());
                let end = (start + 4).min(data.len());
                for i in start..end {
                    data[i] = data[i].wrapping_add(self.rng.gen_range(1..=4));
                }
            }
            1 => {
                let idx = self.rng.gen_range(0..data.len().saturating_sub(1));
                let orig = u16::from_le_bytes([data[idx], data[idx + 1]]);
                let interesting = [0u16, 1, 0xFFFF, 0x7FFF, 0x8000, 128, 256, 512, 1024, 4096, 8192, 32768];
                let &val = interesting.choose(&mut self.rng).unwrap();
                let bytes = val.to_le_bytes();
                data[idx] = bytes[0];
                data[idx + 1] = bytes[1];
            }
            2 => {
                let idx = self.rng.gen_range(0..data.len().saturating_sub(3));
                let interesting = [0u32, 1, 0xFFFFFFFF, 0x7FFFFFFF, 0x80000000, 128, 256, 65535, 0x41414141];
                let &val = interesting.choose(&mut self.rng).unwrap();
                let bytes = val.to_le_bytes();
                data[idx] = bytes[0];
                data[idx + 1] = bytes[1];
                data[idx + 2] = bytes[2];
                data[idx + 3] = bytes[3];
            }
            3 => {
                let size_class = [1, 2, 4, 8];
                let &len = size_class.choose(&mut self.rng).unwrap();
                let start = self.rng.gen_range(0..=data.len().saturating_sub(len));
                for i in start..start + len {
                    if self.rng.gen_bool(0.5) {
                        data[i] = !data[i];
                    } else {
                        data[i] = self.rng.gen();
                    }
                }
            }
            _ => unreachable!(),
        }
    }

    fn mutate_havoc(&mut self, data: &mut Vec<u8>, max_len: usize) {
        let num_ops = self.rng.gen_range(4..=self.config.max_mutations);
        
        for _ in 0..num_ops {
            if data.is_empty() {
                let new_bytes = self.generate_random(64);
                *data = new_bytes;
                continue;
            }
            
            let op = self.rng.gen_range(0..10);
            match op {
                0 => self.bit_flip.mutate(data, &mut self.rng),
                1 => self.arithmetic.mutate(data, &mut self.rng),
                2 if !self.dictionary.is_empty() => self.dictionary.mutate(data, &mut self.rng),
                2 => self.bit_flip.mutate(data, &mut self.rng),
                3 => {
                    let start = self.rng.gen_range(0..data.len());
                    let end = (start + self.rng.gen_range(1..=8)).min(data.len());
                    data.drain(start..end);
                }
                4 => {
                    let pos = self.rng.gen_range(0..=data.len());
                    let num = self.rng.gen_range(1..=8);
                    let mut new_bytes = vec![0u8; num];
                    self.rng.fill_bytes(&mut new_bytes);
                    data.splice(pos..pos, new_bytes);
                }
                5 => {
                    if data.len() > 1 {
                        let len = self.rng.gen_range(1..=data.len() / 2).min(64);
                        let src = self.rng.gen_range(0..data.len() - len);
                        let dst = self.rng.gen_range(0..data.len() - len);
                        let chunk = data[src..src + len].to_vec();
                        data[dst..dst + len].copy_from_slice(&chunk);
                    }
                }
                6 => {
                    if data.len() > 2 {
                        let start = self.rng.gen_range(0..data.len());
                        let end = (start + self.rng.gen_range(1..=4)).min(data.len());
                        let byte_val: u8 = self.rng.gen();
                        for i in start..end {
                            data[i] = byte_val;
                        }
                    }
                }
                7 => {
                    if data.len() > 4 {
                        let start = self.rng.gen_range(0..data.len() - 4);
                        data[start..start + 4].reverse();
                    }
                }
                8 => {
                    let new_data = self.generate_random(max_len);
                    let split = self.rng.gen_range(0..data.len().min(new_data.len()));
                    let mut result = Vec::with_capacity(data.len() + new_data.len());
                    result.extend_from_slice(&data[..split]);
                    result.extend_from_slice(&new_data[split..]);
                    *data = result;
                }
                9 => {
                    for byte in data.iter_mut() {
                        if self.rng.gen_bool(0.1) {
                            *byte = self.rng.gen();
                        }
                    }
                }
                _ => unreachable!(),
            }
        }
        
        if data.len() > max_len {
            data.truncate(max_len);
        }
    }

    pub fn crossover(&mut self, a: &[u8], b: &[u8]) -> Vec<u8> {
        if a.is_empty() {
            return b.to_vec();
        }
        if b.is_empty() {
            return a.to_vec();
        }
        
        let num_segments = self.rng.gen_range(1..=4);
        let mut result = Vec::new();
        let mut a_pos = 0usize;
        let mut b_pos = 0usize;
        let mut use_a = self.rng.gen_bool(0.5);
        
        for seg in 0..num_segments {
            let max_len = if use_a { a.len() - a_pos } else { b.len() - b_pos };
            if max_len == 0 { break; }
            let seg_len = if seg == num_segments - 1 {
                max_len
            } else {
                self.rng.gen_range(1..=max_len)
            };
            
            if use_a {
                result.extend_from_slice(&a[a_pos..a_pos + seg_len.min(a.len() - a_pos)]);
                a_pos += seg_len;
            } else {
                result.extend_from_slice(&b[b_pos..b_pos + seg_len.min(b.len() - b_pos)]);
                b_pos += seg_len;
            }
            use_a = !use_a;
        }
        
        result
    }

    pub fn generate_random(&mut self, max_len: usize) -> Vec<u8> {
        let exp = Exp::new(8.0).unwrap();
        let len = (exp.sample(&mut self.rng) as usize).clamp(1, max_len);
        let mut data = vec![0u8; len];
        self.rng.fill_bytes(&mut data);
        data
    }

    pub fn get_phase(&self) -> &str {
        match self.phase {
            MutationPhase::Exploration => "exploration",
            MutationPhase::Exploitation => "exploitation",
            MutationPhase::Havoc => "havoc",
            MutationPhase::RandomInjection => "random_inject",
            MutationPhase::TaintGuided => "taint_guided",
        }
    }

    pub fn get_stagnation_info(&self) -> (u64, u64, usize) {
        (self.stagnation_counter, self.total_mutations - self.last_new_edge_at, self.intensity)
    }
}
