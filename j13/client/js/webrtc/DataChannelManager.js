export class DataChannelManager {
  constructor(localSessionId) {
    this.localSessionId = localSessionId;
    this.peerConnections = new Map();
    this.dataChannels = new Map();
    this.eventListeners = {};
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ];
  }

  createPeerConnection(remoteSessionId, onSignal) {
    if (this.peerConnections.has(remoteSessionId)) {
      return this.peerConnections.get(remoteSessionId);
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onSignal({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          break;
        case 'disconnected':
        case 'failed':
        case 'closed':
          this.removePeer(remoteSessionId);
          break;
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      this._setupDataChannel(channel, remoteSessionId);
    };

    if (remoteSessionId > this.localSessionId) {
      const channel = pc.createDataChannel('collab-3d', {
        ordered: false,
        maxRetransmits: 0
      });
      this._setupDataChannel(channel, remoteSessionId);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          onSignal({
            type: 'offer',
            offer: pc.localDescription
          });
        })
        .catch(err => console.error('Error creating offer:', err));
    }

    this.peerConnections.set(remoteSessionId, {
      connection: pc,
      onSignal,
      remoteSessionId
    });

    return pc;
  }

  _setupDataChannel(channel, remoteSessionId) {
    channel.onopen = () => {
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleDataMessage(data, remoteSessionId);
      } catch (err) {
        console.error('Error parsing data channel message:', err);
      }
    };

    channel.onerror = (err) => {
      console.error('Data channel error:', err);
    };

    channel.onclose = () => {
      this.dataChannels.delete(remoteSessionId);
    };

    this.dataChannels.set(remoteSessionId, channel);
  }

  _handleDataMessage(data, remoteSessionId) {
    if (data.type === 'camera-update') {
      this._emit('peer-camera', {
        sessionId: remoteSessionId,
        camera: data.camera
      });
    } else if (data.type === 'peer-data') {
      this._emit('peer-data', {
        sessionId: remoteSessionId,
        payload: data.payload
      });
    }
  }

  handleSignal(data) {
    const { from, type, payload } = data;
    const peerInfo = this.peerConnections.get(from);

    if (!peerInfo) {
      this.createPeerConnection(from, (signalData) => {
        this._emit('signal', {
          to: from,
          type: signalData.type,
          payload: signalData
        });
      });
    }

    const pc = this.peerConnections.get(from)?.connection;
    if (!pc) return;

    switch (type) {
      case 'offer':
        pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
          .then(() => pc.createAnswer())
          .then(answer => pc.setLocalDescription(answer))
          .then(() => {
            this._emit('signal', {
              to: from,
              type: 'answer',
              payload: { answer: pc.localDescription }
            });
          })
          .catch(err => console.error('Error handling offer:', err));
        break;

      case 'answer':
        pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
          .catch(err => console.error('Error handling answer:', err));
        break;

      case 'ice-candidate':
        pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
          .catch(err => console.error('Error adding ICE candidate:', err));
        break;
    }
  }

  sendCameraUpdate(camera) {
    const data = JSON.stringify({
      type: 'camera-update',
      camera
    });

    this.dataChannels.forEach((channel, sessionId) => {
      if (channel.readyState === 'open') {
        try {
          channel.send(data);
        } catch (err) {
          console.error('Error sending camera update:', err);
        }
      }
    });
  }

  sendToPeer(remoteSessionId, payload) {
    const channel = this.dataChannels.get(remoteSessionId);
    if (channel && channel.readyState === 'open') {
      const data = JSON.stringify({
        type: 'peer-data',
        payload
      });
      channel.send(data);
    }
  }

  removePeer(remoteSessionId) {
    const peerInfo = this.peerConnections.get(remoteSessionId);
    if (peerInfo) {
      try {
        peerInfo.connection.close();
      } catch (e) {}
      this.peerConnections.delete(remoteSessionId);
    }

    const channel = this.dataChannels.get(remoteSessionId);
    if (channel) {
      try {
        channel.close();
      } catch (e) {}
      this.dataChannels.delete(remoteSessionId);
    }
  }

  closeAll() {
    this.peerConnections.forEach((info, sessionId) => {
      try {
        info.connection.close();
      } catch (e) {}
    });
    this.peerConnections.clear();

    this.dataChannels.forEach(channel => {
      try {
        channel.close();
      } catch (e) {}
    });
    this.dataChannels.clear();
  }

  on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  _emit(event, data) {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(cb => cb(data));
    }
  }

  getStats() {
    return {
      peerCount: this.peerConnections.size,
      channelCount: this.dataChannels.size
    };
  }
}
