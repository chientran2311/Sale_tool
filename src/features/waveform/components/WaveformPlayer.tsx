import React, { useRef } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { Play, Pause, RotateCcw, RotateCw, Volume2, FastForward } from "lucide-react";
import { useWaveSurfer } from "../hooks/useWaveSurfer";
import { formatDuration } from "@/utils/formatDuration";

export interface WaveformPlayerProps {
  audioUrl?: string | null;
  onTimeUpdate?: (time: number) => void;
  seekTime?: number | null;
}

export function WaveformPlayer({ audioUrl, onTimeUpdate, seekTime }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playbackRate, setPlaybackRateState] = React.useState<number>(1.0);

  const { isPlaying, currentTime, duration, isReady, togglePlay, seekTo, setPlaybackRate } =
    useWaveSurfer({
      containerRef,
      audioUrl,
      onTimeUpdate,
    });

  // Synchronize seek from external components (e.g. click segment)
  React.useEffect(() => {
    if (seekTime !== null && seekTime !== undefined && isReady) {
      seekTo(seekTime);
    }
  }, [seekTime, isReady, seekTo]);

  const handleRateChange = () => {
    const rates = [1.0, 1.25, 1.5, 2.0];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    setPlaybackRateState(nextRate);
    setPlaybackRate(nextRate);
  };

  const handleSkip = (seconds: number) => {
    const newTime = Math.min(Math.max(0, currentTime + seconds), duration);
    seekTo(newTime);
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-[#266DF0]" />
          <h2 className="text-sm font-semibold text-[#F3F4F6]">Trình phát Sóng Âm Thanh</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="blue">WaveSurfer 7</Badge>
          <div className="text-xs font-mono font-medium text-[#F3F4F6]">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </div>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="relative rounded-[10px] bg-[#090A0D] border border-white/[0.08] p-3 overflow-hidden min-h-[96px] flex items-center">
        {!audioUrl ? (
          <div className="w-full text-center text-xs text-[#9CA3AF]">
            Chưa có âm thanh. Hãy tải lên tệp hoặc ghi âm để hiển thị biểu đồ sóng.
          </div>
        ) : (
          <div ref={containerRef} className="w-full" />
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {/* Skip -5s */}
          <Button
            variant="ghost"
            size="icon"
            disabled={!isReady}
            onClick={() => handleSkip(-5)}
            title="Lùi 5 giây"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>

          {/* Play/Pause */}
          <Button
            variant="primary"
            size="icon"
            disabled={!isReady}
            onClick={togglePlay}
            className="h-10 w-10 rounded-full"
            title={isPlaying ? "Tạm dừng" : "Phát âm thanh"}
          >
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
          </Button>

          {/* Skip +5s */}
          <Button
            variant="ghost"
            size="icon"
            disabled={!isReady}
            onClick={() => handleSkip(5)}
            title="Tua tới 5 giây"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Speed button */}
        <Button
          variant="secondary"
          size="sm"
          disabled={!isReady}
          onClick={handleRateChange}
          className="font-mono text-xs"
        >
          <FastForward className="h-3.5 w-3.5 text-[#9CA3AF]" />
          <span>{playbackRate}x</span>
        </Button>
      </div>
    </Card>
  );
}
