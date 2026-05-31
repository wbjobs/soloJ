export class RecorderService {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.stream = null;
    this.startTime = null;
    this.isRecording = false;
  }

  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];
      this.startTime = Date.now();
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      return true;
    } catch (err) {
      console.error('Error starting recording:', err);
      throw new Error('Microphone access denied or not available');
    }
  }

  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('No recording in progress'));
        return;
      }

      const duration = (Date.now() - this.startTime) / 1000;

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.isRecording = false;
        this._cleanup();
        resolve({ blob, duration });
      };

      this.mediaRecorder.onerror = (err) => {
        this.isRecording = false;
        this._cleanup();
        reject(err);
      };

      this.mediaRecorder.stop();
    });
  }

  cancelRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this._cleanup();
      };
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }

  getElapsedTime() {
    if (!this.startTime || !this.isRecording) return '00:00';
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  _cleanup() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.audioChunks = [];
    this.mediaRecorder = null;
    this.startTime = null;
  }

  isRecordingActive() {
    return this.isRecording;
  }
}
