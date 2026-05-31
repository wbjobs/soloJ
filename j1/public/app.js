const NOTES = [
  { index: 0, pitch: 'C4', x: 130, y: 105, duration: 1 },
  { index: 1, pitch: 'D4', x: 190, y: 97.5, duration: 1 },
  { index: 2, pitch: 'E4', x: 250, y: 90, duration: 1 },
  { index: 3, pitch: 'F4', x: 310, y: 82.5, duration: 1 },
  { index: 4, pitch: 'G4', x: 370, y: 75, duration: 1 },
  { index: 5, pitch: 'A4', x: 430, y: 67.5, duration: 1 },
  { index: 6, pitch: 'B4', x: 490, y: 60, duration: 1 },
  { index: 7, pitch: 'C5', x: 550, y: 52.5, duration: 1 },
  { index: 8, pitch: 'B4', x: 610, y: 60, duration: 1 },
  { index: 9, pitch: 'A4', x: 670, y: 67.5, duration: 1 },
  { index: 10, pitch: 'G4', x: 730, y: 75, duration: 1 },
  { index: 11, pitch: 'F4', x: 790, y: 82.5, duration: 1 },
  { index: 12, pitch: 'E4', x: 850, y: 90, duration: 1 },
  { index: 13, pitch: 'D4', x: 910, y: 97.5, duration: 1 },
];

const PITCH_TO_SEMITONES = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4,
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
  'A#': 10, 'Bb': 10, 'B': 11
};

function pitchToMidi(pitch) {
  const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) return 60;
  const [, note, octave] = match;
  return (parseInt(octave) + 1) * 12 + PITCH_TO_SEMITONES[note];
}

function getIntervalSemitones(pitch1, pitch2) {
  return Math.abs(pitchToMidi(pitch2) - pitchToMidi(pitch1));
}

const VALIDATION_RULES = {
  checkSamePitchConsecutive(note, prevNote, nextNote) {
    const errors = [];
    if (prevNote && note.pitch === prevNote.pitch) {
      errors.push(`与前一音符(${prevNote.pitch})音高相同，连续重复`);
    }
    if (nextNote && note.pitch === nextNote.pitch) {
      errors.push(`与后一音符(${nextNote.pitch})音高相同，连续重复`);
    }
    return errors;
  },

  checkIntervalToSmall(note, prevNote, nextNote) {
    const errors = [];
    const MIN_INTERVAL = 2;

    if (prevNote) {
      const interval = getIntervalSemitones(prevNote.pitch, note.pitch);
      if (interval > 0 && interval < MIN_INTERVAL) {
        errors.push(`与前一音程为${interval}半音，距离过近(建议≥2半音)`);
      }
    }
    if (nextNote) {
      const interval = getIntervalSemitones(note.pitch, nextNote.pitch);
      if (interval > 0 && interval < MIN_INTERVAL) {
        errors.push(`与后一音程为${interval}半音，距离过近(建议≥2半音)`);
      }
    }
    return errors;
  },

  checkLargeLeap(note, prevNote, nextNote) {
    const errors = [];
    const MAX_INTERVAL = 12;

    if (prevNote) {
      const interval = getIntervalSemitones(prevNote.pitch, note.pitch);
      if (interval > MAX_INTERVAL) {
        errors.push(`与前一音程大跳${interval}半音，超过8度`);
      }
    }
    if (nextNote) {
      const interval = getIntervalSemitones(note.pitch, nextNote.pitch);
      if (interval > MAX_INTERVAL) {
        errors.push(`与后一音程大跳${interval}半音，超过8度`);
      }
    }
    return errors;
  },

  checkLeapWithoutStepwise(note, prevNote, nextNote) {
    const errors = [];
    if (!prevNote || !nextNote) return errors;

    const prevInterval = getIntervalSemitones(prevNote.pitch, note.pitch);
    const nextInterval = getIntervalSemitones(note.pitch, nextNote.pitch);

    if (prevInterval >= 5 && nextInterval >= 5) {
      errors.push('连续两次大跳，建议在大跳后反向级进');
    }
    return errors;
  },

  checkCrossing(note, prevNote, nextNote) {
    const errors = [];
    if (!prevNote || !nextNote) return errors;

    const noteMidi = pitchToMidi(note.pitch);
    const prevMidi = pitchToMidi(prevNote.pitch);
    const nextMidi = pitchToMidi(nextNote.pitch);

    if ((noteMidi > prevMidi && noteMidi < nextMidi) ||
        (noteMidi < prevMidi && noteMidi > nextMidi)) {
      const direction = noteMidi > prevMidi ? '上行' : '下行';
      errors.push(`${direction}后反向，可能导致声部交叉`);
    }
    return errors;
  }
};

