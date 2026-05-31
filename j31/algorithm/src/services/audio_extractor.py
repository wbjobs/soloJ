import os
import subprocess
import logging

logger = logging.getLogger(__name__)

class AudioExtractor:
    def __init__(self):
        pass
    
    def extract_audio(self, video_path: str, output_path: str, sample_rate: int = 16000) -> str:
        try:
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-vn',
                '-acodec', 'pcm_s16le',
                '-ar', str(sample_rate),
                '-ac', '1',
                '-y',
                output_path
            ]
            
            logger.info(f"Running FFmpeg command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if result.returncode != 0:
                logger.error(f"FFmpeg error: {result.stderr}")
                raise RuntimeError(f"FFmpeg extraction failed: {result.stderr}")
            
            if not os.path.exists(output_path):
                raise RuntimeError("Audio file was not created")
            
            file_size = os.path.getsize(output_path)
            logger.info(f"Audio extracted successfully, size: {file_size} bytes")
            
            return output_path
            
        except subprocess.TimeoutExpired:
            raise RuntimeError("Audio extraction timed out")
        except Exception as e:
            logger.error(f"Failed to extract audio: {str(e)}")
            raise
