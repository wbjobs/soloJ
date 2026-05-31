import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

const VideoPlayer = forwardRef(({ src, onPlay, onPause, onSeek, onTimeUpdate, onReady, onVideoDimensionsChange }, ref) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    currentTime: (time) => {
      if (time !== undefined) {
        playerRef.current?.currentTime(time);
      }
      return playerRef.current?.currentTime();
    },
    getPlayer: () => playerRef.current,
    getVideoElement: () => videoRef.current,
  }));

  useEffect(() => {
    if (!videoRef.current) return;

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        onVideoDimensionsChange?.({
          videoWidth: videoRef.current.videoWidth,
          videoHeight: videoRef.current.videoHeight,
        });
      }
    };

    videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [src, onVideoDimensionsChange]);

  useEffect(() => {
    if (!videoRef.current) return;

    const player = videojs(videoRef.current, {
      sources: [{ src, type: 'video/mp4' }],
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: false,
      aspectRatio: '16:9',
    });

    playerRef.current = player;

    player.on('play', () => {
      onPlay?.(player.currentTime());
    });

    player.on('pause', () => {
      onPause?.(player.currentTime());
    });

    player.on('seeked', () => {
      onSeek?.(player.currentTime());
    });

    player.on('timeupdate', () => {
      onTimeUpdate?.(player.currentTime());
    });

    player.ready(() => {
      onReady?.(player);
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div data-vjs-player>
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