function validateNote(noteIndex) {
  const note = NOTES[noteIndex];
  const prevNote = noteIndex > 0 ? NOTES[noteIndex - 1] : null;
  const nextNote = noteIndex < NOTES.length - 1 ? NOTES[noteIndex + 1] : null;

  const allErrors = [];
  for (const ruleName in VALIDATION_RULES) {
    const errors = VALIDATION_RULES[ruleName](note, prevNote, nextNote);
    allErrors.push(...errors);
  }

  return allErrors;
}

function showValidationResult(noteIndex, errors) {
  const resultEl = document.getElementById('validationResult');
  const noteEl = noteElements[noteIndex];

  noteElements.forEach(el => el.classList.remove('error-mark'));

  if (errors.length > 0) {
    resultEl.className = 'validation-result error';
    resultEl.innerHTML = `<strong>⚠ 疑似错误:</strong> ${errors.join('；')}`;
    if (noteEl) noteEl.classList.add('error-mark');
  } else {
    resultEl.className = 'validation-result success';
    resultEl.innerHTML = `<strong>✓</strong> ${NOTES[noteIndex].pitch} 乐理检查通过`;
  }

  clearTimeout(showValidationResult._timer);
  showValidationResult._timer = setTimeout(() => {
    resultEl.className = 'validation-result';
    resultEl.style.display = 'none';
    noteElements.forEach(el => el.classList.remove('error-mark'));
  }, 5000);
}

let ws;
let clientId;
let roomId = null;
let isHost = false;
let members = [];
let peerConnections = new Map();
let dataChannels = new Map();

let audioContext = null;
let isPlaying = false;
let startTime = 0;
let bpm = 120;
let nextNoteTime = 0;
let currentNoteIndex = 0;
let schedulerTimer = null;
const SCHEDULE_AHEAD_TIME = 0.1;

let annotations = new Map();
let annotationColor = '#ef4444';

const noteElements = [];

function init() {
  renderNotes();
  bindEvents();
  loadAnnotations();
}

function renderNotes() {
  const notesGroup = document.getElementById('notes');
  NOTES.forEach(note => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'note');
    g.setAttribute('data-index', note.index);
    
    const head = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    head.setAttribute('cx', note.x);
    head.setAttribute('cy', note.y);
    head.setAttribute('rx', 10);
    head.setAttribute('ry', 7);
    head.setAttribute('class', 'note-head');
    head.setAttribute('transform', `rotate(-15 ${note.x} ${note.y})`);
    
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', note.x + 9);
    stem.setAttribute('y1', note.y);
    stem.setAttribute('x2', note.x + 9);
    stem.setAttribute('y2', note.y - 45);
    stem.setAttribute('class', 'note-stem');
    
    g.appendChild(head);
    g.appendChild(stem);
    g.addEventListener('click', () => handleNoteClick(note.index));
    notesGroup.appendChild(g);
    noteElements.push(g);
  });
}

function bindEvents() {
  document.getElementById('createRoomBtn').addEventListener('click', createRoom);
  document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
  document.getElementById('startBeatBtn').addEventListener('click', startBeat);
  document.getElementById('stopBeatBtn').addEventListener('click', stopBeat);
  document.getElementById('bpmInput').addEventListener('change', (e) => {
    bpm = parseInt(e.target.value) || 120;
  });
  document.getElementById('annotationColor').addEventListener('change', (e) => {
    annotationColor = e.target.value;
  });
  document.getElementById('clearAnnotationsBtn').addEventListener('click', clearAnnotations);
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);
  
  ws.onopen = () => {
    updateConnectionStatus('connected', '信令已连接');
  };
  
  ws.onclose = () => {
    updateConnectionStatus('disconnected', '信令断开');
  };
  
  ws.onmessage = handleSignalingMessage;
}

