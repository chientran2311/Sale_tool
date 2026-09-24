import { Card, Switch, Button, Progress } from "@/components/ui";
import { Sparkles } from "lucide-react";

interface TranscribeControlsProps {
  enableDenoise: boolean;
  onDenoiseChange: (val: boolean) => void;
  segmentEnable: boolean;
  onSegmentChange: (val: boolean) => void;
  onTranscribe: () => void;
  isTranscribing: boolean;
  progress: number;
  disabled?: boolean;
}

export function TranscribeControls({
  enableDenoise,
  onDenoiseChange,
  segmentEnable,
  onSegmentChange,
  onTranscribe,
  isTranscribing,
  progress,
  disabled = false,
}: TranscribeControlsProps) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-[#F3F4F6]">Tùy chọn Xử lý AI</h2>

      <div className="flex flex-col gap-3 py-1">
        <Switch
          checked={enableDenoise}
          onCheckedChange={onDenoiseChange}
          disabled={isTranscribing || disabled}
          label="Khử tạp âm nền (DeepFilterNet3)"
          description="Lọc sạch tiếng ồn, tiếng gió, tiếng gõ phím ở 48kHz"
          color="purple"
        />

        <div className="h-px bg-white/[0.06]" />

        <Switch
          checked={segmentEnable}
          onCheckedChange={onSegmentChange}
          disabled={isTranscribing || disabled}
          label="Phân đoạn mốc thời gian (Segments)"
          description="Bóc tách chi tiết từng câu nói kèm timestamp"
          color="blue"
        />
      </div>

      {isTranscribing && <Progress value={progress} showLabel />}

      <Button
        variant="brand"
        size="lg"
        isLoading={isTranscribing}
        disabled={disabled || isTranscribing}
        onClick={onTranscribe}
        className="w-full font-semibold shadow-[0_0_24px_rgba(155,105,255,0.3)]"
      >
        <Sparkles className="h-4 w-4" />
        <span>{isTranscribing ? "AI Đang Phiên âm..." : "Bắt đầu Phiên âm & Phân tích"}</span>
      </Button>
    </Card>
  );
}
