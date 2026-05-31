use rand::prelude::*;

pub struct ArithmeticMutator;

impl ArithmeticMutator {
    pub fn new() -> Self {
        Self
    }

    pub fn mutate(&self, data: &mut Vec<u8>, rng: &mut ThreadRng) {
        if data.len() < 2 {
            return;
        }

        let mutation_type = rng.gen_range(0..5);
        
        match mutation_type {
            0 => self.add_byte(data, rng),
            1 => self.sub_byte(data, rng),
            2 => self.add_u16(data, rng),
            3 => self.add_u32(data, rng),
            4 => self.swap_bytes(data, rng),
            _ => unreachable!(),
        }
    }

    fn add_byte(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let idx = rng.gen_range(0..data.len());
        let delta: i8 = rng.gen_range(-16..=16);
        data[idx] = data[idx].wrapping_add_signed(delta);
    }

    fn sub_byte(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let idx = rng.gen_range(0..data.len());
        let delta: i8 = rng.gen_range(-16..=16);
        data[idx] = data[idx].wrapping_sub_signed(delta);
    }

    fn add_u16(&self, data: &mut [u8], rng: &mut ThreadRng) {
        if data.len() < 2 {
            return;
        }
        let idx = rng.gen_range(0..data.len() - 1);
        let delta: i16 = rng.gen_range(-256..=256);
        
        let mut value = u16::from_ne_bytes([data[idx], data[idx + 1]]);
        value = value.wrapping_add_signed(delta);
        let bytes = value.to_ne_bytes();
        data[idx] = bytes[0];
        data[idx + 1] = bytes[1];
    }

    fn add_u32(&self, data: &mut [u8], rng: &mut ThreadRng) {
        if data.len() < 4 {
            return;
        }
        let idx = rng.gen_range(0..data.len() - 3);
        let delta: i32 = rng.gen_range(-65536..=65536);
        
        let mut value = u32::from_ne_bytes([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]]);
        value = value.wrapping_add_signed(delta);
        let bytes = value.to_ne_bytes();
        data[idx] = bytes[0];
        data[idx + 1] = bytes[1];
        data[idx + 2] = bytes[2];
        data[idx + 3] = bytes[3];
    }

    fn swap_bytes(&self, data: &mut [u8], rng: &mut ThreadRng) {
        let i = rng.gen_range(0..data.len());
        let j = rng.gen_range(0..data.len());
        data.swap(i, j);
    }
}

impl Default for ArithmeticMutator {
    fn default() -> Self {
        Self::new()
    }
}
