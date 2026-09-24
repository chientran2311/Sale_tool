# Web Audio & WaveSurfer Production Hooks

> Các Custom Hooks xử lý sóng âm thanh và thu âm microphone chuẩn sản xuất.

## 1. Production `useWaveSurfer` Hook

Quản lý vòng đời WaveSurfer.js, hỗ trợ seek mốc thời gian, tự giải phóng RAM khi component unmount:

```typescript
import { useEffect, useRef, useState, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";

interface UseWaveSurferProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  audioUrl?: string | null;
  onTimeUpdate?: (time: number) => void;
  onFinish?: () => void;
}

export function useWaveSurfer({ containerRef, audioUrl, onTimeUpdate, onFinish }: UseWaveSurferProps) {
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#6366f1",
      progressColor: "#a855f7",
      cursorColor: "#f43f5e",
      cursorWidth: 2,
      height: 72,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      url: audioUrl,
    });

    wsRef.current = ws;

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (time) => {
      setCurrentTime(time);
      onTimeUpdate?.(time);
    });
    ws.on("finish", () => {
      setIsPlaying(false);
      onFinish?.();
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      setIsReady(false);
      setIsPlaying(false);
    };
  }, [audioUrl, containerRef]);

  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);
  const seekTo = useCallback((time: number) => {
    if (wsRef.current && isReady) wsRef.current.setTime(time);
  }, [isReady]);
  const setPlaybackRate = useCallback((rate: number) => wsRef.current?.setPlaybackRate(rate), []);

  return { isPlaying, currentTime, duration, isReady, togglePlay, seekTo, setPlaybackRate };
}
```

## 2. Production `useAudioRecorder` Hook

Xử lý thu âm microphone, đếm giây thời gian thực, xuất file Blob/WAV và tắt microphone phần cứng ngay khi dừng:

```typescript
import { useState, useRef, useCallback } from "react";

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Tắt microphone phần cứng
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Lỗi truy cập Microphone:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [isRecording]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
  }, [audioUrl]);

  return { isRecording, recordingTime, audioBlob, audioUrl, startRecording, stopRecording, clearRecording };
}
```
