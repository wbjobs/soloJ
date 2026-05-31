import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  async load(): Promise<void> {
    if (this.isLoaded) return;

    this.ffmpeg = new FFmpeg();
    
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
    });

    this.ffmpeg.on('progress', ({ progress }) => {
      console.log('[FFmpeg] Progress:', progress);
    });

    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    this.isLoaded = true;
  }

  async sliceVideo(
    file: File,
    chunkDuration: number = 60,
    onProgress?: (progress: number) => void
  ): Promise<Blob[]> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.load();
    }

    const ffmpeg = this.ffmpeg!;
    const chunks: Blob[] = [];

    try {
      const inputFileName = 'input' + this.getFileExtension(file.name);
      await ffmpeg.writeFile(inputFileName, await fetchFile(file));

      const duration = await this.getVideoDuration(file);
      const numChunks = Math.ceil(duration / chunkDuration);

      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const outputFileName = `chunk_${i}.mp4`;

        await ffmpeg.exec([
          '-i', inputFileName,
          '-ss', startTime.toString(),
          '-t', chunkDuration.toString(),
          '-c', 'copy',
          '-f', 'mp4',
          '-y',
          outputFileName,
        ]);

        const data = await ffmpeg.readFile(outputFileName);
        const blob = new Blob([data], { type: 'video/mp4' });
        chunks.push(blob);

        await ffmpeg.deleteFile(outputFileName);

        if (onProgress) {
          onProgress(Math.round(((i + 1) / numChunks) * 100));
        }
      }

      await ffmpeg.deleteFile(inputFileName);

      return chunks;
    } catch (error) {
      console.error('Video slicing failed:', error);
      throw error;
    }
  }

  private async getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };

      video.onerror = () => {
        window.URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video metadata'));
      };

      video.src = URL.createObjectURL(file);
    });
  }

  async extractAudio(videoFile: File): Promise<Blob> {
    if (!this.ffmpeg || !this.isLoaded) {
      await this.load();
    }

    const ffmpeg = this.ffmpeg!;
    const inputFileName = 'input' + this.getFileExtension(videoFile.name);
    const outputFileName = 'output.wav';

    try {
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile));

      await ffmpeg.exec([
        '-i', inputFileName,
        '-vn',
        '-acodec', 'pcm_s16le',
        '-ar', '16000',
        '-ac', '1',
        '-y',
        outputFileName,
      ]);

      const data = await ffmpeg.readFile(outputFileName);
      const blob = new Blob([data], { type: 'audio/wav' });

      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);

      return blob;
    } catch (error) {
      console.error('Audio extraction failed:', error);
      throw error;
    }
  }

  private getFileExtension(filename: string): string {
    const match = filename.match(/\.[^.]+$/);
    return match ? match[0] : '.mp4';
  }

  unload(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.isLoaded = false;
    }
  }
}

export default new FFmpegService();
