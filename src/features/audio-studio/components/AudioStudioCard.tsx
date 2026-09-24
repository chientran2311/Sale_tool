import React, { useState, useRef, useEffect } from "react";
import { Card, Button, Badge, Switch, Progress } from "@/components/ui";
import {
  Zap,
  Cpu,
  Mic,
  UploadCloud,
  FileAudio,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  FastForward,
  Sparkles,
  RefreshCw,
  Square,
  Volume2,
  Terminal,
  Clock,
} from "lucide-react";
import { useAudioRecorder } from "@/features/audio-record/hooks/useAudioRecorder";
import { useWaveSurfer } from "@/features/waveform/hooks/useWaveSurfer";
import type { LogEntry } from "@/features/transcription";
import { formatDuration } from "@/utils/formatDuration";

export interface AudioStudioCardProps {
  selectedFile: File | null;
  activeAudioUrl: string | null;
  onFileSelect: (file: File | null) => void;
  onAudioReady: (blob: Blob, filename: string) => void;
  onClearAudio: () => void;
  // Controls
  enableDenoise: boolean;
  onDenoiseChange: (val: boolean) => void;
  segmentEnable: boolean;
  onSegmentChange: (val: boolean) => void;
  modelType?: "phowhisper" | "zipformer";
  onModelTypeChange?: (val: "phowhisper" | "zipformer") => void;
  // Transcription action
  onTranscribe: () => void;
  isTranscribing: boolean;
  progress: number;
  statusMessage?: string;
  logs?: LogEntry[];
  elapsedTime?: number;
  error?: string | null;
  // Time sync
  onTimeUpdate?: (time: number) => void;
  seekTime?: number | null;
}

