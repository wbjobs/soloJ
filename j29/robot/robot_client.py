import asyncio
import cv2
import numpy as np
import socketio
from aiortc import RTCPeerConnection, RTCSessionDescription, MediaStreamTrack
from av import VideoFrame
import time
import json
import os
import math
import random
from dotenv import load_dotenv

load_dotenv()

sio = socketio.AsyncClient()

robot_config = {
    'robot_id': os.getenv('ROBOT_ID', 'robot_001'),
    'robot_name': os.getenv('ROBOT_NAME', 'Robot-1'),
    'server_url': os.getenv('SERVER_URL', 'http://localhost:3000')
}

current_pose = {
    'x': 0.0,
    'y': 0.0,
    'yaw': 0.0
}

current_arm_angles = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
target_arm_position = {'x': 0.0, 'y': 0.0, 'z': 0.5}
gripper_state = True

target_velocity = {'linear': 0.0, 'angular': 0.0}
current_velocity = {'linear': 0.0, 'angular': 0.0}
last_command_time = 0
COMMAND_TIMEOUT = 0.5
VELOCITY_RAMP_RATE = 5.0
processed_sequences = set()
MAX_SEQ_HISTORY = 1000

peer_connections = {}

imu_attitude = {'roll': 0.0, 'pitch': 0.0, 'yaw': 0.0}
imu_raw = {'accel': [0.0, 0.0, 0.0], 'gyro': [0.0, 0.0, 0.0]}
USE_SIMULATED_IMU = os.getenv('USE_SIMULATED_IMU', 'true').lower() == 'true'


class MPU6050Driver:
    def __init__(self, bus=1, address=0x68):
        self.bus = bus
        self.address = address
        self.initialized = False
        self.init_hardware()

    def init_hardware(self):
        try:
            import smbus2
            self.bus_instance = smbus2.SMBus(self.bus)
            self.bus_instance.write_byte_data(self.address, 0x6B, 0x00)
            self.bus_instance.write_byte_data(self.address, 0x1B, 0x08)
            self.bus_instance.write_byte_data(self.address, 0x1C, 0x08)
            time.sleep(0.1)
            self.initialized = True
            print("MPU6050 initialized successfully")
        except ImportError:
            print("smbus2 not available, using simulated IMU")
            self.initialized = False
        except Exception as e:
            print(f"MPU6050 init error: {e}, using simulated IMU")
            self.initialized = False

    def read_raw_data(self, addr):
        high = self.bus_instance.read_byte_data(self.address, addr)
        low = self.bus_instance.read_byte_data(self.address, addr + 1)
        value = (high << 8) | low
        if value > 32768:
            value -= 65536
        return value

    def get_data(self):
        if not self.initialized:
            return None
        
        try:
            acc_x = self.read_raw_data(0x3B) / 16384.0
            acc_y = self.read_raw_data(0x3D) / 16384.0
            acc_z = self.read_raw_data(0x3F) / 16384.0
            gyro_x = self.read_raw_data(0x43) / 131.0
            gyro_y = self.read_raw_data(0x45) / 131.0
            gyro_z = self.read_raw_data(0x47) / 131.0
            return {'accel': [acc_x, acc_y, acc_z], 'gyro': [gyro_x, gyro_y, gyro_z]}
        except Exception as e:
            print(f"IMU read error: {e}")
            return None


class SimulatedIMU:
    def __init__(self):
        self.time = 0.0
        self.noise_level = 0.02

    def get_data(self, current_velocity, dt):
        self.time += dt
        
        linear_vel = current_velocity.get('linear', 0)
        angular_vel = current_velocity.get('angular', 0)
        
        accel_x = linear_vel * 0.5 + random.gauss(0, self.noise_level)
        accel_y = random.gauss(0, self.noise_level)
        accel_z = 1.0 + random.gauss(0, self.noise_level)
        
        gyro_x = random.gauss(0, self.noise_level * 2)
        gyro_y = linear_vel * 0.1 + random.gauss(0, self.noise_level)
        gyro_z = angular_vel * 57.3 + random.gauss(0, self.noise_level * 2)
        
        return {'accel': [accel_x, accel_y, accel_z], 'gyro': [gyro_x, gyro_y, gyro_z]}


