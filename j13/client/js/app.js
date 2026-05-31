import * as THREE from 'three';
import { SceneManager } from './scene/SceneManager.js';
import { DataChannelManager } from './webrtc/DataChannelManager.js';
import { SocketClient } from './socket/SocketClient.js';
import { RecorderService } from './services/Recorder.js';
import { ApiClient } from './services/ApiClient.js';
import { UI } from './ui/UI.js';
import { TimelineControl } from './ui/TimelineControl.js';
import { ReplayController } from './services/ReplayController.js';

class App {
  constructor() {
    this.sceneManager = null;
    this.dataChannelManager = null;
    this.socketClient = null;
    this.recorder = new RecorderService();
    this.apiClient = new ApiClient();
    this.ui = new UI();
    this.timelineControl = null;
    this.replayController = null;

    this.currentRoom = null;
    this.currentUser = null;
    this.users = [];
    this.annotations = [];
    this.selectedAnnotationId = null;
    this.viewLocked = false;
    this.lockedBy = null;
    this.isPlacingAnnotation = false;
    this.pendingAnnotationPosition = null;
    this.isReplayMode = false;
    this.timelineVisible = false;

    this._initEventListeners();
  }

  _initEventListeners() {
    document.getElementById('joinBtn').addEventListener('click', () => this._handleJoin());
    document.getElementById('leaveBtn').addEventListener('click', () => this._handleLeave());

    document.getElementById('lockViewBtn').addEventListener('click', () => this._handleLockView());
    document.getElementById('unlockViewBtn').addEventListener('click', () => this._handleUnlockView());
    document.getElementById('forceUnlockBtn').addEventListener('click', () => this._handleForceUnlock());

    document.getElementById('addAnnotationBtn').addEventListener('click', () => this._handleAddAnnotation());
    document.getElementById('saveAnnotationBtn').addEventListener('click', () => this._handleSaveAnnotation());
    document.getElementById('cancelAnnotationBtn').addEventListener('click', () => this._handleCancelAnnotation());

    document.getElementById('recordBtn').addEventListener('click', () => this._handleStartRecording());
    document.getElementById('stopRecordingBtn').addEventListener('click', () => this._handleStopRecording());
    document.getElementById('cancelRecordingBtn').addEventListener('click', () => this._handleCancelRecording());

    document.getElementById('exportPdfBtn').addEventListener('click', () => this._handleExportPdf());
    document.getElementById('fullscreenBtn').addEventListener('click', () => this._handleFullscreen());
    document.getElementById('closeExportModal').addEventListener('click', () => this.ui.hideModal('export-modal'));
    document.getElementById('exportPdfOption').addEventListener('click', () => this._exportPdf());
    document.getElementById('exportJsonOption').addEventListener('click', () => this._exportJson());

    document.getElementById('toggle-timeline').addEventListener('click', () => this._toggleTimeline());
    document.getElementById('exit-replay-btn').addEventListener('click', () => this._exitReplayMode());

    document.getElementById('roomId').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this._handleJoin();
    });
  }

  async _handleJoin() {
    const roomId = document.getElementById('roomId').value.trim();
    const roomName = document.getElementById('roomName').value.trim();
    const userName = document.getElementById('userName').value.trim();
    const modelUrl = document.getElementById('modelUrl').value.trim();
    const role = document.getElementById('userRole').value;

    if (!userName) {
      this.ui.showError('Please enter your name');
      return;
    }

    this.ui.showLoading();

    this.socketClient = new SocketClient();

    this.socketClient.on('joined', (data) => {
      this._onJoined(data);
    });

    this.socketClient.on('user-joined', (data) => {
      this._onUserJoined(data);
    });

    this.socketClient.on('user-left', (data) => {
      this._onUserLeft(data);
    });

    this.socketClient.on('camera-update', (data) => {
      this._onCameraUpdate(data);
    });

    this.socketClient.on('annotation-added', (data) => {
      this._onAnnotationAdded(data);
    });

    this.socketClient.on('annotation-deleted', (data) => {
      this._onAnnotationDeleted(data);
    });

    this.socketClient.on('annotation-resolved', (data) => {
      this._onAnnotationResolved(data);
    });

    this.socketClient.on('voice-memo-updated', (data) => {
      this._onVoiceMemoUpdated(data);
    });

    this.socketClient.on('view-locked', (data) => {
      this._onViewLocked(data);
    });

    this.socketClient.on('view-unlocked', (data) => {
      this._onViewUnlocked(data);
    });

    this.socketClient.on('signal', (data) => {
      this._onSignal(data);
    });

    this.socketClient.on('model-transform-updated', (data) => {
      this._onModelTransformUpdated(data);
    });

    try {
      await this.socketClient.joinRoom({
        roomId,
        roomName,
        userName,
        modelUrl,
        role,
        color: this._getRandomColor()
      });
    } catch (err) {
      this.ui.showError(err.message || 'Failed to join room');
      this.ui.hideLoading();
    }
  }

  _onJoined(data) {
    this.currentRoom = data.room;
    this.currentUser = data.user;
    this.users = data.users;
    this.annotations = data.annotations;

    this.ui.showReviewScreen();
    this.ui.hideLoading();
    this.ui.updateRoomInfo(this.currentRoom);
    this.ui.updateUserBadge(this.currentUser);
    this.ui.updateUserList(this.users);
    this.ui.updateAnnotationList(this.annotations);

    this.sceneManager = new SceneManager('three-canvas');
    this.sceneManager.init();

    if (this.currentRoom.modelUrl) {
      const existingTransform = this.currentRoom.modelTransform || null;
      this.sceneManager.loadModel(this.currentRoom.modelUrl, existingTransform).then((result) => {
        this.sceneManager.addAnnotationMarkers(this.annotations);

        if (!existingTransform && result && result.transform && this.currentUser.role === 'host') {
          this.socketClient.sendModelTransform(result.transform);
        }
      });
    }

    this.sceneManager.on('camera-changed', (camera) => {
      if (!this.viewLocked && !this.isReplayMode) {
        this.socketClient.sendCameraUpdate(camera);
      }
    });

    this.sceneManager.on('model-click', (intersect) => {
      if (this.isPlacingAnnotation && intersect) {
        this.pendingAnnotationPosition = {
          world: intersect.worldPosition.clone(),
          local: intersect.localPosition.clone()
        };
        this.sceneManager.showPlacementPreview(intersect.worldPosition);
      }
    });

    this.dataChannelManager = new DataChannelManager(this.currentUser.sessionId);

    this.dataChannelManager.on('peer-camera', (data) => {
      this.sceneManager.updateRemoteCamera(data.sessionId, data.camera);
    });

    this.dataChannelManager.on('peer-data', (data) => {
      this._handlePeerData(data);
    });

    this.dataChannelManager.on('signal', (data) => {
      this.socketClient.sendSignal(data.to, data.payload);
    });

    this._initPeerConnections();

    this._initTimeline();
  }

  _onUserJoined(data) {
    this.users = data.users;
    this.ui.updateUserList(this.users);
    this.ui.showNotification(`${data.user.name} joined the room`);
  }

  _onUserLeft(data) {
    this.users = data.users;
    this.ui.updateUserList(this.users);
    if (this.dataChannelManager) {
      this.dataChannelManager.removePeer(data.sessionId);
    }
  }

  _onCameraUpdate(data) {
    if (this.sceneManager) {
      this.sceneManager.updateRemoteCamera(data.sessionId, data.camera);
    }
  }

  _onAnnotationAdded(data) {
    const annotation = {
      ...data.annotation,
      user_name: data.annotation.user_name,
      user_color: data.annotation.user_color
    };
    this.annotations.push(annotation);
    this.ui.updateAnnotationList(this.annotations);
    if (this.sceneManager) {
      this.sceneManager.addAnnotationMarker(annotation);
    }
  }

  _onAnnotationResolved(data) {
    const idx = this.annotations.findIndex(a => a.id === data.annotationId);
    if (idx !== -1) {
      this.annotations[idx] = { ...this.annotations[idx], ...data.annotation };
      this.ui.updateAnnotationList(this.annotations);
      if (this.sceneManager) {
        this.sceneManager.updateAnnotationMarker(this.annotations[idx]);
      }
    }
  }

  _onViewLocked(data) {
    this.viewLocked = true;
    this.lockedBy = data.lockedBy;
    this.ui.showViewLocked(data.lockedBy);
    this.ui.updateLockButtons(true);
    if (this.sceneManager) {
      this.sceneManager.setCameraView(data.view);
    }
  }

  _onViewUnlocked(data) {
    this.viewLocked = false;
    this.lockedBy = null;
    this.ui.hideViewLocked();
    this.ui.updateLockButtons(false);
  }

  _onModelTransformUpdated(data) {
    if (this.currentRoom) {
      this.currentRoom.modelTransform = data.transform;
    }
    if (this.sceneManager && this.sceneManager.model && this.sceneManager.modelTransform) {
      const oldTransform = this.sceneManager.modelTransform;
      if (oldTransform.scale !== data.transform.scale ||
          oldTransform.centerOffset.x !== data.transform.centerOffset.x ||
          oldTransform.centerOffset.y !== data.transform.centerOffset.y ||
          oldTransform.centerOffset.z !== data.transform.centerOffset.z) {
        this.sceneManager.modelTransform = { ...data.transform, normalized: true };
        this.sceneManager.model.position.set(
          data.transform.centerOffset.x,
          data.transform.centerOffset.y,
          data.transform.centerOffset.z
        );
        this.sceneManager.model.scale.setScalar(data.transform.scale);
        this.sceneManager.model.updateMatrixWorld(true);

        this.sceneManager.annotationMarkers.forEach((marker, id) => {
          const ann = this.annotations.find(a => a.id === id);
          if (ann && ann.local_position_x !== undefined) {
            const localPos = new THREE.Vector3(
              ann.local_position_x,
              ann.local_position_y,
              ann.local_position_z
            );
            const worldPos = this.sceneManager.localToWorld(localPos);
            marker.getObject().position.copy(worldPos);
          }
        });

        this.ui.showNotification('Model transform synchronized');
      }
    }
  }

  _onSignal(data) {
    if (this.dataChannelManager) {
      this.dataChannelManager.handleSignal(data);
    }
  }

  _handleLeave() {
    if (this.socketClient) {
      this.socketClient.leaveRoom();
    }
    if (this.dataChannelManager) {
      this.dataChannelManager.closeAll();
    }
    if (this.sceneManager) {
      this.sceneManager.dispose();
    }
    this.currentRoom = null;
    this.currentUser = null;
    this.users = [];
    this.annotations = [];
    this.viewLocked = false;
    this.ui.showLoginScreen();
  }

  _handleLockView() {
    if (!this.sceneManager || this.currentUser.role !== 'host') return;
    const camera = this.sceneManager.getCameraView();
    this.socketClient.lockView(camera);
    this.ui.showViewLocked({ name: this.currentUser.name });
    this.ui.updateLockButtons(true);
  }

  _handleUnlockView() {
    if (this.currentUser.role !== 'host') return;
    this.socketClient.unlockView();
    this.viewLocked = false;
    this.ui.hideViewLocked();
    this.ui.updateLockButtons(false);
  }

  _handleForceUnlock() {
    this.viewLocked = false;
    this.ui.hideViewLocked();
    this.ui.showNotification('View unlocked locally');
  }

  _handleAddAnnotation() {
    if (!this.sceneManager) return;
    this.isPlacingAnnotation = true;
    this.ui.showModal('annotation-modal');
    this.ui.setPlacingMode(true);
  }

  _handleSaveAnnotation() {
    const text = document.getElementById('annotationText').value.trim();

    if (!this.pendingAnnotationPosition) {
      this.ui.showError('Please click on the model to place the annotation');
      return;
    }

    const camera = this.sceneManager.getCameraView();
    const modelTransform = this.sceneManager.getModelTransform();

    this.socketClient.addAnnotation({
      position: {
        x: this.pendingAnnotationPosition.world.x,
        y: this.pendingAnnotationPosition.world.y,
        z: this.pendingAnnotationPosition.world.z
      },
      localPosition: {
        x: this.pendingAnnotationPosition.local.x,
        y: this.pendingAnnotationPosition.local.y,
        z: this.pendingAnnotationPosition.local.z
      },
      textContent: text,
      cameraView: camera,
      modelTransform: modelTransform
    });

    this._resetAnnotationMode();
  }

  _handleCancelAnnotation() {
    this._resetAnnotationMode();
  }

  _resetAnnotationMode() {
    this.isPlacingAnnotation = false;
    this.pendingAnnotationPosition = null;
    document.getElementById('annotationText').value = '';
    this.ui.hideModal('annotation-modal');
    this.ui.setPlacingMode(false);
    if (this.sceneManager) {
      this.sceneManager.clearPlacementPreview();
    }
  }

  _handleStartRecording() {
    if (!this.sceneManager) return;
    this.isPlacingAnnotation = true;
    this.ui.showRecordingPanel();
    this.ui.setPlacingMode(true);

    this.recorder.startRecording().then(() => {
      this.ui.updateRecordingTime(this.recorder.getElapsedTime());
      this._recordingInterval = setInterval(() => {
        this.ui.updateRecordingTime(this.recorder.getElapsedTime());
      }, 1000);
    }).catch(err => {
      this.ui.showError(err.message || 'Recording failed');
      this._resetRecordingMode();
    });
  }

  _handleStopRecording() {
    if (!this.pendingAnnotationPosition) {
      this.ui.showError('Please click on the model to place the voice note');
      return;
    }

    this.recorder.stopRecording().then(async (result) => {
      clearInterval(this._recordingInterval);

      const uploadResult = await this.apiClient.uploadAudio(result.blob);
      const camera = this.sceneManager.getCameraView();
      const modelTransform = this.sceneManager.getModelTransform();

      this.socketClient.addAnnotation({
        position: {
          x: this.pendingAnnotationPosition.world.x,
          y: this.pendingAnnotationPosition.world.y,
          z: this.pendingAnnotationPosition.world.z
        },
        localPosition: {
          x: this.pendingAnnotationPosition.local.x,
          y: this.pendingAnnotationPosition.local.y,
          z: this.pendingAnnotationPosition.local.z
        },
        textContent: '',
        audioUrl: uploadResult.url,
        audioDuration: result.duration,
        cameraView: camera,
        modelTransform: modelTransform
      });

      this._resetRecordingMode();
    }).catch(err => {
      this.ui.showError(err.message || 'Failed to save recording');
      this._resetRecordingMode();
    });
  }

  _handleCancelRecording() {
    this.recorder.cancelRecording();
    clearInterval(this._recordingInterval);
    this._resetRecordingMode();
  }

  _resetRecordingMode() {
    this.isPlacingAnnotation = false;
    this.pendingAnnotationPosition = null;
    this.ui.hideRecordingPanel();
    this.ui.setPlacingMode(false);
    this.ui.updateRecordingTime('00:00');
    if (this.sceneManager) {
      this.sceneManager.clearPlacementPreview();
    }
  }

  _handleExportPdf() {
    this.ui.showModal('export-modal');
  }

  _handleFullscreen() {
    const el = document.getElementById('viewer-panel');
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  _exportPdf() {
    if (!this.currentRoom) return;
    window.open(`/api/export/room/${this.currentRoom.id}/annotations`, '_blank');
    this.ui.hideModal('export-modal');
  }

  _exportJson() {
    if (!this.currentRoom) return;
    window.open(`/api/export/room/${this.currentRoom.id}/annotations/json`, '_blank');
    this.ui.hideModal('export-modal');
  }

  _handlePeerData(data) {
  }

  _initPeerConnections() {
    const otherUsers = this.users.filter(u => u.sessionId !== this.currentUser.sessionId);

    otherUsers.forEach(user => {
      this.dataChannelManager.createPeerConnection(
        user.sessionId,
        (signalData) => {
          this.socketClient.sendSignal(user.sessionId, signalData);
        }
      );
    });
  }

  _onAnnotationDeleted(data) {
    this.annotations = this.annotations.filter(a => a.id !== data.annotationId);
    this.ui.updateAnnotationList(this.annotations);
    if (this.sceneManager) {
      this.sceneManager.removeAnnotationMarker(data.annotationId);
    }
  }

  _onVoiceMemoUpdated(data) {
    const idx = this.annotations.findIndex(a => a.id === data.annotationId);
    if (idx !== -1) {
      this.annotations[idx] = {
        ...this.annotations[idx],
        audio_url: data.audioUrl,
        audio_duration: data.audioDuration
      };
      this.ui.updateAnnotationList(this.annotations);
    }
  }

  _initTimeline() {
    if (!this.currentRoom) return;

    this.replayController = new ReplayController(this.sceneManager, this.apiClient);
    this.replayController.setRoom(this.currentRoom.id);

    this.replayController.onReplayModeChange((isReplay) => {
      this.isReplayMode = isReplay;
      const banner = document.getElementById('replay-banner');
      const timelineContainer = document.getElementById('timeline-container');

      if (isReplay) {
        banner.classList.remove('hidden');
        timelineContainer.classList.add('replay-mode');
      } else {
        banner.classList.add('hidden');
        timelineContainer.classList.remove('replay-mode');
      }
    });

    const toggleBtn = document.getElementById('toggle-timeline');
    toggleBtn.classList.remove('hidden');

    this.timelineControl = new TimelineControl(
      document.getElementById('timeline-container'),
      {
        onSeek: (seq, isPlaying) => this._handleTimelineSeek(seq, isPlaying),
        onPlay: () => this._handleTimelinePlay(),
        onPause: () => this._handleTimelinePause(),
        onFork: (seq) => this._handleFork(seq),
        onSpeedChange: (speed) => this._handleSpeedChange(speed)
      }
    );

    this._loadOperations();
  }

  async _loadOperations() {
    try {
      const data = await this.replayController.loadOperations();
      if (this.timelineControl) {
        this.timelineControl.setOperations(data.operations, data.maxSeq);
      }
    } catch (err) {
      console.error('Failed to load operations:', err);
    }
  }

  async _handleTimelineSeek(seq, isPlaying) {
    if (!this.replayController) return;

    if (!this.isReplayMode) {
      this.replayController.enterReplayMode();
    }

    try {
      const state = await this.replayController.seekTo(seq);
      this.replayController.applyStateToScene(state);

      const seqDisplay = document.getElementById('replay-seq');
      const maxSeqDisplay = document.getElementById('replay-max-seq');
      if (seqDisplay) seqDisplay.textContent = seq;
      if (maxSeqDisplay) maxSeqDisplay.textContent = this.replayController.maxSeq;
    } catch (err) {
      console.error('Seek failed:', err);
    }
  }

  _handleTimelinePlay() {
    if (!this.replayController) return;
    if (!this.isReplayMode) {
      this.replayController.enterReplayMode();
    }
  }

  _handleTimelinePause() {
  }

  async _handleFork(seq) {
    if (!this.replayController) return;

    try {
      const result = await this.replayController.forkAtCurrentSeq();
      if (result && result.forkedRoomId) {
        this.ui.showNotification(`Fork created! Room ID: ${result.forkedRoomId.substring(0, 8)}...`);
        const url = `${window.location.origin}?room=${result.forkedRoomId}`;
        window.prompt('Fork session URL (copy to share):', url);
      }
    } catch (err) {
      this.ui.showError('Failed to fork: ' + err.message);
    }
  }

  _handleSpeedChange(speed) {
  }

  _toggleTimeline() {
    this.timelineVisible = !this.timelineVisible;
    const container = document.getElementById('timeline-container');
    const toggleBtn = document.getElementById('toggle-timeline');

    if (this.timelineVisible) {
      container.classList.add('visible');
      toggleBtn.textContent = '✕ 隐藏时间轴';
    } else {
      container.classList.remove('visible');
      toggleBtn.textContent = '⏱ 时间轴';
    }
  }

  _exitReplayMode() {
    if (this.replayController) {
      this.replayController.exitReplayMode();
    }
    if (this.timelineControl) {
      this.timelineControl.pause();
      this.timelineControl.seekTo(this.timelineControl.maxSeq);
    }

    this.annotations.forEach(ann => {
      if (this.sceneManager) {
        this.sceneManager.addAnnotationMarker(ann);
      }
    });

    this.ui.updateAnnotationList(this.annotations);
  }

  _getRandomColor() {
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#FF5722', '#795548'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

const app = new App();
window.app = app;