export function AudioStudioCard({
  selectedFile,
  activeAudioUrl,
  onFileSelect,
  onAudioReady,
  onClearAudio,
  enableDenoise,
  onDenoiseChange,
  segmentEnable,
  onSegmentChange,
  modelType = "zipformer",
  onModelTypeChange,
  onTranscribe,
  isTranscribing,
  progress,
  statusMessage,
  logs = [],
  elapsedTime = 0,
  error,
  onTimeUpdate,
  seekTime,
}: AudioStudioCardProps) {
  // Mode selection when no audio is present: "mic" | "upload"
  const [activeTab, setActiveTab] = useState<"mic" | "upload">("mic");
  const [isDragOver, setIsDragOver] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Tự động cuộn xuống dưới cùng khi có log mới
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Live Microphone Hook with direct completion callback
  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    clearRecording,
  } = useAudioRecorder(onAudioReady);

  // WaveSurfer Audio Player Hook (kèm cơ chế bảo vệ RAM cho tệp lớn)
  const {
    isPlaying,
    currentTime,
    duration,
    isLargeAudio,
    togglePlay,
    seekTo,
    setPlaybackRate,
  } = useWaveSurfer({
    containerRef,
    audioUrl: activeAudioUrl,
    fileSizeBytes: selectedFile?.size || 0,
  });

  // Report time updates up to parent for segment sync
  useEffect(() => {
    onTimeUpdate?.(currentTime);
  }, [currentTime, onTimeUpdate]);

  // Handle external seek requests (e.g. user clicks a segment)
  useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && duration > 0) {
      seekTo(seekTime);
    }
  }, [seekTime, duration, seekTo]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isTranscribing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isTranscribing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isAudio =
        file.type.startsWith("audio/") ||
        file.type === "video/mp4" ||
        file.type === "video/webm" ||
        /\.(mp3|wav|m4a|aac|ogg|webm|flac|wma)$/i.test(file.name);
      if (isAudio) {
        onFileSelect(file);
      }
    }
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleReset = () => {
    if (isRecording) {
      stopRecording();
    }
    clearRecording();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClearAudio();
  };

  const handleSkip = (seconds: number) => {
    if (duration > 0) {
      const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
      seekTo(newTime);
    }
  };

  const handleRateChange = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRateState(nextRate);
    setPlaybackRate(nextRate);
  };

  return (
    <Card className="flex flex-col gap-5 border border-white/[0.08] bg-[#12141A]/90 p-5 rounded-[14px]">
      {/* CARD HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-[#266DF0]" />
          <h2 className="text-sm font-semibold text-[#F3F4F6] tracking-wide">
            Studio Thu &amp; Phát Âm Thanh
          </h2>
        </div>
        {activeAudioUrl && (
          <Badge variant="mint" className="text-[11px] px-2 py-0.5">
            Sẵn sàng xử lý
          </Badge>
        )}
      </div>

      {/* STATE 1: NO AUDIO LOADED YET -> TABS (RECORD LIVE OR UPLOAD FILE) */}
      {!activeAudioUrl && (
        <div className="flex flex-col gap-4">
          {/* Tab Switcher */}
          <div className="grid grid-cols-2 p-1 bg-[#090A0D] rounded-[10px] border border-white/[0.06]">
            <button
              type="button"
              onClick={() => setActiveTab("mic")}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-[8px] transition-all ${
                activeTab === "mic"
                  ? "bg-[#266DF0] text-white shadow-sm"
                  : "text-[#9CA3AF] hover:text-[#F3F4F6]"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Ghi Âm Trực Tiếp</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-[8px] transition-all ${
                activeTab === "upload"
                  ? "bg-[#266DF0] text-white shadow-sm"
                  : "text-[#9CA3AF] hover:text-[#F3F4F6]"
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Tải Tệp Lên</span>
            </button>
          </div>

          {/* TAB 1: LIVE RECORDING */}
          {activeTab === "mic" && (
            <div className="flex flex-col items-center justify-center py-7 px-4 bg-[#090A0D]/40 rounded-[12px] border border-white/[0.06]">
              <div className="font-mono text-3xl font-bold tracking-wider text-[#F3F4F6] mb-4">
                {formatDuration(recordingTime)}
              </div>

              {!isRecording ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={startRecording}
                  className="rounded-full px-7 py-5 shadow-[0_0_24px_rgba(38,109,240,0.35)] hover:scale-105 transition-transform"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  <span>Bắt Đầu Ghi Âm</span>
                </Button>
              ) : (
                <Button
                  variant="danger"
                  size="md"
                  onClick={stopRecording}
                  className="rounded-full px-7 py-5 shadow-[0_0_24px_rgba(239,68,68,0.35)] animate-pulse"
                >
                  <Square className="h-4 w-4 mr-2 fill-current" />
                  <span>Dừng &amp; Xem Sóng Âm</span>
                </Button>
              )}

              <p className="text-[11px] text-[#9CA3AF] mt-3">
                {isRecording ? "Nói rõ ràng vào micro máy tính" : "Nhấn nút để bắt đầu thu âm giọng nói"}
              </p>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === "upload" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center py-7 px-4 border-2 border-dashed rounded-[12px] cursor-pointer transition-all ${
                isDragOver
                  ? "border-[#266DF0] bg-[#266DF0]/5 shadow-[0_0_20px_rgba(38,109,240,0.15)]"
                  : "border-white/[0.1] hover:border-white/[0.2] bg-[#090A0D]/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm"
                className="hidden"
                onChange={handleManualUpload}
              />
              <div className="p-3 rounded-full bg-white/[0.04] border border-white/[0.08] mb-3 text-[#9B69FF]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-xs font-medium text-[#F3F4F6]">
                Kéo thả file âm thanh vào đây hoặc <span className="text-[#266DF0] underline">duyệt tệp</span>
              </p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">
                Hỗ trợ MP3, WAV, M4A, OGG, WEBM (tối đa 500MB, tự động chia nhỏ mỗi 15 phút)
              </p>
            </div>
          )}
        </div>
      )}

      {/* STATE 2: AUDIO IS READY -> IMMEDIATELY REVEAL WAVEFORM PLAYER & CONTROLS */}
      {activeAudioUrl && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-300">
          {/* File summary & Change Button */}
          <div className="flex items-center justify-between bg-[#090A0D] p-2.5 px-3.5 rounded-[10px] border border-white/[0.06]">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <FileAudio className="h-4 w-4 text-[#266DF0] shrink-0" />
              <span className="text-xs font-medium text-[#F3F4F6] truncate max-w-[200px]">
                {selectedFile?.name || "Bản ghi âm trực tiếp"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#9CA3AF]">
                {formatDuration(currentTime)} / {duration > 0 ? formatDuration(duration) : "--:--"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isTranscribing}
                className="text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6] h-7 px-2"
                title="Đổi tệp hoặc ghi âm lại"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                <span>Đổi tệp</span>
              </Button>
            </div>
          </div>

          {/* Waveform Player Canvas / Native Streamlined Scrubber cho tệp lớn */}
          <div className="relative rounded-[10px] bg-[#090A0D] border border-white/[0.08] p-3 overflow-hidden min-h-[96px] flex flex-col justify-center">
            {isLargeAudio ? (
              <div className="flex flex-col gap-2.5 w-full">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <Zap className="h-3 w-3" />
                    <span>Chế độ tối ưu RAM (Bảo vệ trình duyệt cho tệp lớn)</span>
                  </span>
                  <span className="text-white/40 font-mono text-[10px]">
                    {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                {/* Interactive Scrubber Bar */}
                <div
                  className="relative w-full h-8 bg-white/[0.04] hover:bg-white/[0.07] rounded-[8px] border border-white/[0.08] cursor-pointer flex items-center px-2 group transition-colors select-none"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickX = e.clientX - rect.left;
                    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
                    if (duration > 0) {
                      seekTo(fraction * duration);
                    }
                  }}
                >
                  {/* Progress Fill */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-[#266DF0]/30 to-[#9B69FF]/40 rounded-[8px] pointer-events-none"
                    style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                  />

                  {/* Frequency bars visualizer */}
                  <div className="relative w-full flex items-center justify-between gap-1 h-4 z-10 pointer-events-none opacity-60">
                    {Array.from({ length: 36 }).map((_, i) => {
                      const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
                      const barPct = (i / 36) * 100;
                      const isPassed = barPct <= progressPct;
                      const height = 25 + Math.sin(i * 0.7) * 20 + ((i % 5) * 8);
                      return (
                        <div
                          key={i}
                          className={`w-1 rounded-full transition-all duration-150 ${
                            isPassed
                              ? "bg-[#266DF0]"
                              : "bg-white/20"
                          } ${isPlaying ? "animate-pulse" : ""}`}
                          style={{
                            height: `${height}%`,
                            animationDelay: `${(i % 6) * 100}ms`
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Scrubber Thumb */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 w-2 bg-[#9B69FF] rounded-full shadow-[0_0_8px_rgba(155,105,255,0.8)] pointer-events-none transition-all"
                    style={{
                      left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 4px)`
                    }}
                  />
                </div>
              </div>
            ) : (
              <div ref={containerRef} className="w-full" />
            )}
          </div>

          {/* Playback Controls Bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {/* Skip -5s */}
              <Button
                variant="ghost"
                size="icon"
                disabled={isTranscribing}
                onClick={() => handleSkip(-5)}
                title="Lùi 5 giây"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              {/* Play/Pause */}
              <Button
                variant="primary"
                size="icon"
                disabled={isTranscribing}
                onClick={togglePlay}
                className="h-10 w-10 rounded-full shadow-[0_0_16px_rgba(38,109,240,0.3)] hover:scale-105 transition-transform"
                title={isPlaying ? "Tạm dừng" : "Phát âm thanh"}
              >
                {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
              </Button>

              {/* Skip +5s */}
              <Button
                variant="ghost"
                size="icon"
                disabled={isTranscribing}
                onClick={() => handleSkip(5)}
                title="Tua tới 5 giây"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Playback Speed */}
            <Button
              variant="secondary"
              size="sm"
              disabled={isTranscribing}
              onClick={handleRateChange}
              className="font-mono text-xs"
            >
              <FastForward className="h-3.5 w-3.5 text-[#9CA3AF]" />
              <span>{playbackRate}x</span>
            </Button>
          </div>

          {/* AI TRANSCRIPTION OPTIONS & PRIMARY CTA */}
          <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
            {/* MODEL SELECTOR CARDS */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/70">Mô hình Nhận dạng Giọng nói (STT)</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isTranscribing}
                  onClick={() => onModelTypeChange?.("zipformer")}
                  className={`flex flex-col items-start p-2.5 rounded-xl border transition-all text-left ${
                    modelType === "zipformer"
                      ? "bg-emerald-500/10 border-emerald-500/50 text-white shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                      : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-emerald-400 w-full">
                    <Zap className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Zipformer 30M</span>
                    <span className="px-1.5 py-0.2 text-[9px] rounded bg-emerald-500/20 text-emerald-300 font-bold ml-auto shrink-0">Siêu tốc</span>
                  </div>
                  <span className="text-[11px] text-white/50 mt-1 line-clamp-1">Nhanh gấp ~40x, nhẹ CPU, chuẩn tiếng Việt</span>
                </button>

                <button
                  type="button"
                  disabled={isTranscribing}
                  onClick={() => onModelTypeChange?.("phowhisper")}
                  className={`flex flex-col items-start p-2.5 rounded-xl border transition-all text-left ${
                    modelType === "phowhisper"
                      ? "bg-purple-500/10 border-purple-500/50 text-white shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                      : "bg-white/[0.02] border-white/10 text-white/60 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-purple-400 w-full">
                    <Cpu className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">PhoWhisper Medium</span>
                  </div>
                  <span className="text-[11px] text-white/50 mt-1 line-clamp-1">Chính xác cao, ngữ cảnh sâu, nặng CPU</span>
                </button>
              </div>
            </div>

            <div className="h-px bg-white/[0.04]" />

            <div className="flex flex-col gap-2.5">
              <Switch
                checked={enableDenoise}
                onCheckedChange={onDenoiseChange}
                disabled={isTranscribing}
                label="Khử tạp âm DeepFilterNet3 (48kHz)"
                description="Lọc sạch tiếng ồn môi trường, quạt gió, tiếng gõ phím"
                color="purple"
              />

              <div className="h-px bg-white/[0.04]" />

              <Switch
                checked={segmentEnable}
                onCheckedChange={onSegmentChange}
                disabled={isTranscribing}
                label="Bóc tách phân đoạn thông minh (Smart Segments)"
                description="Chia câu chuẩn xác theo thời gian kể cả khi nói liên hồi"
                color="blue"
              />
            </div>

            {/* REALISTIC MULTI-STAGE PROGRESS BAR & LIVE SCROLLABLE LOG CONSOLE */}
            {isTranscribing && (
              <div className="flex flex-col gap-2.5 p-3.5 rounded-[12px] bg-white/[0.04] border border-white/[0.08] animate-in fade-in duration-200">
                {/* Header: Stage status + Elapsed Timer + Progress % */}
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-[#9B69FF] font-medium truncate max-w-[240px]">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#9B69FF] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#9B69FF]"></span>
                    </span>
                    <span className="truncate">{statusMessage || "Đang xử lý âm thanh..."}</span>
                  </span>
                  <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                    <span className="text-[#9CA3AF] text-[11px] flex items-center gap-1 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                      <Clock className="h-3 w-3 text-[#9CA3AF]" />
                      <span>{formatDuration(elapsedTime)}</span>
                    </span>
                    <span className="font-semibold text-[#F3F4F6] bg-[#266DF0]/20 text-[#266DF0] px-1.5 py-0.5 rounded border border-[#266DF0]/30">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>

                <Progress value={progress} />

                {/* SCROLLABLE REAL-TIME LOG CONSOLE */}
                <div className="mt-1 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Terminal className="h-3.5 w-3.5 text-[#266DF0]" />
                      <span>Nhật ký xử lý hệ thống (Console Logs)</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Đang xử lý
                    </span>
                  </div>

                  <div className="max-h-36 overflow-y-auto rounded-[8px] bg-[#090A0D]/95 border border-white/[0.06] p-2.5 font-mono text-[11px] space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                    {logs && logs.length > 0 ? (
                      logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                          <span className="text-white/40 text-[10px] shrink-0 select-none">
                            [{log.timestamp}]
                          </span>
                          <span
                            className={
                              log.type === "success"
                                ? "text-emerald-400"
                                : log.type === "warn"
                                ? "text-amber-400"
                                : log.type === "process"
                                ? "text-[#9B69FF]"
                                : "text-white/80"
                            }
                          >
                            {log.message}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-white/40 text-[11px]">Đang khởi tạo tiến trình...</div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                {error}
              </div>
            )}

            <Button
              variant="brand"
              size="lg"
              isLoading={isTranscribing}
              disabled={isTranscribing}
              onClick={onTranscribe}
              className="w-full font-semibold shadow-[0_0_24px_rgba(155,105,255,0.3)] mt-1"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              <span>{isTranscribing ? "AI Đang Phiên Âm & Phân Đoạn..." : "Bắt Đầu Nhận Dạng (Voice to Text)"}</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