class MadgwickFilter:
    def __init__(self, beta=0.1):
        self.q0 = 1.0
        self.q1 = 0.0
        self.q2 = 0.0
        self.q3 = 0.0
        self.beta = beta
        self.sample_freq = 100.0
        self.prev_time = time.time()

    def update(self, gx, gy, gz, ax, ay, az):
        q1 = self.q1
        q2 = self.q2
        q3 = self.q3
        q0 = self.q0
        beta = self.beta

        norm = math.sqrt(ax * ax + ay * ay + az * az)
        if norm < 0.01:
            return

        ax /= norm
        ay /= norm
        az /= norm

        v1 = 2 * (q1 * q3 - q0 * q2)
        v2 = 2 * (q0 * q1 + q2 * q3)
        v3 = q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3

        e1 = (ay * v3 - az * v2)
        e2 = (az * v1 - ax * v3)
        e3 = (ax * v2 - ay * v1)

        gx = gx * math.pi / 180.0
        gy = gy * math.pi / 180.0
        gz = gz * math.pi / 180.0

        gx = gx + beta * e1
        gy = gy + beta * e2
        gz = gz + beta * e3

        qDot1 = 0.5 * (-q1 * gx - q2 * gy - q3 * gz)
        qDot2 = 0.5 * (q0 * gx + q2 * gz - q3 * gy)
        qDot3 = 0.5 * (q0 * gy - q1 * gz + q3 * gx)
        qDot4 = 0.5 * (q0 * gz + q1 * gy - q2 * gx)

        now = time.time()
        dt = now - self.prev_time
        self.prev_time = now
        dt = min(dt, 0.1)

        q0 = q0 + qDot1 * dt
        q1 = q1 + qDot2 * dt
        q2 = q2 + qDot3 * dt
        q3 = q3 + qDot4 * dt

        norm = math.sqrt(q0 * q0 + q1 * q1 + q2 * q2 + q3 * q3)
        self.q0 = q0 / norm
        self.q1 = q1 / norm
        self.q2 = q2 / norm
        self.q3 = q3 / norm

    def get_euler_angles(self):
        sinr_cosp = 2 * (self.q0 * self.q1 + self.q2 * self.q3)
        cosr_cosp = 1 - 2 * (self.q1 * self.q1 + self.q2 * self.q2)
        roll = math.atan2(sinr_cosp, cosr_cosp)

        sinp = 2 * (self.q0 * self.q2 - self.q3 * self.q1)
        if abs(sinp) >= 1:
            pitch = math.copysign(math.pi / 2, sinp)
        else:
            pitch = math.asin(sinp)

        siny_cosp = 2 * (self.q0 * self.q3 + self.q1 * self.q2)
        cosy_cosp = 1 - 2 * (self.q2 * self.q2 + self.q3 * self.q3)
        yaw = math.atan2(siny_cosp, cosy_cosp)

        return {'roll': roll, 'pitch': pitch, 'yaw': yaw}


class ComplementaryFilter:
    def __init__(self, alpha=0.98):
        self.alpha = alpha
        self.roll = 0.0
        self.pitch = 0.0
        self.yaw = 0.0
        self.prev_time = time.time()

    def update(self, gx, gy, gz, ax, ay, az):
        now = time.time()
        dt = now - self.prev_time
        self.prev_time = now
        dt = min(dt, 0.1)

        roll_acc = math.atan2(ay, az)
        pitch_acc = math.atan2(-ax, math.sqrt(ay * ay + az * az))

        self.roll = self.alpha * (self.roll + gx * math.pi / 180.0 * dt) + (1 - self.alpha) * roll_acc
        self.pitch = self.alpha * (self.pitch + gy * math.pi / 180.0 * dt) + (1 - self.alpha) * pitch_acc
        self.yaw = self.yaw + gz * math.pi / 180.0 * dt

    def get_euler_angles(self):
        return {'roll': self.roll, 'pitch': self.pitch, 'yaw': self.yaw}


imu_driver = MPU6050Driver() if not USE_SIMULATED_IMU else None
simulated_imu = SimulatedIMU() if USE_SIMULATED_IMU else None
attitude_filter = MadgwickFilter(beta=0.1)
complementary_filter = ComplementaryFilter(alpha=0.98)
USE_MADGWICK = os.getenv('USE_MADGWICK', 'true').lower() == 'true'


class VideoStreamTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, camera_index=0):
        super().__init__()
        self.cap = cv2.VideoCapture(camera_index)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

    async def recv(self):
        loop = asyncio.get_event_loop()
        ret, frame = await loop.run_in_executor(None, self.cap.read)
        if not ret:
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        video_frame = VideoFrame.from_ndarray(frame, format="rgb24")
        video_frame.pts = int(time.time() * 90000)
        video_frame.time_base = (1, 90000)
        return video_frame

    def close(self):
        if self.cap:
            self.cap.release()


video_track = None


