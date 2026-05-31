use std::io::{Read, Write};

pub type SeqNum = u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PacketType {
    SYN = 0,
    SYNACK = 1,
    ACK = 2,
    DATA = 3,
    FIN = 4,
    FINACK = 5,
}

impl TryFrom<u8> for PacketType {
    type Error = ();

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(PacketType::SYN),
            1 => Ok(PacketType::SYNACK),
            2 => Ok(PacketType::ACK),
            3 => Ok(PacketType::DATA),
            4 => Ok(PacketType::FIN),
            5 => Ok(PacketType::FINACK),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Packet {
    pub packet_type: PacketType,
    pub seq_num: SeqNum,
    pub ack_num: SeqNum,
    pub window_size: u32,
    pub data: Vec<u8>,
}

impl Packet {
    pub const HEADER_SIZE: usize = 13;

    pub fn new_syn(seq_num: SeqNum, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::SYN,
            seq_num,
            ack_num: 0,
            window_size,
            data: Vec::new(),
        }
    }

    pub fn new_synack(seq_num: SeqNum, ack_num: SeqNum, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::SYNACK,
            seq_num,
            ack_num,
            window_size,
            data: Vec::new(),
        }
    }

    pub fn new_ack(ack_num: SeqNum, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::ACK,
            seq_num: 0,
            ack_num,
            window_size,
            data: Vec::new(),
        }
    }

    pub fn new_data(seq_num: SeqNum, data: Vec<u8>, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::DATA,
            seq_num,
            ack_num: 0,
            window_size,
            data,
        }
    }

    pub fn new_fin(seq_num: SeqNum, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::FIN,
            seq_num,
            ack_num: 0,
            window_size,
            data: Vec::new(),
        }
    }

    pub fn new_finack(seq_num: SeqNum, ack_num: SeqNum, window_size: u32) -> Self {
        Packet {
            packet_type: PacketType::FINACK,
            seq_num,
            ack_num,
            window_size,
            data: Vec::new(),
        }
    }

    pub fn serialize(&self) -> Vec<u8> {
        let mut buf = Vec::with_capacity(Self::HEADER_SIZE + self.data.len());
        buf.write_all(&[self.packet_type as u8]).unwrap();
        buf.write_all(&self.seq_num.to_be_bytes()).unwrap();
        buf.write_all(&self.ack_num.to_be_bytes()).unwrap();
        buf.write_all(&self.window_size.to_be_bytes()).unwrap();
        buf.write_all(&self.data).unwrap();
        buf
    }

    pub fn deserialize(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < Self::HEADER_SIZE {
            return None;
        }

        let packet_type = PacketType::try_from(bytes[0]).ok()?;
        let seq_num = u32::from_be_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]);
        let ack_num = u32::from_be_bytes([bytes[5], bytes[6], bytes[7], bytes[8]]);
        let window_size = u32::from_be_bytes([bytes[9], bytes[10], bytes[11], bytes[12]]);
        let data = bytes[Self::HEADER_SIZE..].to_vec();

        Some(Packet {
            packet_type,
            seq_num,
            ack_num,
            window_size,
            data,
        })
    }

    pub fn is_control(&self) -> bool {
        matches!(
            self.packet_type,
            PacketType::SYN | PacketType::SYNACK | PacketType::FIN | PacketType::FINACK
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_packet_serialization() {
        let packet = Packet::new_data(123, vec![1, 2, 3, 4], 100);
        let bytes = packet.serialize();
        let deserialized = Packet::deserialize(&bytes).unwrap();

        assert_eq!(deserialized.packet_type, PacketType::DATA);
        assert_eq!(deserialized.seq_num, 123);
        assert_eq!(deserialized.data, vec![1, 2, 3, 4]);
        assert_eq!(deserialized.window_size, 100);
    }

    #[test]
    fn test_syn_packet() {
        let syn = Packet::new_syn(1000, 50);
        let bytes = syn.serialize();
        let deserialized = Packet::deserialize(&bytes).unwrap();

        assert_eq!(deserialized.packet_type, PacketType::SYN);
        assert_eq!(deserialized.seq_num, 1000);
        assert!(deserialized.data.is_empty());
    }

    #[test]
    fn test_deserialize_short_packet() {
        let bytes = vec![0u8; 10];
        assert!(Packet::deserialize(&bytes).is_none());
    }
}
