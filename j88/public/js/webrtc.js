class WebRTCManager {
  constructor(signalingClient) {
    this.signaling = signalingClient;
    this.connections = new Map();
    this.dataChannels = new Map();
    this.onDataReceived = null;
    this.onChannelOpen = null;
    this.onChannelClose = null;

    this._setupSignaling();
  }

  _setupSignaling() {
    this.signaling.on('webrtc-offer', async ({ fromId, offer }) => {
      await this._handleOffer(fromId, offer);
    });

    this.signaling.on('webrtc-answer', async ({ fromId, answer }) => {
      await this._handleAnswer(fromId, answer);
    });

    this.signaling.on('webrtc-ice-candidate', async ({ fromId, candidate }) => {
      await this._handleIceCandidate(fromId, candidate);
    });
  }

  async _createPeerConnection(peerId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.connections.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(peerId, event.candidate);
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this._setupDataChannel(peerId, channel);
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] 与 ${peerId} 连接状态: ${pc.connectionState}`);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.dataChannels.delete(peerId);
        this.connections.delete(peerId);
      }
    };

    return pc;
  }

  _setupDataChannel(peerId, channel) {
    this.dataChannels.set(peerId, channel);

    channel.onopen = () => {
      console.log(`[WebRTC] DataChannel 与 ${peerId} 已打开`);
      if (this.onChannelOpen) this.onChannelOpen(peerId);
    };

    channel.onclose = () => {
      console.log(`[WebRTC] DataChannel 与 ${peerId} 已关闭`);
      this.dataChannels.delete(peerId);
      if (this.onChannelClose) this.onChannelClose(peerId);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (this.onDataReceived) this.onDataReceived(peerId, data);
      } catch (e) {
        console.error('[WebRTC] 解析数据失败:', e);
      }
    };
  }

  async createConnection(peerId) {
    const pc = await this._createPeerConnection(peerId);
    const channel = pc.createDataChannel('factorResults', {
      ordered: true,
    });
    this._setupDataChannel(peerId, channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.signaling.sendOffer(peerId, offer);

    return { pc, channel };
  }

  async _handleOffer(fromId, offer) {
    const pc = await this._createPeerConnection(fromId);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signaling.sendAnswer(fromId, answer);
  }

  async _handleAnswer(fromId, answer) {
    const pc = this.connections.get(fromId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async _handleIceCandidate(fromId, candidate) {
    const pc = this.connections.get(fromId);
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('[WebRTC] 添加 ICE 候选失败:', e);
      }
    }
  }

  sendData(peerId, data) {
    const channel = this.dataChannels.get(peerId);
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  broadcastData(data) {
    for (const [peerId] of this.dataChannels) {
      this.sendData(peerId, data);
    }
  }

  isChannelReady(peerId) {
    const channel = this.dataChannels.get(peerId);
    return channel && channel.readyState === 'open';
  }

  closeConnection(peerId) {
    const channel = this.dataChannels.get(peerId);
    if (channel) channel.close();
    const pc = this.connections.get(peerId);
    if (pc) pc.close();
    this.dataChannels.delete(peerId);
    this.connections.delete(peerId);
  }

  closeAll() {
    for (const [peerId] of this.dataChannels) {
      this.closeConnection(peerId);
    }
  }
}