function updateConnectionStatus(status, text) {
  const el = document.getElementById('connectionStatus');
  el.className = `status ${status}`;
  el.textContent = text;
}

function createRoom() {
  if (!ws) connectWebSocket();
  sendSignaling({ type: 'create-room', bpm });
}

function joinRoom() {
  const input = document.getElementById('roomIdInput').value.trim();
  if (!input) return;
  if (!ws) connectWebSocket();
  sendSignaling({ type: 'join-room', roomId: input });
}

function sendSignaling(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

async function handleSignalingMessage(event) {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'room-created':
      roomId = msg.roomId;
      isHost = msg.isHost;
      showRoomInfo();
      break;
      
    case 'room-joined':
      roomId = msg.roomId;
      isHost = msg.isHost;
      members = msg.members;
      showRoomInfo();
      updateMembersList();
      
      bpm = msg.bpm;
      document.getElementById('bpmInput').value = bpm;
      
      if (msg.isPlaying) {
        const latency = Date.now() - msg.serverTime;
        const adjustedStartTime = msg.startTime + latency;
        syncBeatState(true, adjustedStartTime, bpm);
      }
      
      if (isHost) {
        members.forEach(memberId => {
          if (memberId !== clientId && !peerConnections.has(memberId)) {
            createPeerConnection(memberId, true);
          }
        });
      }
      break;
      
    case 'member-joined':
      members = msg.members;
      updateMembersList();
      
      if (isHost) {
        createPeerConnection(msg.memberId, true);
      }
      break;
      
    case 'member-left':
      members = msg.members;
      updateMembersList();
      closePeerConnection(msg.memberId);
      break;
      
    case 'offer':
      await handleOffer(msg.from, msg.data);
      break;
      
    case 'answer':
      await handleAnswer(msg.from, msg.data);
      break;
      
    case 'ice-candidate':
      await handleIceCandidate(msg.from, msg.data);
      break;
      
    case 'beat-sync': {
      if (isHost) break;
      const latency = Date.now() - msg.serverTime;
      const adjustedStartTime = msg.startTime + latency;
      syncBeatState(msg.isPlaying, adjustedStartTime, msg.bpm);
      break;
    }
      
    case 'annotation-created':
      addAnnotationToMap(msg.annotation);
      renderAnnotations();
      break;
      
    case 'annotation-updated':
      addAnnotationToMap(msg.annotation);
      renderAnnotations();
      break;
      
    case 'annotation-deleted':
      annotations.forEach((ann, key) => {
        if (ann._id === msg.annotationId) {
          annotations.delete(key);
        }
      });
      renderAnnotations();
      break;
      
    case 'error':
      alert(msg.message);
      break;
  }
}

function showRoomInfo() {
  document.getElementById('roomInfo').style.display = 'block';
  document.getElementById('roomIdDisplay').textContent = roomId;
  document.getElementById('roleDisplay').textContent = isHost ? '房主' : '成员';
  document.getElementById('createRoomBtn').disabled = true;
  document.getElementById('joinRoomBtn').disabled = true;
}

function updateMembersList() {
  const container = document.getElementById('membersList');
  container.innerHTML = '<span style="color: #6b7280; font-size: 13px;">成员:</span>';
  members.forEach(m => {
    const badge = document.createElement('span');
    badge.className = 'member-badge';
    badge.textContent = m.slice(0, 4);
    container.appendChild(badge);
  });
}

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function createPeerConnection(targetId, isInitiator) {
  if (peerConnections.has(targetId)) return;
  
  const pc = new RTCPeerConnection(ICE_CONFIG);
  peerConnections.set(targetId, pc);
  
  if (isInitiator) {
    const dc = pc.createDataChannel('sync', { ordered: true });
    setupDataChannel(dc, targetId);
  }
  
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      sendSignaling({
        type: 'ice-candidate',
        targetId,
        data: e.candidate
      });
    }
  };
  
  pc.ondatachannel = (e) => {
    setupDataChannel(e.channel, targetId);
  };
  
  if (isInitiator) {
    pc.createOffer().then(offer => pc.setLocalDescription(offer))
      .then(() => {
        sendSignaling({
          type: 'offer',
          targetId,
          data: pc.localDescription
        });
      });
  }
  
  return pc;
}

