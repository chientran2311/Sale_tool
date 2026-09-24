export interface AudioSegment {
  id: number;
  start: number;
  end: number;
  start_formatted?: string;
  end_formatted?: string;
  text: string;
}

export interface AudioRecord {
  id: number;
  filename: string;
  text: string;
  duration: number;
  formatted_duration: string;
  denoise_enabled: boolean;
  segment_enabled: boolean;
  model_type?: string;
  segments: AudioSegment[] | null;
  created_at: string;
  audioUrl?: string;
}
