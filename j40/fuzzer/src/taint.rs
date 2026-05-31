use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use parking_lot::RwLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct BranchCondition {
    pub address: u64,
    pub taken: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaintInfo {
    pub input_byte_offset: usize,
    pub influences_branches: Vec<BranchCondition>,
    pub influence_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaintTrace {
    pub input_len: usize,
    pub byte_to_branches: Vec<HashSet<BranchCondition>>,
    pub branch_to_bytes: HashMap<BranchCondition, Vec<usize>>,
    pub total_branches_covered: usize,
    pub tainted_comparisons: Vec<ComparisonInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonInfo {
    pub address: u64,
    pub operand_a: u64,
    pub operand_b: u64,
    pub size: u8,
    pub is_signed: bool,
    pub is_equal: bool,
    pub a_taint_mask: u8,
    pub b_taint_mask: u8,
}

impl TaintTrace {
    pub fn new(input_len: usize) -> Self {
        Self {
            input_len,
            byte_to_branches: vec![HashSet::new(); input_len],
            branch_to_bytes: HashMap::new(),
            total_branches_covered: 0,
            tainted_comparisons: Vec::new(),
        }
    }

    pub fn record_branch_taint(&mut self, branch: BranchCondition, byte_offsets: &[usize]) {
        for &offset in byte_offsets {
            if offset < self.byte_to_branches.len() {
                self.byte_to_branches[offset].insert(branch);
            }
        }
        
        self.branch_to_bytes
            .entry(branch)
            .or_insert_with(Vec::new)
            .extend(byte_offsets.iter().copied());
        
        self.total_branches_covered = self.branch_to_bytes.len();
    }

    pub fn get_influential_bytes(&self, branch: &BranchCondition) -> &[usize] {
        self.branch_to_bytes
            .get(branch)
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    pub fn get_influenced_branches(&self, byte_offset: usize) -> &HashSet<BranchCondition> {
        static EMPTY: HashSet<BranchCondition> = HashSet::new();
        self.byte_to_branches.get(byte_offset).unwrap_or(&EMPTY)
    }

    pub fn get_byte_influence_score(&self, byte_offset: usize) -> f64 {
        if byte_offset >= self.byte_to_branches.len() {
            return 0.0;
        }
        let branches = &self.byte_to_branches[byte_offset];
        branches.len() as f64 / self.total_branches_covered.max(1) as f64
    }

    pub fn merge(&mut self, other: &TaintTrace) {
        for byte_offset in 0..self.byte_to_branches.len() {
            if byte_offset < other.byte_to_branches.len() {
                for branch in &other.byte_to_branches[byte_offset] {
                    self.byte_to_branches[byte_offset].insert(*branch);
                }
            }
        }
        
        for (branch, bytes) in &other.branch_to_bytes {
            self.branch_to_bytes
                .entry(*branch)
                .or_insert_with(Vec::new)
                .extend(bytes.iter().copied());
        }
        
        self.total_branches_covered = self.branch_to_bytes.len();
        self.tainted_comparisons.extend(other.tainted_comparisons.clone());
    }
}

#[derive(Debug, Clone)]
pub struct TaintGuidedMutatorConfig {
    pub enabled: bool,
    pub taint_weight: f64,
    pub exploration_weight: f64,
    pub gradient_ascent_prob: f64,
    pub gradient_ascent_steps: usize,
}

impl Default for TaintGuidedMutatorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            taint_weight: 0.7,
            exploration_weight: 0.3,
            gradient_ascent_prob: 0.5,
            gradient_ascent_steps: 8,
        }
    }
}

pub struct TaintGuidedMutator {
    config: TaintGuidedMutatorConfig,
    global_taint_map: Arc<RwLock<TaintTrace>>,
    byte_priorities: RwLock<Vec<f64>>,
    gradient_ascent_target: RwLock<Option<BranchCondition>>,
    gradient_ascent_step: RwLock<usize>,
}

impl TaintGuidedMutator {
    pub fn new(config: TaintGuidedMutatorConfig, input_len: usize) -> Self {
        Self {
            config,
            global_taint_map: Arc::new(RwLock::new(TaintTrace::new(input_len))),
            byte_priorities: RwLock::new(vec![1.0; input_len]),
            gradient_ascent_target: RwLock::new(None),
            gradient_ascent_step: RwLock::new(0),
        }
    }

    pub fn update_global_taint(&self, trace: &TaintTrace) {
        let mut global = self.global_taint_map.write();
        global.merge(trace);
        self.update_byte_priorities();
    }

    fn update_byte_priorities(&self) {
        let global = self.global_taint_map.read();
        let mut priorities = self.byte_priorities.write();
        
        for (i, priority) in priorities.iter_mut().enumerate() {
            let influence = global.get_byte_influence_score(i);
            *priority = 1.0 + influence * 10.0;
        }
    }

    pub fn select_bytes_to_mutate(&self, num_bytes: usize, data_len: usize) -> Vec<usize> {
        let priorities = self.byte_priorities.read();
        let mut rng = rand::thread_rng();
        
        let effective_len = data_len.min(priorities.len());
        if effective_len == 0 {
            return Vec::new();
        }
        
        let total_weight: f64 = priorities.iter().take(effective_len).sum();
        
        (0..num_bytes)
            .map(|_| {
                let mut r = rng.gen_range(0.0..total_weight);
                for (i, &w) in priorities.iter().take(effective_len).enumerate() {
                    r -= w;
                    if r <= 0.0 {
                        return i;
                    }
                }
                effective_len - 1
            })
            .collect()
    }

    pub fn set_gradient_ascent_target(&self, branch: BranchCondition) {
        *self.gradient_ascent_target.write() = Some(branch);
        *self.gradient_ascent_step.write() = 0;
    }

    pub fn is_in_gradient_ascent_mode(&self) -> bool {
        self.gradient_ascent_target.read().is_some()
    }

    pub fn apply_gradient_ascent_mutation(&self, data: &mut [u8]) -> bool {
        let target = self.gradient_ascent_target.read();
        let Some(branch) = target.as_ref() else {
            return false;
        };

        let global = self.global_taint_map.read();
        let influential_bytes = global.get_influential_bytes(branch);

        if influential_bytes.is_empty() {
            return false;
        }

        let step = *self.gradient_ascent_step.read();
        if step >= self.config.gradient_ascent_steps {
            self.clear_gradient_ascent_target();
            return false;
        }

        let byte_idx = influential_bytes[step % influential_bytes.len()];
        if byte_idx < data.len() {
            let original = data[byte_idx];
            data[byte_idx] = original.wrapping_add(1);
            
            *self.gradient_ascent_step.write() += 1;
            return true;
        }

        self.clear_gradient_ascent_target();
        false
    }

    pub fn clear_gradient_ascent_target(&self) {
        *self.gradient_ascent_target.write() = None;
        *self.gradient_ascent_step.write() = 0;
    }

    pub fn should_use_gradient_ascent(&self) -> bool {
        if !self.config.enabled {
            return false;
        }
        let mut rng = rand::thread_rng();
        rng.gen_bool(self.config.gradient_ascent_prob)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MutationHint {
    AdjustValue { target_value: u64, size: u8 },
    FlipBit { byte_offset: usize, bit: u8 },
    Increment { byte_offset: usize, amount: u8 },
    CopyRegion { start: usize, end: usize },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaintSnapshot {
    pub map: Vec<u8>,
    pub size: usize,
}

impl TaintSnapshot {
    pub fn new(size: usize) -> Self {
        Self {
            map: vec![0; (size + 7) / 8],
            size,
        }
    }

    pub fn set_tainted(&mut self, offset: usize) {
        if offset < self.size {
            self.map[offset / 8] |= 1 << (offset % 8);
        }
    }

    pub fn is_tainted(&self, offset: usize) -> bool {
        if offset >= self.size {
            return false;
        }
        (self.map[offset / 8] & (1 << (offset % 8))) != 0
    }

    pub fn get_taint_mask(&self, start: usize, len: usize) -> u64 {
        let mut mask = 0u64;
        for i in 0..len.min(64) {
            if self.is_tainted(start + i) {
                mask |= 1 << i;
            }
        }
        mask
    }

    pub fn taint_or(&mut self, other: &TaintSnapshot) {
        let min_len = self.map.len().min(other.map.len());
        for i in 0..min_len {
            self.map[i] |= other.map[i];
        }
    }
}
