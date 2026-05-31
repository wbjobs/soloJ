import struct
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class BitstreamHeader:
    valid: bool = False
    file_type: Optional[str] = None
    device_type: Optional[str] = None
    device_id: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    design_name: Optional[str] = None
    part_name: Optional[str] = None
    user_id: Optional[str] = None
    errors: list = field(default_factory=list)


class BitstreamParser:
    XILINX_BIT_HEADER = b"\x00\x09\x0f\xf0\x0f\xf0\x0f\xf0\x0f\xf0\x00\x00\x01"

    def __init__(self, data: bytes, filename: str = ""):
        self._data = data
        self._filename = filename
        self._header = BitstreamHeader()

    def parse(self) -> dict:
        if not self._data:
            self._header.errors.append("Empty file")
            return self._header.__dict__

        ext = self._filename.rsplit(".", 1)[-1].lower() if "." in self._filename else ""

        if ext == "bit":
            self._parse_xilinx_bit()
        elif ext == "bin":
            self._parse_raw_bin()
        else:
            self._header.errors.append(f"Unknown file extension: {ext}")

        if not self._header.errors or self._header.device_type:
            self._header.valid = True

        return self._header.__dict__

    def _parse_xilinx_bit(self) -> None:
        data = self._data
        offset = 0

        try:
            if data[:13] == self.XILINX_BIT_HEADER:
                offset = 13
            else:
                sync_idx = data.find(self.XILINX_BIT_HEADER)
                if sync_idx == -1:
                    self._header.errors.append("Xilinx .bit header not found")
                    return
                offset = sync_idx + 13

            self._header.file_type = "xilinx_bit"

            while offset < len(data) - 4:
                tag = data[offset]
                offset += 1

                length = struct.unpack(">H", data[offset:offset + 2])[0]
                offset += 2

                if length == 0:
                    continue

                value = data[offset:offset + length]
                offset += length

                tag_char = chr(tag) if 32 <= tag < 127 else "?"

                if tag_char == "a":
                    self._header.design_name = value.decode("latin-1").strip("\x00").strip()
                elif tag_char == "b":
                    self._header.part_name = value.decode("latin-1").strip("\x00").strip()
                elif tag_char == "c":
                    self._header.date = value.decode("latin-1").strip("\x00").strip()
                elif tag_char == "d":
                    self._header.time = value.decode("latin-1").strip("\x00").strip()
                elif tag_char == "e":
                    self._header.device_id = value.hex().upper()

                if offset >= len(data) - 4:
                    break

            self._header.device_type = self._infer_from_part_name(self._header.part_name)
            logger.info(
                f"Parsed Xilinx bitstream: design={self._header.design_name}, "
                f"part={self._header.part_name}, date={self._header.date} {self._header.time}"
            )

        except (struct.error, IndexError, UnicodeDecodeError) as e:
            self._header.errors.append(f"Parse error: {str(e)}")

    def _parse_raw_bin(self) -> None:
        data = self._data
        self._header.file_type = "raw_bin"

        if len(data) < 64:
            self._header.errors.append("Binary file too small")
            return

        for i in range(min(len(data) - 3, 1024)):
            window = data[i:i + 4]
            if window == b"\xaa\x99\x55\x66":
                self._header.device_type = "xilinx"
                self._header.device_id = data[i:i + 8].hex().upper()
                logger.info(f"Xilinx sync word found at offset {i}")
                return

        if data[:2] == b"\xff\xff":
            self._header.device_type = "lattice"
            logger.info("Lattice bitstream detected")
            return

        if data[:4] == b"\x5a\xa5\xa5\x5a":
            self._header.device_type = "altera"
            logger.info("Altera bitstream detected")
            return

        if data[:2] in (b"\x00\x00", b"\xff\xff") and len(data) > 1024:
            if b"\x11\x11" in data[:4096]:
                self._header.device_type = "gowin"
                logger.info("Gowin bitstream detected")
                return

        self._header.device_type = "unknown"
        self._header.errors.append("Could not determine device type from raw binary")

    def _infer_from_part_name(self, part_name: Optional[str]) -> str:
        if not part_name:
            return "unknown"

        part_upper = part_name.upper()
        if "XC7" in part_upper:
            return "xilinx_7series"
        if "XCVU" in part_upper or "XCKU" in part_upper:
            return "xilinx_ultrascale"
        if "XCZU" in part_upper:
            return "xilinx_zynq_ultrascale"
        if "XC2V" in part_upper:
            return "xilinx_virtex2"
        if "XC3S" in part_upper:
            return "xilinx_spartan3"
        if "XC6S" in part_upper:
            return "xilinx_spartan6"
        if "5CE" in part_upper or "5CS" in part_upper:
            return "altera_cyclone5"
        if "10M" in part_upper:
            return "altera_max10"
        if "EP4C" in part_upper:
            return "altera_cyclone4"
        if "LFE5U" in part_upper:
            return "lattice_ecp5"
        if "ICE40" in part_upper:
            return "lattice_ice40"
        if "GW1N" in part_upper or "GW2A" in part_upper:
            return "gowin"
        return "unknown"

    def infer_device_type(self) -> str:
        if self._header.device_type:
            return self._header.device_type
        return self._infer_from_part_name(self._header.part_name)

    def extract_raw_data(self) -> bytes:
        if self._header.file_type == "xilinx_bit":
            sync_idx = self._data.find(self.XILINX_BIT_HEADER)
            if sync_idx != -1:
                offset = sync_idx + 13
                while offset < len(self._data) - 4:
                    tag = self._data[offset]
                    offset += 1
                    length = struct.unpack(">H", self._data[offset:offset + 2])[0]
                    offset += 2
                    if tag == 0xFF or length == 0:
                        break
                    offset += length
                return self._data[offset:]

        return self._data
