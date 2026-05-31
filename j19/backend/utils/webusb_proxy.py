import logging
import threading
import time
from typing import Optional

logger = logging.getLogger(__name__)


class WebUSBProxyError(Exception):
    pass


class _DeviceHandle:
    __slots__ = ("vid", "pid", "serial", "device", "interface", "interface_number", "endpoint_in", "endpoint_out", "connected")

    def __init__(self, vid: int, pid: int, serial: Optional[str]):
        self.vid = vid
        self.pid = pid
        self.serial = serial
        self.device = None
        self.interface = 0
        self.interface_number = 0
        self.endpoint_in = 0x81
        self.endpoint_out = 0x01
        self.connected = False


class WebUSBProxy:
    def __init__(self):
        self._handles: dict = {}
        self._next_handle: int = 1
        self._lock = threading.Lock()
        self._pyusb_available = False
        self._usb = None
        self._init_pyusb()

    def _init_pyusb(self) -> None:
        try:
            import usb
            self._usb = usb
            self._pyusb_available = True
            logger.info("pyusb available for WebUSB proxy")
        except ImportError:
            logger.warning("pyusb not available, running in simulation mode")
            self._pyusb_available = False

    def enumerate(self, vendor_id: Optional[int] = None) -> list:
        devices = []

        if self._pyusb_available:
            try:
                import usb.core
                import usb.util

                if vendor_id:
                    devs = usb.core.find(find_all=True, idVendor=vendor_id)
                else:
                    devs = usb.core.find(find_all=True)

                for dev in devs:
                    try:
                        serial = usb.util.get_string(dev, dev.iSerialNumber) if dev.iSerialNumber else None
                    except Exception:
                        serial = None

                    device_info = {
                        "vendor_id": dev.idVendor,
                        "product_id": dev.idProduct,
                        "vendor_id_hex": f"0x{dev.idVendor:04X}",
                        "product_id_hex": f"0x{dev.idProduct:04X}",
                        "serial_number": serial,
                        "bus": dev.bus,
                        "address": dev.address,
                    }
                    devices.append(device_info)

                return devices
            except Exception as e:
                logger.error(f"pyusb enumeration failed: {e}")
                raise WebUSBProxyError(f"USB enumeration failed: {e}")

        devices.append({
            "vendor_id": 0x0403,
            "product_id": 0x6014,
            "vendor_id_hex": "0x0403",
            "product_id_hex": "0x6014",
            "serial_number": "FPGA001",
            "bus": 1,
            "address": 1,
            "simulated": True,
        })
        devices.append({
            "vendor_id": 0x09FB,
            "product_id": 0x6010,
            "vendor_id_hex": "0x09FB",
            "product_id_hex": "0x6010",
            "serial_number": "ALTERA001",
            "bus": 1,
            "address": 2,
            "simulated": True,
        })
        return devices

    def connect(self, vendor_id: int, product_id: int, serial: Optional[str] = None) -> int:
        with self._lock:
            handle = self._next_handle
            self._next_handle += 1

            dev_handle = _DeviceHandle(vendor_id, product_id, serial)

            if self._pyusb_available:
                try:
                    import usb.core
                    import usb.util

                    kwargs = {"idVendor": vendor_id, "idProduct": product_id}
                    if serial:
                        kwargs["serial_number"] = serial

                    dev = usb.core.find(**kwargs)
                    if dev is None:
                        raise WebUSBProxyError(
                            f"Device not found: VID=0x{vendor_id:04X}, PID=0x{product_id:04X}"
                        )

                    try:
                        dev.set_configuration()
                    except usb.core.USBError as e:
                        if "already configured" not in str(e).lower():
                            raise WebUSBProxyError(f"Failed to configure device: {e}")

                    cfg = dev.get_active_configuration()
                    intf = cfg[(0, 0)]

                    ep_out = usb.util.find_descriptor(
                        intf,
                        custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_OUT,
                    )
                    ep_in = usb.util.find_descriptor(
                        intf,
                        custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress) == usb.util.ENDPOINT_IN,
                    )

                    if ep_in is None or ep_out is None:
                        dev_handle.endpoint_in = 0x81
                        dev_handle.endpoint_out = 0x01
                    else:
                        dev_handle.endpoint_in = ep_in.bEndpointAddress
                        dev_handle.endpoint_out = ep_out.bEndpointAddress

                    dev_handle.interface_number = intf.bInterfaceNumber

                    try:
                        usb.util.claim_interface(dev, intf.bInterfaceNumber)
                        dev_handle.interface = intf
                    except Exception as e:
                        logger.warning(f"Could not claim interface {intf.bInterfaceNumber}: {e}")
                        # Try alternate interface 0 as fallback
                        try:
                            usb.util.claim_interface(dev, 0)
                            dev_handle.interface_number = 0
                        except Exception as e2:
                            logger.warning(f"Could not claim fallback interface 0: {e2}")

                    dev_handle.device = dev
                    dev_handle.connected = True

                except WebUSBProxyError:
                    raise
                except Exception as e:
                    raise WebUSBProxyError(f"Failed to connect to device: {e}")
            else:
                dev_handle.connected = True

            self._handles[handle] = dev_handle
            logger.info(f"Device connected: handle={handle}, VID=0x{vendor_id:04X}, PID=0x{product_id:04X}")
            return handle

    def disconnect(self, handle: int) -> None:
        with self._lock:
            dev_handle = self._handles.pop(handle, None)
            if not dev_handle:
                raise WebUSBProxyError(f"Invalid device handle: {handle}")

            if dev_handle.connected and self._pyusb_available and dev_handle.device:
                try:
                    import usb.util
                    if_number = getattr(dev_handle, 'interface_number', 0)
                    try:
                        usb.util.release_interface(dev_handle.device, if_number)
                    except Exception as e:
                        logger.warning(f"Error releasing interface {if_number}: {e}")
                    try:
                        usb.util.dispose_resources(dev_handle.device)
                    except Exception as e:
                        logger.warning(f"Error disposing device resources: {e}")
                except Exception as e:
                    logger.warning(f"Error during device cleanup: {e}")

            dev_handle.connected = False
            logger.info(f"Device disconnected: handle={handle}")

    def bulk_transfer(self, handle: int, endpoint: int, data: bytes, timeout: int = 5000) -> bytes:
        with self._lock:
            dev_handle = self._handles.get(handle)

        if not dev_handle or not dev_handle.connected:
            raise WebUSBProxyError(f"Device handle {handle} not connected")

        if self._pyusb_available and dev_handle.device:
            try:
                if endpoint & 0x80:
                    read_endpoint = dev_handle.endpoint_in
                    result = dev_handle.device.read(read_endpoint, len(data), timeout=timeout)
                    return bytes(result)
                else:
                    write_endpoint = dev_handle.endpoint_out
                    bytes_written = dev_handle.device.write(write_endpoint, data, timeout=timeout)
                    return bytes([bytes_written & 0xFF])
            except Exception as e:
                raise WebUSBProxyError(f"Bulk transfer failed: {e}")

        import hashlib
        return hashlib.sha256(data).digest()[:len(data)]

    def jtag_reset(self, handle: int) -> None:
        with self._lock:
            dev_handle = self._handles.get(handle)

        if not dev_handle or not dev_handle.connected:
            raise WebUSBProxyError(f"Device handle {handle} not connected")

        try:
            reset_sequence = self._build_jtag_reset_sequence()
            self.bulk_transfer(handle, dev_handle.endpoint_out, reset_sequence)
            logger.info(f"JTAG reset sent on handle={handle}")
        except Exception as e:
            raise WebUSBProxyError(f"JTAG reset failed: {e}")

    def jtag_shift(self, handle: int, tdi: bytes, bit_count: int) -> bytes:
        with self._lock:
            dev_handle = self._handles.get(handle)

        if not dev_handle or not dev_handle.connected:
            raise WebUSBProxyError(f"Device handle {handle} not connected")

        try:
            tdo = bytearray()
            for i in range(bit_count):
                byte_idx = i // 8
                bit_idx = i % 8

                if byte_idx < len(tdi):
                    tdi_bit = (tdi[byte_idx] >> (7 - bit_idx)) & 1
                else:
                    tdi_bit = 0

                tms_bit = 1 if (i == bit_count - 1) else 0
                tdo_bit = self._clock_cycle(handle, tms_bit, tdi_bit)
                tdo.append(tdo_bit)

            result = bytearray()
            for i in range(0, len(tdo), 8):
                byte_val = 0
                for j in range(min(8, len(tdo) - i)):
                    byte_val = (byte_val << 1) | (tdo[i + j] & 1)
                result.append(byte_val)

            return bytes(result)
        except Exception as e:
            raise WebUSBProxyError(f"JTAG shift failed: {e}")

    def _clock_cycle(self, handle: int, tms: int, tdi: int) -> int:
        with self._lock:
            dev_handle = self._handles.get(handle)

        if not dev_handle or not dev_handle.connected:
            raise WebUSBProxyError(f"Device handle {handle} not connected")

        if self._pyusb_available and dev_handle.device:
            cmd_byte = (tms << 1) | tdi
            try:
                self.bulk_transfer(handle, dev_handle.endpoint_out, bytes([cmd_byte]))
                response = self.bulk_transfer(handle, dev_handle.endpoint_in, bytes([0]), timeout=1000)
                return response[0] & 1 if response else 0
            except Exception:
                return 0

        return 0

    def _build_jtag_reset_sequence(self) -> bytes:
        sequence = []
        for _ in range(6):
            sequence.append(0x03)
        sequence.append(0x01)
        return bytes(sequence)

    def program_fpga(self, handle: int, bitstream: bytes, device_type: str = "xilinx") -> dict:
        with self._lock:
            dev_handle = self._handles.get(handle)

        if not dev_handle or not dev_handle.connected:
            raise WebUSBProxyError(f"Device handle {handle} not connected")

        logger.info(f"Starting FPGA programming: handle={handle}, device={device_type}, size={len(bitstream)}")

        result = {
            "device_type": device_type,
            "bitstream_size": len(bitstream),
            "handle": handle,
        }

        try:
            self.jtag_reset(handle)
            time.sleep(0.1)

            if device_type.startswith("xilinx"):
                result["programming_time"] = self._program_xilinx(handle, bitstream)
            elif device_type.startswith("altera"):
                result["programming_time"] = self._program_altera(handle, bitstream)
            elif device_type.startswith("lattice"):
                result["programming_time"] = self._program_lattice(handle, bitstream)
            elif device_type.startswith("gowin"):
                result["programming_time"] = self._program_gowin(handle, bitstream)
            else:
                result["programming_time"] = self._program_generic(handle, bitstream)

            result["status"] = "success"
            logger.info(f"FPGA programming complete: handle={handle}, time={result['programming_time']:.3f}s")
            return result

        except Exception as e:
            result["status"] = "failed"
            result["error"] = str(e)
            logger.error(f"FPGA programming failed: handle={handle}, error={e}")
            raise WebUSBProxyError(f"Programming failed: {e}")

    def _program_xilinx(self, handle: int, bitstream: bytes) -> float:
        start_time = time.time()

        with self._lock:
            dev_handle = self._handles.get(handle)

        if self._pyusb_available and dev_handle and dev_handle.device:
            chunk_size = 4096
            for offset in range(0, len(bitstream), chunk_size):
                chunk = bitstream[offset:offset + chunk_size]
                try:
                    self.bulk_transfer(handle, dev_handle.endpoint_out, chunk)
                except Exception as e:
                    raise WebUSBProxyError(f"Failed to write chunk at offset {offset}: {e}")
                time.sleep(0.001)

            self.bulk_transfer(handle, dev_handle.endpoint_out, b"\x00" * 64)
        else:
            time.sleep(min(5.0, len(bitstream) / 100000.0))

        return time.time() - start_time

    def _program_altera(self, handle: int, bitstream: bytes) -> float:
        start_time = time.time()

        with self._lock:
            dev_handle = self._handles.get(handle)

        if self._pyusb_available and dev_handle and dev_handle.device:
            header = bytes([0x00, 0x00, 0x00, 0x00, 0xAA, 0x99, 0x55, 0x66])
            self.bulk_transfer(handle, dev_handle.endpoint_out, header)
            time.sleep(0.1)

            chunk_size = 4096
            for offset in range(0, len(bitstream), chunk_size):
                chunk = bitstream[offset:offset + chunk_size]
                self.bulk_transfer(handle, dev_handle.endpoint_out, chunk)
                time.sleep(0.002)
        else:
            time.sleep(min(5.0, len(bitstream) / 80000.0))

        return time.time() - start_time

    def _program_lattice(self, handle: int, bitstream: bytes) -> float:
        start_time = time.time()

        with self._lock:
            dev_handle = self._handles.get(handle)

        if self._pyusb_available and dev_handle and dev_handle.device:
            self.jtag_shift(handle, bytes([0xFF, 0xFF]), 16)
            time.sleep(0.1)

            chunk_size = 2048
            for offset in range(0, len(bitstream), chunk_size):
                chunk = bitstream[offset:offset + chunk_size]
                self.bulk_transfer(handle, dev_handle.endpoint_out, chunk)
                time.sleep(0.001)
        else:
            time.sleep(min(5.0, len(bitstream) / 60000.0))

        return time.time() - start_time

    def _program_gowin(self, handle: int, bitstream: bytes) -> float:
        start_time = time.time()

        with self._lock:
            dev_handle = self._handles.get(handle)

        if self._pyusb_available and dev_handle and dev_handle.device:
            self.jtag_shift(handle, bytes([0x11, 0x11]), 16)
            time.sleep(0.05)

            chunk_size = 1024
            for offset in range(0, len(bitstream), chunk_size):
                chunk = bitstream[offset:offset + chunk_size]
                self.bulk_transfer(handle, dev_handle.endpoint_out, chunk)
                time.sleep(0.003)

            self.bulk_transfer(handle, dev_handle.endpoint_out, b"\x00\x00\x00\x00")
        else:
            time.sleep(min(5.0, len(bitstream) / 50000.0))

        return time.time() - start_time

    def _program_generic(self, handle: int, bitstream: bytes) -> float:
        start_time = time.time()

        with self._lock:
            dev_handle = self._handles.get(handle)

        if self._pyusb_available and dev_handle and dev_handle.device:
            chunk_size = 4096
            for offset in range(0, len(bitstream), chunk_size):
                chunk = bitstream[offset:offset + chunk_size]
                self.bulk_transfer(handle, dev_handle.endpoint_out, chunk)
                time.sleep(0.001)
        else:
            time.sleep(min(5.0, len(bitstream) / 70000.0))

        return time.time() - start_time

    def list_connected(self) -> list:
        with self._lock:
            return [
                {
                    "handle": handle,
                    "vendor_id": f"0x{dev.vid:04X}",
                    "product_id": f"0x{dev.pid:04X}",
                    "serial_number": dev.serial,
                    "connected": dev.connected,
                }
                for handle, dev in self._handles.items()
            ]

    def is_connected(self, handle: int) -> bool:
        with self._lock:
            dev_handle = self._handles.get(handle)
            return dev_handle is not None and dev_handle.connected
