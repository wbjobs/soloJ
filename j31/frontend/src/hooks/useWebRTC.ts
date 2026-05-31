import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

interface UseWebRTCProps {
  taskId: string;
  onStreamReceived?: (stream: MediaStream) => void;
}

interface UseWebRTCResult {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export const useWebRTC = ({
  taskId,
  onStreamReceived,
}: UseWebRTCProps): UseWebRTCResult => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const peerIdRef = useRef<string>(`${Date.now()}`);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceServers);

    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          await axios.post('/api/webrtc/ice', {
            taskId,
            candidate: event.candidate,
            peerId: peerIdRef.current,
          });
        } catch (err) {
          console.error('Failed to send ICE candidate:', err);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected') {
        setIsConnected(true);
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setIsConnected(false);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      setRemoteStream(stream);
      onStreamReceived?.(stream);
    };

    return pc;
  }, [taskId, onStreamReceived]);

  const createOffer = useCallback(async (pc: RTCPeerConnection) => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await axios.post('/api/webrtc/offer', {
      taskId,
      offer,
      peerId: peerIdRef.current,
    });
  }, [taskId]);

  const waitForAnswer = useCallback(async (pc: RTCPeerConnection) => {
    const maxAttempts = 30;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`/api/webrtc/answer/${taskId}/${peerIdRef.current}`);
        if (response.data.answer) {
          await pc.setRemoteDescription(new RTCSessionDescription(response.data.answer));
          return true;
        }
      } catch (err) {
        console.error('Failed to get answer:', err);
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    return false;
  }, [taskId]);

  const collectICECandidates = useCallback(async () => {
    try {
      const response = await axios.get(`/api/webrtc/ice/${taskId}/${peerIdRef.current}`);
      return response.data.candidates || [];
    } catch (err) {
      console.error('Failed to get ICE candidates:', err);
      return [];
    }
  }, [taskId]);

  const startStreaming = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const pc = createPeerConnection();
      peerConnectionRef.current = pc;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
        setLocalStream(stream);
      } catch (err) {
        console.log('No camera/mic available, using data channel only');
      }

      await createOffer(pc);
      const gotAnswer = await waitForAnswer(pc);

      if (!gotAnswer) {
        throw new Error('Failed to establish connection - no answer received');
      }

      const candidates = await collectICECandidates();
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate:', err);
        }
      }

    } catch (err: any) {
      setError(err.message || 'Failed to start WebRTC streaming');
      console.error('WebRTC error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [createPeerConnection, createOffer, waitForAnswer, collectICECandidates]);

  const stopStreaming = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setIsConnected(false);
  }, [localStream]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isConnected,
    isLoading,
    error,
    startStreaming,
    stopStreaming,
    localStream,
    remoteStream,
  };
};

export default useWebRTC;
