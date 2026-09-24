export interface AudioRecordingState {
  isRecording: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
}
