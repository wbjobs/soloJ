import express from 'express';

const router = express.Router();

const peers = new Map();

router.post('/webrtc/offer', (req, res) => {
  try {
    const { taskId, offer, peerId } = req.body;
    
    if (!peers.has(taskId)) {
      peers.set(taskId, new Map());
    }
    
    const taskPeers = peers.get(taskId);
    taskPeers.set(peerId, { offer, answer: null });
    
    res.json({
      success: true,
      message: 'Offer received'
    });
  } catch (error) {
    console.error('WebRTC offer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/webrtc/answer', (req, res) => {
  try {
    const { taskId, answer, peerId } = req.body;
    
    if (peers.has(taskId)) {
      const taskPeers = peers.get(taskId);
      if (taskPeers.has(peerId)) {
        taskPeers.get(peerId).answer = answer;
      }
    }
    
    res.json({
      success: true,
      message: 'Answer received'
    });
  } catch (error) {
    console.error('WebRTC answer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/webrtc/offer/:taskId/:peerId', (req, res) => {
  try {
    const { taskId, peerId } = req.params;
    
    if (peers.has(taskId)) {
      const taskPeers = peers.get(taskId);
      for (const [id, data] of taskPeers.entries()) {
        if (id !== peerId && data.offer && !data.answer) {
          return res.json({
            success: true,
            offer: data.offer,
            fromPeerId: id
          });
        }
      }
    }
    
    res.json({
      success: true,
      offer: null
    });
  } catch (error) {
    console.error('WebRTC get offer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/webrtc/answer/:taskId/:peerId', (req, res) => {
  try {
    const { taskId, peerId } = req.params;
    
    if (peers.has(taskId)) {
      const taskPeers = peers.get(taskId);
      const peerData = taskPeers.get(peerId);
      if (peerData && peerData.answer) {
        return res.json({
          success: true,
          answer: peerData.answer
        });
      }
    }
    
    res.json({
      success: true,
      answer: null
    });
  } catch (error) {
    console.error('WebRTC get answer error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/webrtc/ice', (req, res) => {
  try {
    const { taskId, candidate, peerId } = req.body;
    
    if (!peers.has(taskId + '_ice')) {
      peers.set(taskId + '_ice', []);
    }
    
    const iceCandidates = peers.get(taskId + '_ice');
    iceCandidates.push({ peerId, candidate });
    
    res.json({
      success: true,
      message: 'ICE candidate received'
    });
  } catch (error) {
    console.error('WebRTC ICE error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/webrtc/ice/:taskId/:peerId', (req, res) => {
  try {
    const { taskId, peerId } = req.params;
    
    const iceKey = taskId + '_ice';
    if (peers.has(iceKey)) {
      const iceCandidates = peers.get(iceKey);
      const remoteCandidates = iceCandidates
        .filter(c => c.peerId !== peerId)
        .map(c => c.candidate);
      
      return res.json({
        success: true,
        candidates: remoteCandidates
      });
    }
    
    res.json({
      success: true,
      candidates: []
    });
  } catch (error) {
    console.error('WebRTC get ICE error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
