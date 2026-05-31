import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SessionClient } from '../services/SessionClient.js';

export class ReplayController {
  constructor(sceneManager, apiClient) {
    this.sceneManager = sceneManager;
    this.sessionClient = new SessionClient();
    this.apiClient = apiClient;

    this.roomId = null;
    this.branch = 'main';
    this.operations = [];
    this.currentSeq = 0;
    this.maxSeq = 0;
    this.state = this._createInitialState();
    this.isReplayMode = false;
    this.liveAnnotations = [];

    this._onStateChange = null;
    this._onForkComplete = null;
    this._onReplayModeChange = null;
  }

  _createInitialState() {
    return {
      camera: null,
      annotations: [],
      modelTransform: null,
      lockedView: null,
      users: [],
      seq: 0
    };
  }

  setRoom(roomId) {
    this.roomId = roomId;
  }

  async loadOperations(fromSeq = 0, toSeq = null) {
    if (!this.roomId) return;

    const data = await this.sessionClient.getOperations(this.roomId, {
      fromSeq,
      toSeq,
      branch: this.branch,
      limit: 10000
    });

    this.operations = data.operations || [];
    this.maxSeq = data.currentSeq || 0;

    return { operations: this.operations, maxSeq: this.maxSeq };
  }

  async seekTo(targetSeq) {
    if (!this.roomId) return;

    const nearestSnapshot = await this.sessionClient.getLatestSnapshot(this.roomId, targetSeq, this.branch);

    let state;
    let startSeq;

    if (nearestSnapshot && nearestSnapshot.state) {
      state = JSON.parse(JSON.stringify(nearestSnapshot.state));
      startSeq = nearestSnapshot.up_to_seq + 1;
    } else {
      state = this._createInitialState();
      startSeq = 1;
    }

    const ops = this.operations.filter(op => op.seq >= startSeq && op.seq <= targetSeq);
    for (const op of ops) {
      this._applyOperation(state, op);
    }

    this.state = state;
    this.currentSeq = targetSeq;

    return state;
  }

  _applyOperation(state, op) {
    state.seq = op.seq;

    switch (op.op_type) {
      case 'camera_move':
        state.camera = op.payload.camera;
        break;

      case 'annotation_add': {
        const existing = state.annotations.find(a => a.id === op.payload.annotation_id);
        if (!existing) {
          state.annotations.push({
            id: op.payload.annotation_id,
            ...op.payload
          });
        }
        break;
      }

      case 'annotation_delete': {
        state.annotations = state.annotations.filter(a => a.id !== op.payload.annotation_id);
        break;
      }

      case 'annotation_resolve': {
        const ann = state.annotations.find(a => a.id === op.payload.annotation_id);
        if (ann) {
          ann.resolved = op.payload.resolved;
          ann.resolved_at = op.payload.resolved_at || null;
        }
        break;
      }

      case 'voice_stop': {
        const ann = state.annotations.find(a => a.id === op.payload.annotation_id);
        if (ann) {
          ann.audio_url = op.payload.audio_url;
          ann.audio_duration = op.payload.audio_duration;
        }
        break;
      }

      case 'model_transform':
        state.modelTransform = op.payload.transform;
        break;

      case 'view_lock':
        state.lockedView = {
          view: op.payload.view,
          lockedBy: op.payload.locked_by
        };
        break;

      case 'view_unlock':
        state.lockedView = null;
        break;

      case 'user_join': {
        const existing = state.users.find(u => u.id === op.payload.user_id);
        if (!existing) {
          state.users.push({
            id: op.payload.user_id,
            session_id: op.payload.session_id,
            name: op.payload.name,
            color: op.payload.color,
            role: op.payload.role,
            joined_at: op.payload.joined_at
          });
        }
        break;
      }

      case 'user_leave':
        state.users = state.users.filter(u => u.id !== op.payload.user_id);
        break;
    }
  }

  applyStateToScene(state) {
    if (!this.sceneManager) return;

    if (state.camera) {
      this.sceneManager.setCameraView(state.camera);
    }

    if (state.modelTransform) {
      this.sceneManager.applyModelTransform(state.modelTransform);
    }

    if (this.sceneManager.annotationMarkers) {
      this.sceneManager.annotationMarkers.forEach((_, id) => {
        this.sceneManager.removeAnnotationMarker(id);
      });
    }

    state.annotations.forEach(ann => {
      const annotationForScene = this._convertToSceneAnnotation(ann);
      if (annotationForScene) {
        this.sceneManager.addAnnotationMarker(annotationForScene);
      }
    });
  }

  _convertToSceneAnnotation(ann) {
    const localPos = ann.local_position || ann.position;
    const worldPos = ann.position;

    if (!localPos && !worldPos) return null;

    return {
      id: ann.id || ann.annotation_id,
      local_position_x: localPos ? localPos.x : undefined,
      local_position_y: localPos ? localPos.y : undefined,
      local_position_z: localPos ? localPos.z : undefined,
      position_x: worldPos ? worldPos.x : undefined,
      position_y: worldPos ? worldPos.y : undefined,
      position_z: worldPos ? worldPos.z : undefined,
      user_color: ann.user_color || '#4CAF50',
      user_name: ann.user_name || '',
      text_content: ann.text_content || '',
      audio_url: ann.audio_url || null,
      audio_duration: ann.audio_duration || 0,
      resolved: ann.resolved || false,
      created_at: ann.created_at || null
    };
  }

  enterReplayMode() {
    this.isReplayMode = true;
    this.liveAnnotations = [...(this.sceneManager.annotationMarkers || [])];

    if (this._onReplayModeChange) {
      this._onReplayModeChange(true);
    }
  }

  exitReplayMode() {
    this.isReplayMode = false;
    this.state = this._createInitialState();
    this.currentSeq = 0;

    if (this._onReplayModeChange) {
      this._onReplayModeChange(false);
    }
  }

  async forkAtCurrentSeq(newRoomName) {
    if (!this.roomId) return null;

    const result = await this.sessionClient.forkSession(this.roomId, {
      sourceSeq: this.currentSeq,
      sourceBranch: this.branch,
      newRoomName: newRoomName || `Fork from #${this.currentSeq}`,
      forkedByUserId: null
    });

    if (this._onForkComplete) {
      this._onForkComplete(result);
    }

    return result;
  }

  onStateChange(callback) {
    this._onStateChange = callback;
  }

  onForkComplete(callback) {
    this._onForkComplete = callback;
  }

  onReplayModeChange(callback) {
    this._onReplayModeChange = callback;
  }

  getOperationSummary() {
    if (!this.operations.length) return {};

    const counts = {};
    this.operations.forEach(op => {
      counts[op.op_type] = (counts[op.op_type] || 0) + 1;
    });

    return {
      total: this.operations.length,
      byType: counts,
      firstTimestamp: this.operations[0]?.timestamp,
      lastTimestamp: this.operations[this.operations.length - 1]?.timestamp,
      maxSeq: this.maxSeq
    };
  }
}