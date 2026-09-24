import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseWaveSurferProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  audioUrl?: string | null;
  fileSizeBytes?: number;
  onTimeUpdate?: (time: number) => void;
  onFinish?: () => void;
}

// Ngưỡng dung lượng tối đa 15MB để dựng WaveSurfer chi tiết.
// Tệp > 15MB sẽ tự động chuyển sang chế độ Native Player để bảo vệ RAM trình duyệt không bị crash (OOM).
export const MAX_WAVEFORM_BYTES = 15 * 1024 * 1024;

export function useWaveSurfer({ containerRef, audioUrl, fileSizeBytes = 0, onTimeUpdate, onFinish }: UseWaveSurferProps) {
  const wsRef = useRef<WaveSurfer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const isLargeAudio = fileSizeBytes > MAX_WAVEFORM_BYTES;

  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onFinishRef.current = onFinish;
  });

  useEffect(() => {
    if (!containerRef.current || !audioUrl) {
      setIsReady(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    // Tạo HTMLAudioElement để phát trực tiếp mượt mà, hỗ trợ cả tệp lớn và WebM
    const audio = new Audio();
    audio.src = audioUrl;
    audio.preload = "auto";
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsReady(true);
      }
    };

    const handleCanPlay = () => {
      setIsReady(true);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdateRef.current?.(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onFinishRef.current?.();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    // Khởi tạo WaveSurfer gắn với HTMLAudioElement media (Chỉ chạy cho tệp <= 15MB để tránh tràn RAM trình duyệt)
    let ws: WaveSurfer | null = null;
    if (!isLargeAudio) {
      try {
        ws = WaveSurfer.create({
          container: containerRef.current,
          media: audio,
          waveColor: "rgba(255, 255, 255, 0.22)",
          progressColor: "#266DF0",
          cursorColor: "#9B69FF",
          cursorWidth: 2,
          height: 72,
          barWidth: 3,
          barGap: 2,
          barRadius: 3,
        });

        ws.on("ready", () => {
          setIsReady(true);
          const d = ws?.getDuration();
          if (d && !isNaN(d) && isFinite(d) && d > 0) {
            setDuration(d);
          }
        });

        ws.on("error", (err) => {
          console.warn("WaveSurfer render warning:", err);
          // Ngay cả khi vẽ sóng âm lỗi, audio vẫn phát được bình thường qua HTML5 Audio
          setIsReady(true);
        });

        wsRef.current = ws;
      } catch (e) {
        console.warn("WaveSurfer init error:", e);
        setIsReady(true);
      }
    } else {
      // Với tệp lớn: Đánh dấu sẵn sàng phát tức thì qua HTMLAudioElement, tránh Web Audio decode
      setIsReady(true);
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.pause();
      audio.src = "";
      audioRef.current = null;

      if (ws) {
        ws.destroy();
      }
      wsRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [audioUrl, containerRef, isLargeAudio]);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch((err) => console.warn("Playback error:", err));
      } else {
        audioRef.current.pause();
      }
    } else if (wsRef.current) {
      wsRef.current.playPause();
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    } else if (wsRef.current) {
      wsRef.current.setTime(time);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    if (wsRef.current) {
      wsRef.current.setPlaybackRate(rate);
    }
  }, []);

  return { isPlaying, currentTime, duration, isReady, isLargeAudio, togglePlay, seekTo, setPlaybackRate };
}
