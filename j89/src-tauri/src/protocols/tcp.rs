use crate::types::TcpFlags;
use etherparse::TcpHeader;

pub fn parse_tcp_flags(tcp: &TcpHeader) -> TcpFlags {
    TcpFlags {
        syn: tcp.syn,
        ack: tcp.ack,
        fin: tcp.fin,
        rst: tcp.rst,
        psh: tcp.psh,
        urg: tcp.urg,
    }
}

pub fn get_tcp_info(flags: &TcpFlags, source_port: u16, dest_port: u16) -> String {
    if flags.syn && !flags.ack {
        format!("{} → {} SYN", source_port, dest_port)
    } else if flags.syn && flags.ack {
        format!("{} → {} SYN, ACK", source_port, dest_port)
    } else if flags.fin && flags.ack {
        format!("{} → {} FIN, ACK", source_port, dest_port)
    } else if flags.rst {
        format!("{} → {} RST", source_port, dest_port)
    } else if flags.ack && flags.psh {
        format!("{} → {} PSH, ACK", source_port, dest_port)
    } else if flags.ack {
        format!("{} → {} ACK", source_port, dest_port)
    } else {
        format!("{} → {}", source_port, dest_port)
    }
}
