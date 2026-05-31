import re
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class SRTService:
    def __init__(self):
        self.time_pattern = re.compile(
            r'(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})'
        )
    
    def parse_srt(self, srt_path: str) -> List[Dict]:
        try:
            with open(srt_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            return self._parse_content(content)
        except UnicodeDecodeError:
            with open(srt_path, 'r', encoding='gbk') as f:
                content = f.read()
            return self._parse_content(content)
        except Exception as e:
            logger.error(f"Failed to parse SRT: {str(e)}")
            raise
    
    def _parse_content(self, content: str) -> List[Dict]:
        blocks = re.split(r'\n\s*\n', content.strip())
        segments = []
        
        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue
            
            try:
                index = int(lines[0])
                time_line = lines[1]
                text = '\n'.join(lines[2:])
                
                time_match = self.time_pattern.match(time_line)
                if time_match:
                    start = self._time_to_seconds(*time_match.groups()[:4])
                    end = self._time_to_seconds(*time_match.groups()[4:])
                    
                    segments.append({
                        'index': index,
                        'start': start,
                        'end': end,
                        'text': text.strip()
                    })
            except (ValueError, IndexError) as e:
                logger.warning(f"Skipping invalid block: {block[:50]}...")
                continue
        
        return segments
    
    def _time_to_seconds(self, hours: str, minutes: str, seconds: str, milliseconds: str) -> float:
        return (
            int(hours) * 3600 +
            int(minutes) * 60 +
            int(seconds) +
            int(milliseconds) / 1000
        )
    
    def _seconds_to_time(self, seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    def write_srt(self, segments: List[Dict], output_path: str) -> None:
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                for i, seg in enumerate(segments, 1):
                    start_time = self._seconds_to_time(seg['start'])
                    end_time = self._seconds_to_time(seg['end'])
                    
                    f.write(f"{i}\n")
                    f.write(f"{start_time} --> {end_time}\n")
                    f.write(f"{seg['text']}\n\n")
            
            logger.info(f"SRT written to {output_path}")
        except Exception as e:
            logger.error(f"Failed to write SRT: {str(e)}")
            raise
    
    def format_srt(self, segments: List[Dict]) -> str:
        lines = []
        for i, seg in enumerate(segments, 1):
            start_time = self._seconds_to_time(seg['start'])
            end_time = self._seconds_to_time(seg['end'])
            
            lines.append(str(i))
            lines.append(f"{start_time} --> {end_time}")
            lines.append(seg['text'])
            lines.append('')
        
        return '\n'.join(lines)
