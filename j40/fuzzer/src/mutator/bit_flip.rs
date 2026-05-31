use rand::prelude::*;

pub struct BitFlipMutator;

impl BitFlipMutator {
    pub fn new() -> Self {
        Self
    }

    pub fn mutate(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        if data.is_empty() {
            return;
        }

        let mutation_type = rng.gen_range(0..4);
        
        match mutation_type {
            0 => self.flip_single_bit(data, rng),
            1 => self.flip_multi_bits(data, rng),
            2 => self.set_random_byte(data, rng),
            3 => self.delete_or_insert(data, rng),
            _ => unreachable!(),
        }
    }

    fn flip_single_bit(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let idx = rng.gen_range(0..data.len());
        let bit = rng.gen_range(0..8);
        data[idx] ^= 1 << bit;
    }

    fn flip_multi_bits(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let num_flips = rng.gen_range(1..=8);
        for _ in 0..num_flips {
            let idx = rng.gen_range(0..data.len());
            let bit = rng.gen_range(0..8);
            data[idx] ^= 1 << bit;
        }
    }

    fn set_random_byte(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let idx = rng.gen_range(0..data.len());
        let value: u8 = rng.gen();
        data[idx] = value;
    }

    fn delete_or_insert(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        if data.len() < 2 {
            return;
        }
        
        if rng.gen_bool(0.5) {
            let start = rng.gen_range(0..data.len());
            let end = (start + rng.gen_range(1..=4)).min(data.len());
            data.drain(start..end);
        } else {
            let pos = rng.gen_range(0..=data.len());
            let num_bytes = rng.gen_range(1..=4);
            let mut new_bytes = vec![0u8; num_bytes];
            rng.fill_bytes(&mut new_bytes);
            data.splice(pos..pos, new_bytes);
        }
    }
}

impl Default for BitFlipMutator {
    fn default() -> Self {
        Self::new()
    }
}