function setupDataChannel(dc, targetId) {
  dc.onopen = () => {
    console.log('Data channel open with', targetId);
    dataChannels.set(targetId, dc);
  };
  
  dc.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    handleDataChannelMessage(msg, targetId);
  };
  
  dc.onclose = () => {
    dataChannels.delete(targetId);
  };
}

async function handleOffer(from, data) {
  const pc = createPeerConnection(from, false);
  await pc.setRemoteDescription(new RTCSessionDescription(data));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendSignaling({ type: 'answer', targetId: from, data: pc.localDescription });
}

async function handleAnswer(from, data) {
  const pc = peerConnections.get(from);
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
}

async function handleIceCandidate(from, data) {
  const pc = peerConnections.get(from);
  if (pc && data) await pc.addIceCandidate(new RTCIceCandidate(data));
}

function closePeerConnection(targetId) {
  const pc = peerConnections.get(targetId);
  if (pc) pc.close();
  peerConnections.delete(targetId);
  dataChannels.delete(targetId);
}

function broadcastData(msg) {
  dataChannels.forEach(dc => {
    if (dc.readyState === 'open') {
      dc.send(JSON.stringify(msg));
    }
  });
}

function handleDataChannelMessage(msg, fromId) {
  switch (msg.type) {
    case 'beat-start':
      if (!isHost) {
        syncBeatState(true, msg.startTime, msg.bpm);
      }
      break;
    case 'beat-stop':
      if (!isHost) {
        syncBeatState(false, 0, msg.bpm);
      }
      break;
    case 'beat-tick':
      if (!isHost && Math.abs(msg.noteIndex - currentNoteIndex) > 1) {
        currentNoteIndex = msg.noteIndex;
        highlightNote(msg.noteIndex);
      }
      break;
  }
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playClick(time, freq = 1000) {
  if (!audioContext) return;
  
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  
  osc.connect(gain);
  gain.connect(audioContext.destination);
  
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  
  osc.start(time);
  osc.stop(time + 0.05);
}

function startBeat() {
  initAudio();
  
  const now = audioContext.currentTime;
  startTime = now + 0.05;
  nextNoteTime = startTime;
  currentNoteIndex = 0;
  isPlaying = true;
  
  document.getElementById('startBeatBtn').disabled = true;
  document.getElementById('stopBeatBtn').disabled = false;
  
  if (isHost) {
    const startTimestamp = Date.now() + 50;
    sendSignaling({
      type: 'beat-sync',
      isPlaying: true,
      startTime: startTimestamp,
      bpm
    });
    broadcastData({
      type: 'beat-start',
      startTime: startTimestamp,
      bpm
    });
  }
  
  scheduler();
}

function stopBeat() {
  isPlaying = false;
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  
  document.getElementById('startBeatBtn').disabled = false;
  document.getElementById('stopBeatBtn').disabled = true;
  
  NOTES.forEach((_, i) => unhighlightNote(i));
  document.getElementById('playhead').setAttribute('opacity', '0');
  
  if (isHost) {
    sendSignaling({
      type: 'beat-sync',
      isPlaying: false,
      startTime: 0,
      bpm
    });
    broadcastData({ type: 'beat-stop', bpm });
  }
}

function syncBeatState(playing, startTimestamp, newBpm) {
  initAudio();
  
  bpm = newBpm;
  document.getElementById('bpmInput').value = bpm;
  
  if (playing) {
    const delayMs = startTimestamp - Date.now();
    const delaySec = Math.max(0, delayMs / 1000);
    
    const noteDuration = 60 / bpm;
    const elapsed = Math.max(0, -delayMs / 1000);
    currentNoteIndex = Math.floor(elapsed / noteDuration);
    currentNoteIndex = Math.min(currentNoteIndex, NOTES.length - 1);
    
    startTime = audioContext.currentTime + delaySec;
    nextNoteTime = startTime + (currentNoteIndex * noteDuration);
    isPlaying = true;
    
    document.getElementById('startBeatBtn').disabled = true;
    document.getElementById('stopBeatBtn').disabled = false;
    
    scheduler();
  } else {
    stopBeat();
  }
}

function scheduler() {
  if (!isPlaying) return;
  
  const noteDuration = 60 / bpm;
  
  while (nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
    if (currentNoteIndex >= NOTES.length) {
      stopBeat();
      return;
    }
    
    playClick(nextNoteTime);
    scheduleHighlight(currentNoteIndex, nextNoteTime);
    updatePlayhead(nextNoteTime);
    
    if (isHost && currentNoteIndex % 2 === 0) {
      broadcastData({
        type: 'beat-tick',
        noteIndex: currentNoteIndex,
        time: nextNoteTime
      });
    }
    
    nextNoteTime += noteDuration;
    currentNoteIndex++;
  }
  
  schedulerTimer = setTimeout(scheduler, 25);
}

function scheduleHighlight(index, time) {
  const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
  
  setTimeout(() => {
    highlightNote(index);
    document.getElementById('beatIndicator').classList.add('active');
    setTimeout(() => {
      document.getElementById('beatIndicator').classList.remove('active');
    }, 50);
  }, delay);
}

function updatePlayhead(time) {
  const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
  const noteIndex = currentNoteIndex;
  
  setTimeout(() => {
    if (noteIndex < NOTES.length) {
      const playhead = document.getElementById('playhead');
      playhead.setAttribute('x1', NOTES[noteIndex].x);
      playhead.setAttribute('x2', NOTES[noteIndex].x);
      playhead.setAttribute('opacity', '1');
    }
  }, delay);
}

function highlightNote(index) {
  if (index > 0) unhighlightNote(index - 1);
  if (noteElements[index]) {
    const head = noteElements[index].querySelector('.note-head');
    if (head) head.classList.add('highlighted');
  }
}

function unhighlightNote(index) {
  if (noteElements[index]) {
    const head = noteElements[index].querySelector('.note-head');
    if (head) head.classList.remove('highlighted');
  }
}

async function handleNoteClick(noteIndex) {
  const errors = validateNote(noteIndex);
  showValidationResult(noteIndex, errors);

  try {
    const res = await fetch('/api/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scoreId: 'default',
        noteIndex,
        color: annotationColor,
        author: clientId || 'anonymous',
        clientId
      })
    });
    
    const data = await res.json();
    if (data.success) {
      addAnnotationToMap(data.annotation);
      renderAnnotations();
    }
  } catch (e) {
    console.error('Failed to create annotation:', e);
  }
}

