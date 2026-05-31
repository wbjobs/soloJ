export class UI {
  constructor() {
    this.loginScreen = document.getElementById('login-screen');
    this.reviewScreen = document.getElementById('review-screen');
    this.loadingOverlay = null;
    this._listeners = {};
  }

  showReviewScreen() {
    this.loginScreen.classList.remove('active');
    this.reviewScreen.classList.add('active');
  }

  showLoginScreen() {
    this.reviewScreen.classList.remove('active');
    this.loginScreen.classList.add('active');
  }

  showLoading() {
    if (this.loadingOverlay) return;

    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'loading-overlay';
    this.loadingOverlay.innerHTML = `
      <div style="text-align:center;">
        <div class="loading-spinner"></div>
        <div class="loading-text">Connecting...</div>
      </div>
    `;
    this.reviewScreen.appendChild(this.loadingOverlay);
  }

  hideLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }
  }

  showError(message) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
      errorEl.textContent = message;
      setTimeout(() => {
        errorEl.textContent = '';
      }, 5000);
    }
  }

  updateRoomInfo(room) {
    document.getElementById('currentRoomName').textContent = room.name;
    document.getElementById('currentRoomId').textContent = `#${room.id.substring(0, 8)}`;
  }

  updateUserBadge(user) {
    const badge = document.getElementById('currentUserBadge');
    badge.textContent = user.name;
    badge.style.background = `${user.color}33`;
    badge.style.borderColor = `${user.color}66`;
  }

  updateUserList(users) {
    const container = document.getElementById('userList');
    container.innerHTML = '';

    users.forEach(user => {
      const item = document.createElement('div');
      item.className = 'user-item';

      const initial = (user.name || '?').charAt(0).toUpperCase();

      item.innerHTML = `
        <div class="user-avatar" style="background: ${user.color || '#4CAF50'}">${initial}</div>
        <div class="user-info">
          <div class="user-name">${user.name || 'Unknown'}</div>
          <div class="user-role ${user.role === 'host' ? 'host' : ''}">${user.role || 'viewer'}</div>
        </div>
      `;

      container.appendChild(item);
    });
  }

  updateAnnotationList(annotations) {
    const container = document.getElementById('annotationList');
    container.innerHTML = '';

    if (annotations.length === 0) {
      container.innerHTML = '<p style="color:#666; font-size:13px; text-align:center; padding:20px;">No annotations yet</p>';
      return;
    }

    annotations.forEach(annotation => {
      const item = document.createElement('div');
      item.className = `annotation-item ${annotation.resolved ? 'resolved' : ''}`;
      item.dataset.annotationId = annotation.id;

      const time = new Date(annotation.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });

      let audioHtml = '';
      if (annotation.audio_url) {
        audioHtml = `
          <div class="annotation-audio">
            <audio controls src="${annotation.audio_url}"></audio>
          </div>
        `;
      }

      const textContent = annotation.text_content && annotation.text_content.trim()
        ? `<div class="annotation-text">${this._escapeHtml(annotation.text_content)}</div>`
        : '';

      const resolveBtn = !annotation.resolved
        ? `<button class="resolve-btn" data-action="resolve" data-id="${annotation.id}">Resolve</button>`
        : '';

      item.innerHTML = `
        <div class="annotation-header">
          <span class="annotation-author" style="color: ${annotation.user_color || '#888'}">
            ${annotation.user_name || 'Unknown'}
          </span>
          <span class="annotation-time">${time}</span>
        </div>
        ${textContent}
        ${audioHtml}
        <div class="annotation-actions">
          ${resolveBtn}
        </div>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'resolve') {
          e.stopPropagation();
          this._emit('resolve-annotation', annotation.id);
          return;
        }

        document.querySelectorAll('.annotation-item').forEach(el => {
          el.classList.remove('selected');
        });
        item.classList.add('selected');
        this._emit('annotation-select', annotation);
      });

      container.appendChild(item);
    });
  }

  showViewLocked(lockedBy) {
    const banner = document.getElementById('view-locked-banner');
    const lockedByEl = document.getElementById('lockedBy');
    if (lockedByEl) {
      lockedByEl.textContent = lockedBy.name || 'Host';
    }
    banner.classList.remove('hidden');
  }

  hideViewLocked() {
    document.getElementById('view-locked-banner').classList.add('hidden');
  }

  updateLockButtons(isLocked) {
    const lockBtn = document.getElementById('lockViewBtn');
    const unlockBtn = document.getElementById('unlockViewBtn');

    if (isLocked) {
      lockBtn.classList.add('hidden');
      unlockBtn.classList.remove('hidden');
    } else {
      lockBtn.classList.remove('hidden');
      unlockBtn.classList.add('hidden');
    }
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }

  showRecordingPanel() {
    document.getElementById('recordingPanel').classList.remove('hidden');
  }

  hideRecordingPanel() {
    document.getElementById('recordingPanel').classList.add('hidden');
  }

  updateRecordingTime(timeStr) {
    document.getElementById('recordingTime').textContent = timeStr;
  }

  setPlacingMode(isPlacing) {
    const canvas = document.getElementById('three-canvas');
    if (isPlacing) {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(26, 26, 46, 0.95);
      color: white;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px;
      z-index: 2000;
      border: 1px solid rgba(255, 255, 255, 0.1);
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  on(event, callback) {
    if (!this._listeners) this._listeners = {};
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  }

  _emit(event, data) {
    if (this._listeners && this._listeners[event]) {
      this._listeners[event].forEach(cb => cb(data));
    }
  }
}
