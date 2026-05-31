#!/usr/bin/env python3

import json
import struct
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

try:
    from scapy.all import Packet, ByteField, ShortField, IntField, LongField, StrField, PacketListField
    HAS_SCAPY = True
except ImportError:
    HAS_SCAPY = False


class ProtocolType(Enum):
    RAW = "raw"
    HTTP = "http"
    DNS = "dns"
    TCP = "tcp"
    CUSTOM = "custom"


@dataclass
class ProtocolField:
    name: str
    field_type: str
    offset: int = 0
    length: Optional[int] = None
    default: Any = None
    constraints: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProtocolState:
    name: str
    transitions: List[str] = field(default_factory=list)
    required_fields: List[str] = field(default_factory=list)


@dataclass
class ProtocolTemplate:
    name: str
    protocol_type: ProtocolType
    fields: List[ProtocolField] = field(default_factory=list)
    states: List[ProtocolState] = field(default_factory=list)
    initial_state: str = "initial"
    
    @classmethod
    def from_json(cls, json_path: str) -> 'ProtocolTemplate':
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        fields = [ProtocolField(**f) for f in data.get('fields', [])]
        states = [ProtocolState(**s) for s in data.get('states', [])]
        
        return cls(
            name=data['name'],
            protocol_type=ProtocolType(data.get('protocol_type', 'custom')),
            fields=fields,
            states=states,
            initial_state=data.get('initial_state', 'initial')
        )
    
    @classmethod
    def from_protobuf(cls, proto_path: str) -> 'ProtocolTemplate':
        raise NotImplementedError("Protobuf parsing not implemented")


class ProtocolStateMachine:
    def __init__(self, template: ProtocolTemplate):
        self.template = template
        self.current_state = template.initial_state
        self.state_history: List[str] = [template.initial_state]
        self.field_values: Dict[str, Any] = {}
    
    def transition(self, next_state: str) -> bool:
        state = self._get_state(self.current_state)
        if state and next_state in state.transitions:
            self.current_state = next_state
            self.state_history.append(next_state)
            return True
        return False
    
    def get_possible_transitions(self) -> List[str]:
        state = self._get_state(self.current_state)
        return state.transitions if state else []
    
    def _get_state(self, name: str) -> Optional[ProtocolState]:
        for state in self.template.states:
            if state.name == name:
                return state
        return None
    
    def set_field(self, name: str, value: Any):
        self.field_values[name] = value
    
    def get_field(self, name: str) -> Optional[Any]:
        return self.field_values.get(name)
    
    def generate_message(self) -> bytes:
        if HAS_SCAPY and self.template.protocol_type != ProtocolType.RAW:
            return self._generate_scapy_packet()
        return self._generate_raw_message()
    
    def _generate_raw_message(self) -> bytes:
        message = bytearray()
        for field in self.template.fields:
            value = self.field_values.get(field.name, field.default)
            if value is None:
                continue
            
            if field.field_type == 'byte':
                message.append(int(value) & 0xFF)
            elif field.field_type == 'short':
                message.extend(struct.pack('!H', int(value)))
            elif field.field_type == 'int':
                message.extend(struct.pack('!I', int(value)))
            elif field.field_type == 'long':
                message.extend(struct.pack('!Q', int(value)))
            elif field.field_type == 'string':
                message.extend(str(value).encode())
            elif field.field_type == 'bytes':
                message.extend(bytes(value))
        
        return bytes(message)
    
    def _generate_scapy_packet(self) -> bytes:
        if not HAS_SCAPY:
            return self._generate_raw_message()
        
        if self.template.protocol_type == ProtocolType.HTTP:
            from scapy.layers.http import HTTPRequest
            pkt = HTTPRequest(
                Method=self.field_values.get('method', 'GET'),
                Path=self.field_values.get('path', '/'),
                Host=self.field_values.get('host', 'localhost')
            )
            return bytes(pkt)
        elif self.template.protocol_type == ProtocolType.DNS:
            from scapy.layers.dns import DNS, DNSQR
            pkt = DNS(rd=1, qd=DNSQR(qname=self.field_values.get('qname', 'example.com')))
            return bytes(pkt)
        
        return self._generate_raw_message()
    
    def parse_message(self, data: bytes) -> Dict[str, Any]:
        result = {}
        offset = 0
        
        for field in self.template.fields:
            if offset >= len(data):
                break
            
            if field.length:
                end = min(offset + field.length, len(data))
            else:
                end = len(data)
            
            if field.field_type == 'byte' and offset < len(data):
                result[field.name] = data[offset]
                offset += 1
            elif field.field_type == 'short' and offset + 2 <= len(data):
                result[field.name] = struct.unpack('!H', data[offset:offset+2])[0]
                offset += 2
            elif field.field_type == 'int' and offset + 4 <= len(data):
                result[field.name] = struct.unpack('!I', data[offset:offset+4])[0]
                offset += 4
            elif field.field_type == 'long' and offset + 8 <= len(data):
                result[field.name] = struct.unpack('!Q', data[offset:offset+8])[0]
                offset += 8
            elif field.field_type == 'string':
                result[field.name] = data[offset:end].decode(errors='replace')
                offset = end
            elif field.field_type == 'bytes':
                result[field.name] = data[offset:end]
                offset = end
        
        return result
    
    def reset(self):
        self.current_state = self.template.initial_state
        self.state_history = [self.template.initial_state]
        self.field_values.clear()


