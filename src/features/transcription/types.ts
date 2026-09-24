import type { AudioRecord } from "@/features/core";

export interface TranscriptionOptions {
  enableDenoise: boolean;
  segmentEnable: boolean;
}

export interface TranscriptionState {
  isTranscribing: boolean;
  progress: number;
  result: AudioRecord | null;
  error: string | null;
}
