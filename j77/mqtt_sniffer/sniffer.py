import paho.mqtt.client as mqtt
import struct
import time
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum


class MQTTMessageType(Enum):
    CONNECT = 1
    CONNACK = 2
    PUBLISH = 3
    PUBACK = 4
    PUBREC = 5
    PUBREL = 6
    PUBCOMP = 7
    SUBSCRIBE = 8
    SUBACK = 9
    UNSUBSCRIBE = 10
    UNSUBACK = 11
    PINGREQ = 12
    PINGRESP = 13
    DISCONNECT = 14


@dataclass
class MQTTPacket:
    timestamp: float
    packet_type: MQTTMessageType
    direction: str
    topic: Optional[str] = None
    qos: int = 0
    retain: bool = False
    payload: bytes = field(default_factory=bytes)
    payload_length: int = 0
    client_id: Optional[str] = None
    packet_id: Optional[int] = None
    raw_packet: bytes = field(default_factory=bytes)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "packet_type": self.packet_type.name,
            "direction": self.direction,
            "topic": self.topic,
            "qos": self.qos,
            "retain": self.retain,
            "payload": self.payload.hex() if self.payload else None,
            "payload_length": self.payload_length,
            "client_id": self.client_id,
            "packet_id": self.packet_id,
            "raw_packet": self.raw_packet.hex() if self.raw_packet else None,
        }


class MQTTSniffer:
    def __init__(self, host: str = "localhost", port: int = 1883, username: str = None, password: str = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.client = None
        self.packet_callback = None
        self.packets = []

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[+] Connected to MQTT Broker at {self.host}:{self.port}")
            client.subscribe("#", qos=0)
        else:
            print(f"[-] Connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, rc):
        print(f"[-] Disconnected from MQTT Broker (code: {rc})")

    def _on_message(self, client, userdata, msg):
        packet = MQTTPacket(
            timestamp=time.time(),
            packet_type=MQTTMessageType.PUBLISH,
            direction="incoming",
            topic=msg.topic,
            qos=msg.qos,
            retain=msg.retain,
            payload=msg.payload,
            payload_length=len(msg.payload),
            client_id=client._client_id.decode() if client._client_id else None,
            packet_id=msg.mid,
            raw_packet=msg.payload,
        )
        self.packets.append(packet)
        if self.packet_callback:
            self.packet_callback(packet)

    def _on_publish(self, client, userdata, mid):
        pass

    def _on_subscribe(self, client, userdata, mid, granted_qos):
        print(f"[+] Subscribed to all topics with QoS: {granted_qos}")

    def _on_log(self, client, userdata, level, buf):
        pass

    def set_packet_callback(self, callback):
        self.packet_callback = callback

    def start(self):
        self.client = mqtt.Client(
            client_id=f"mqtt_sniffer_{int(time.time())}",
            clean_session=True
        )
        if self.username and self.password:
            self.client.username_pw_set(self.username, self.password)
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.on_publish = self._on_publish
        self.client.on_subscribe = self._on_subscribe
        self.client.on_log = self._on_log
        self.client.connect(self.host, self.port, keepalive=60)
        self.client.loop_start()

    def stop(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()
            print("[*] MQTT Sniffer stopped")

    def get_packets(self):
        return self.packets

    def clear_packets(self):
        self.packets.clear()

    def publish(self, topic: str, payload: bytes, qos: int = 0, retain: bool = False) -> int:
        if not self.client:
            raise RuntimeError("MQTT client not connected")
        msg_info = self.client.publish(topic, payload, qos=qos, retain=retain)
        msg_info.wait_for_publish(timeout=5.0)
        return msg_info.mid

    def publish_packet(self, packet: MQTTPacket) -> int:
        return self.publish(
            topic=packet.topic or "",
            payload=packet.payload,
            qos=packet.qos,
            retain=packet.retain
        )
