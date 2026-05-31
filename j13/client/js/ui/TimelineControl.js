export class TimelineControl {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      onSeek: options.onSeek || (() => {}),
      onPlay: options.onPlay || (() => {}),
      onPause: options.onPause || (() => {}),
      onFork: options.onFork || (() => {}),
      onSpeedChange: options.onSpeedChange || (() => {}),
      ...options
    };

    this.isPlaying = false;
    this.currentSeq = 0;
    this.maxSeq = 0;
    this.playbackSpeed = 1;
    this.operations = [];
    this.opMarkers = [];
    this._playbackTimer = null;
    this._buildUI();
  }

  _buildUI() {
    this.container.innerHTML = `
      <div class="timeline-container">
        <div class="timeline-header">
          <div class="timeline-title">
            <span class="timeline-icon">⏱</span>
            <span>评审时间轴</span>
            <span class="timeline-seq" id="timeline-seq-display">Seq: 0 / 0</span>
          </div>
          <div class="timeline-controls">
            <button class="tl-btn" id="tl-play" title="播放/暂停">▶</button>
            <button class="tl-btn" id="tl-step-back" title="上一步">⏮</button>
            <button class="tl-btn" id="tl-step-fwd" title="下一步">⏭</button>
            <button class="tl-btn" id="tl-jump-start" title="跳至开头">⏪</button>
            <button class="tl-btn" id="tl-jump-end" title="跳至结尾">⏩</button>
            <select class="tl-speed" id="tl-speed" title="播放速度">
              <option value="0.5">0.5x</option>
              <option value="1" selected>1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
              <option value="8">8x</option>
            </select>
            <button class="tl-btn tl-fork-btn" id="tl-fork" title="从此处fork新会话">🍴 Fork</button>
          </div>
        </div>
        <div class="timeline-track-wrapper" id="tl-track-wrapper">
          <div class="timeline-track" id="tl-track">
            <div class="timeline-marker-layer" id="tl-marker-layer"></div>
            <div class="timeline-playhead" id="tl-playhead"></div>
            <div class="timeline-progress" id="tl-progress"></div>
          </div>
          <div class="timeline-ruler" id="tl-ruler"></div>
        </div>
        <div class="timeline-footer">
          <div class="timeline-legend">
            <span class="legend-item"><span class="legend-dot" style="background:#4CAF50"></span>标注</span>
            <span class="legend-item"><span class="legend-dot" style="background:#2196F3"></span>视角</span>
            <span class="legend-item"><span class="legend-dot" style="background:#FF9800"></span>语音</span>
            <span class="legend-item"><span class="legend-dot" style="background:#9C27B0"></span>锁定</span>
            <span class="legend-item"><span class="legend-dot" style="background:#607D8B"></span>用户</span>
          </div>
          <div class="timeline-current-op" id="tl-current-op">--</div>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const track = this.container.querySelector('#tl-track');
    const playBtn = this.container.querySelector('#tl-play');
    const stepBack = this.container.querySelector('#tl-step-back');
    const stepFwd = this.container.querySelector('#tl-step-fwd');
    const jumpStart = this.container.querySelector('#tl-jump-start');
    const jumpEnd = this.container.querySelector('#tl-jump-end');
    const speedSel = this.container.querySelector('#tl-speed');
    const forkBtn = this.container.querySelector('#tl-fork');

    track.addEventListener('click', (e) => this._onTrackClick(e));
    track.addEventListener('mousedown', (e) => this._onDragStart(e));

    playBtn.addEventListener('click', () => this.togglePlay());
    stepBack.addEventListener('click', () => this.step(-1));
    stepFwd.addEventListener('click', () => this.step(1));
    jumpStart.addEventListener('click', () => this.seekTo(0));
    jumpEnd.addEventListener('click', () => this.seekTo(this.maxSeq));
    speedSel.addEventListener('change', (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
      this.options.onSpeedChange(this.playbackSpeed);
      if (this.isPlaying) {
        this._stopPlayback();
        this._startPlayback();
      }
    });
    forkBtn.addEventListener('click', () => this.options.onFork(this.currentSeq));
  }

  _onTrackClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const seq = Math.round(pct * this.maxSeq);
    this.seekTo(Math.max(0, Math.min(this.maxSeq, seq)));
  }

  _onDragStart(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    const track = this.container.querySelector('#tl-track');

    const onMove = (ev) => {
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const seq = Math.round(pct * this.maxSeq);
      this.seekTo(seq, true);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  setOperations(ops, maxSeq) {
    this.operations = ops || [];
    this.maxSeq = maxSeq || (ops && ops.length > 0 ? ops[ops.length - 1].seq : 0);
    this._renderMarkers();
    this._renderRuler();
    this._updatePlayhead();
    this._updateSeqDisplay();
  }

  _renderMarkers() {
    const layer = this.container.querySelector('#tl-marker-layer');
    if (!layer) return;
    layer.innerHTML = '';

    const colors = {
      annotation_add: '#4CAF50',
      annotation_delete: '#f44336',
      annotation_resolve: '#8BC34A',
      camera_move: '#2196F3',
      voice_start: '#FF9800',
      voice_stop: '#FFC107',
      view_lock: '#9C27B0',
      view_unlock: '#E91E63',
      user_join: '#607D8B',
      user_leave: '#795548',
      model_transform: '#00BCD4'
    };

    this.opMarkers = this.operations.map(op => {
      const pct = this.maxSeq > 0 ? (op.seq / this.maxSeq) * 100 : 0;
      const marker = document.createElement('div');
      marker.className = 'tl-op-marker';
      marker.style.left = `${pct}%`;
      marker.style.background = colors[op.op_type] || '#999';
      marker.title = `#${op.seq} ${op.op_type}${op.payload && op.payload.user_name ? ' - ' + op.payload.user_name : ''}`;
      marker.dataset.seq = op.seq;
      layer.appendChild(marker);
      return { el: marker, op };
    });
  }

  _renderRuler() {
    const ruler = this.container.querySelector('#tl-ruler');
    if (!ruler) return;
    ruler.innerHTML = '';

    const steps = Math.min(10, Math.max(2, Math.floor(this.maxSeq / 10)));
    const interval = Math.max(1, Math.floor(this.maxSeq / steps));

    for (let i = 0; i <= steps; i++) {
      const seq = Math.min(i * interval, this.maxSeq);
      const pct = this.maxSeq > 0 ? (seq / this.maxSeq) * 100 : 0;
      const tick = document.createElement('div');
      tick.className = 'tl-ruler-tick';
      tick.style.left = `${pct}%`;
      tick.innerHTML = `<span class="tl-ruler-label">${seq}</span>`;
      ruler.appendChild(tick);
    }
  }

  seekTo(seq, silent = false) {
    this.currentSeq = Math.max(0, Math.min(this.maxSeq, seq));
    this._updatePlayhead();
    this._updateSeqDisplay();
    this._updateCurrentOpDisplay();
    if (!silent) {
      this.options.onSeek(this.currentSeq);
    }
  }

  _updatePlayhead() {
    const playhead = this.container.querySelector('#tl-playhead');
    const progress = this.container.querySelector('#tl-progress');
    const pct = this.maxSeq > 0 ? (this.currentSeq / this.maxSeq) * 100 : 0;
    if (playhead) playhead.style.left = `${pct}%`;
    if (progress) progress.style.width = `${pct}%`;
  }

  _updateSeqDisplay() {
    const display = this.container.querySelector('#timeline-seq-display');
    if (display) display.textContent = `Seq: ${this.currentSeq} / ${this.maxSeq}`;
  }

  _updateCurrentOpDisplay() {
    const display = this.container.querySelector('#tl-current-op');
    if (!display) return;

    const currentOp = this.operations.find(op => op.seq === this.currentSeq);
    if (currentOp) {
      const payload = currentOp.payload || {};
      let desc = `${currentOp.op_type}`;
      if (payload.user_name) desc += ` by ${payload.user_name}`;
      if (payload.text_content) desc += ` "${payload.text_content.substring(0, 30)}"`;
      if (payload.annotation_id) desc += ` [${payload.annotation_id.substring(0, 8)}]`;
      display.textContent = `#${currentOp.seq} ${desc}`;
    } else {
      display.textContent = `--`;
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.currentSeq >= this.maxSeq) {
      this.currentSeq = 0;
      this._updatePlayhead();
      this._updateSeqDisplay();
    }
    this.isPlaying = true;
    const playBtn = this.container.querySelector('#tl-play');
    if (playBtn) playBtn.textContent = '⏸';
    this.options.onPlay();
    this._startPlayback();
  }

  pause() {
    this.isPlaying = false;
    const playBtn = this.container.querySelector('#tl-play');
    if (playBtn) playBtn.textContent = '▶';
    this.options.onPause();
    this._stopPlayback();
  }

  _startPlayback() {
    this._stopPlayback();
    const interval = Math.max(50, 500 / this.playbackSpeed);
    this._playbackTimer = setInterval(() => {
      if (!this.isPlaying) return;
      if (this.currentSeq >= this.maxSeq) {
        this.pause();
        return;
      }
      this.currentSeq++;
      this._updatePlayhead();
      this._updateSeqDisplay();
      this._updateCurrentOpDisplay();
      this.options.onSeek(this.currentSeq, true);
    }, interval);
  }

  _stopPlayback() {
    if (this._playbackTimer) {
      clearInterval(this._playbackTimer);
      this._playbackTimer = null;
    }
  }

  step(delta) {
    this.seekTo(this.currentSeq + delta);
  }

  jumpToEnd() {
    this.seekTo(this.maxSeq);
  }

  jumpToStart() {
    this.seekTo(0);
  }

  setMaxSeq(maxSeq) {
    this.maxSeq = maxSeq;
    this._renderRuler();
    this._updatePlayhead();
    this._updateSeqDisplay();
  }

  destroy() {
    this._stopPlayback();
    this.container.innerHTML = '';
  }
}