function addAnnotationToMap(annotation) {
  const key = `${annotation.noteIndex}-${annotation._id}`;
  annotations.set(key, annotation);
}

async function loadAnnotations() {
  try {
    const res = await fetch('/api/annotations/default');
    const data = await res.json();
    if (data.success) {
      annotations.clear();
      data.annotations.forEach(ann => addAnnotationToMap(ann));
      renderAnnotations();
    }
  } catch (e) {
    console.error('Failed to load annotations:', e);
  }
}

function renderAnnotations() {
  const group = document.getElementById('annotations');
  group.innerHTML = '';
  
  annotations.forEach(ann => {
    const note = NOTES[ann.noteIndex];
    if (!note) return;
    
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', note.x);
    marker.setAttribute('cy', note.y - 55);
    marker.setAttribute('r', 6);
    marker.setAttribute('fill', ann.color);
    marker.setAttribute('class', 'annotation-marker');
    marker.setAttribute('title', ann.comment || `${ann.author}`);
    group.appendChild(marker);
  });
}

async function clearAnnotations() {
  const promises = [];
  annotations.forEach(ann => {
    promises.push(fetch(`/api/annotations/${ann._id}`, { method: 'DELETE' }));
  });
  await Promise.all(promises);
  annotations.clear();
  renderAnnotations();
}

connectWebSocket();
init();