async def create_peer_connection(controller_socket_id):
    pc = RTCPeerConnection()
    
    if video_track is None:
        return None
    
    pc.addTrack(video_track)

    @pc.on("icecandidate")
    async def on_ice_candidate(candidate):
        if candidate:
            await sio.emit('webrtc_ice_candidate', {
                'candidate': candidate.toJSON(),
                'toController': True,
                'controllerSocketId': controller_socket_id
            })

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"Connection state: {pc.connectionState}")
        if pc.connectionState in ["failed", "disconnected", "closed"]:
            if controller_socket_id in peer_connections:
                del peer_connections[controller_socket_id]

    return pc


@sio.event
async def connect():
    print("Connected to server")
    await sio.emit('robot_register', {
        'robotId': robot_config['robot_id'],
        'name': robot_config['robot_name'],
        'pose': current_pose,
        'armAngles': current_arm_angles
    })


@sio.event
async def disconnect():
    print("Disconnected from server")
    for pc in peer_connections.values():
        await pc.close()
    peer_connections.clear()


@sio.event
async def controller_connected(data):
    print(f"Controller connected: {data['userId']}")


@sio.event
async def controller_disconnected():
    print("Controller disconnected")
    for pc in peer_connections.values():
        await pc.close()
    peer_connections.clear()


def is_duplicate(seq):
    if not seq:
        return False
    if seq in processed_sequences:
        return True
    processed_sequences.add(seq)
    if len(processed_sequences) > MAX_SEQ_HISTORY:
        processed_sequences.clear()
    return False


@sio.event
async def velocity_command(data):
    global target_velocity, last_command_time
    
    seq = data.get('seq')
    if is_duplicate(seq):
        print(f"Duplicate command dropped: {seq[-8:] if seq else 'no_seq'}")
        return
    
    target_velocity['linear'] = float(data['linear'])
    target_velocity['angular'] = float(data['angular'])
    last_command_time = time.time()
    
    seq_display = seq[-8:] if seq else 'N/A'
    print(f"Velocity cmd - Linear: {target_velocity['linear']:.2f}, Angular: {target_velocity['angular']:.2f} [seq:{seq_display}]")


@sio.event
async def arm_command(data):
    global target_arm_position, gripper_state
    
    seq = data.get('seq')
    if is_duplicate(seq):
        print(f"Duplicate arm command dropped: {seq[-8:] if seq else 'no_seq'}")
        return
    
    target_arm_position = data['position']
    gripper_state = data['gripper']
    
    seq_display = seq[-8:] if seq else 'N/A'
    print(f"Arm cmd - Position: {target_arm_position}, Gripper: {gripper_state} [seq:{seq_display}]")


@sio.event
async def webrtc_offer(data):
    controller_socket_id = data.get('controllerSocketId')
    if not controller_socket_id:
        return
        
    if controller_socket_id in peer_connections:
        await peer_connections[controller_socket_id].close()
    
    pc = await create_peer_connection(controller_socket_id)
    if not pc:
        return
        
    peer_connections[controller_socket_id] = pc
    
    offer = RTCSessionDescription(sdp=data['offer']['sdp'], type=data['offer']['type'])
    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    
    await sio.emit('webrtc_answer', {
        'answer': {'sdp': pc.localDescription.sdp, 'type': pc.localDescription.type},
        'controllerSocketId': controller_socket_id
    })


@sio.event
async def webrtc_answer(data):
    pass


@sio.event
async def webrtc_ice_candidate(data):
    controller_socket_id = data.get('controllerSocketId')
    if controller_socket_id and controller_socket_id in peer_connections:
        candidate = data['candidate']
        if candidate:
            from aiortc import RTCIceCandidate
            ice_candidate = RTCIceCandidate(
                foundation=candidate.get('foundation'),
                component=candidate.get('component', 1),
                protocol=candidate.get('protocol', 'udp'),
                priority=candidate.get('priority', 0),
                ip=candidate.get('ip'),
                port=candidate.get('port'),
                type=candidate.get('type'),
                tcpType=candidate.get('tcpType'),
                relatedAddress=candidate.get('relatedAddress'),
                relatedPort=candidate.get('relatedPort'),
                sdpMid=candidate.get('sdpMid'),
                sdpMLineIndex=candidate.get('sdpMLineIndex')
            )
            await peer_connections[controller_socket_id].addIceCandidate(ice_candidate)