class MutatorInterface:
    def __init__(self, state_machine: ProtocolStateMachine):
        self.state_machine = state_machine
    
    def mutate_field(self, field_name: str, mutation_fn: Callable[[Any], Any]) -> bool:
        if field_name in self.state_machine.field_values:
            self.state_machine.field_values[field_name] = mutation_fn(
                self.state_machine.field_values[field_name]
            )
            return True
        return False
    
    def randomize_fields(self, seed: Optional[int] = None):
        import random
        rng = random.Random(seed)
        
        for field in self.state_machine.template.fields:
            if field.field_type == 'byte':
                self.state_machine.set_field(field.name, rng.randint(0, 255))
            elif field.field_type == 'short':
                self.state_machine.set_field(field.name, rng.randint(0, 65535))
            elif field.field_type == 'int':
                self.state_machine.set_field(field.name, rng.randint(0, 2**32 - 1))
            elif field.field_type == 'string':
                length = rng.randint(1, 100)
                self.state_machine.set_field(
                    field.name,
                    ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=length))
                )
    
    def mutate_state(self) -> bool:
        transitions = self.state_machine.get_possible_transitions()
        if transitions:
            import random
            next_state = random.choice(transitions)
            return self.state_machine.transition(next_state)
        return False


def create_http_template() -> ProtocolTemplate:
    return ProtocolTemplate(
        name="HTTP",
        protocol_type=ProtocolType.HTTP,
        fields=[
            ProtocolField(name="method", field_type="string", default="GET"),
            ProtocolField(name="path", field_type="string", default="/"),
            ProtocolField(name="host", field_type="string", default="localhost"),
            ProtocolField(name="headers", field_type="bytes"),
            ProtocolField(name="body", field_type="bytes"),
        ],
        states=[
            ProtocolState(name="initial", transitions=["request_sent", "error"]),
            ProtocolState(name="request_sent", transitions=["response_received", "error"]),
            ProtocolState(name="response_received", transitions=["initial", "done"]),
            ProtocolState(name="error", transitions=["initial"]),
            ProtocolState(name="done", transitions=[]),
        ]
    )


def create_dns_template() -> ProtocolTemplate:
    return ProtocolTemplate(
        name="DNS",
        protocol_type=ProtocolType.DNS,
        fields=[
            ProtocolField(name="id", field_type="short", default=0),
            ProtocolField(name="qname", field_type="string", default="example.com"),
            ProtocolField(name="qtype", field_type="short", default=1),
            ProtocolField(name="qclass", field_type="short", default=1),
        ],
        states=[
            ProtocolState(name="initial", transitions=["query_sent"]),
            ProtocolState(name="query_sent", transitions=["response_received", "timeout"]),
            ProtocolState(name="response_received", transitions=["initial", "done"]),
            ProtocolState(name="timeout", transitions=["initial"]),
            ProtocolState(name="done", transitions=[]),
        ]
    )


if __name__ == "__main__":
    template = create_http_template()
    sm = ProtocolStateMachine(template)
    print("Initial state:", sm.current_state)
    print("Possible transitions:", sm.get_possible_transitions())
    
    sm.set_field("method", "POST")
    sm.set_field("path", "/api/test")
    
    msg = sm.generate_message()
    print("Generated message:", msg[:100], "...")