async def update_imu_attitude(dt):
    global imu_attitude, imu_raw
    
    if imu_driver and imu_driver.initialized:
        imu_data = imu_driver.get_data()
    elif simulated_imu:
        imu_data = simulated_imu.get_data(current_velocity, dt)
    else:
        return
    
    if imu_data is None:
        return
    
    imu_raw = imu_data
    accel = imu_data['accel']
    gyro = imu_data['gyro']
    
    if USE_MADGWICK:
        attitude_filter.update(gyro[0], gyro[1], gyro[2], accel[0], accel[1], accel[2])
        imu_attitude = attitude_filter.get_euler_angles()
    else:
        complementary_filter.update(gyro[0], gyro[1], gyro[2], accel[0], accel[1], accel[2])
        imu_attitude = complementary_filter.get_euler_angles()


async def robot_control_loop():
    global current_pose, current_arm_angles, current_velocity
    
    imu_update_counter = 0
    
    while True:
        try:
            dt = 0.05
            now = time.time()
            
            imu_update_counter += 1
            if imu_update_counter % 2 == 0:
                await update_imu_attitude(dt)
            
            if now - last_command_time > COMMAND_TIMEOUT:
                target_velocity['linear'] = 0.0
                target_velocity['angular'] = 0.0
            
            linear_diff = target_velocity['linear'] - current_velocity['linear']
            angular_diff = target_velocity['angular'] - current_velocity['angular']
            max_step = VELOCITY_RAMP_RATE * dt
            
            if abs(linear_diff) > max_step:
                current_velocity['linear'] += np.sign(linear_diff) * max_step
            else:
                current_velocity['linear'] = target_velocity['linear']
            
            if abs(angular_diff) > max_step:
                current_velocity['angular'] += np.sign(angular_diff) * max_step
            else:
                current_velocity['angular'] = target_velocity['angular']
            
            if abs(current_velocity['linear']) > 0.01 or abs(current_velocity['angular']) > 0.01:
                current_pose['x'] += current_velocity['linear'] * np.cos(current_pose['yaw']) * dt
                current_pose['y'] += current_velocity['linear'] * np.sin(current_pose['yaw']) * dt
                current_pose['yaw'] += current_velocity['angular'] * dt
                
                if current_pose['yaw'] > np.pi:
                    current_pose['yaw'] -= 2 * np.pi
                elif current_pose['yaw'] < -np.pi:
                    current_pose['yaw'] += 2 * np.pi
            
            target_angles = inverse_kinematics(target_arm_position)
            for i in range(6):
                diff = target_angles[i] - current_arm_angles[i]
                if abs(diff) > 0.1:
                    current_arm_angles[i] += np.sign(diff) * min(abs(diff), 2.0)
            
            await sio.emit('robot_pose_update', {
                'pose': {
                    'x': current_pose['x'],
                    'y': current_pose['y'],
                    'yaw': current_pose['yaw'],
                    'roll': imu_attitude['roll'],
                    'pitch': imu_attitude['pitch']
                },
                'armAngles': current_arm_angles,
                'imu': {
                    'attitude': imu_attitude,
                    'raw': imu_raw
                }
            })
            
        except Exception as e:
            print(f"Control loop error: {e}")
        
        await asyncio.sleep(0.05)


def inverse_kinematics(position):
    x, y, z = position['x'], position['y'], position['z']
    
    angles = [0.0] * 6
    
    if abs(x) > 0.01 or abs(y) > 0.01:
        angles[0] = np.arctan2(y, x) * 180 / np.pi
    
    r = np.sqrt(x*x + y*y)
    h = z - 0.1
    
    if r > 0.01:
        angles[1] = np.arctan2(h, r) * 180 / np.pi - 45
        angles[2] = 90 - angles[1]
    
    angles[3] = 0
    angles[4] = -30
    angles[5] = 0
    
    return angles


async def main():
    global video_track
    
    print("Starting robot client...")
    print(f"Robot ID: {robot_config['robot_id']}")
    print(f"Robot Name: {robot_config['robot_name']}")
    print(f"Server URL: {robot_config['server_url']}")
    
    try:
        video_track = VideoStreamTrack(camera_index=0)
        print("Camera initialized successfully")
    except Exception as e:
        print(f"Warning: Could not initialize camera: {e}")
        print("Running without video...")
        video_track = None
    
    control_task = asyncio.create_task(robot_control_loop())
    
    try:
        await sio.connect(
            robot_config['server_url'],
            auth={'token': 'robot-client'},
            transports=['websocket', 'polling']
        )
        await sio.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
    except Exception as e:
        print(f"Connection error: {e}")
    finally:
        control_task.cancel()
        if video_track:
            video_track.close()
        for pc in peer_connections.values():
            await pc.close()
        await sio.disconnect()


if __name__ == '__main__':
    asyncio.run(main())
