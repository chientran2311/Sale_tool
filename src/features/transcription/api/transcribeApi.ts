import { apiClient } from "@/lib/api-client";
import type { AudioRecord } from "@/features/core";

export interface TaskProgressResponse {
  task_id: string;
  status: "processing" | "completed" | "failed" | "not_found";
  percent: number;
  stage: string;
  message: string;
  updated_at?: number;
  result?: AudioRecord | null;
  error?: string | null;
}

export async function getTranscribeProgressApi(taskId: string): Promise<TaskProgressResponse> {
  const response = await apiClient.get<TaskProgressResponse>(`/audio/progress/${taskId}`);
  return response.data;
}

export async function transcribeAudioApi(
  file: File | Blob,
  fileName: string = "recording.webm",
  enableDenoise: boolean = true,
  segmentEnable: boolean = true,
  modelType: string = "zipformer",
  taskId?: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<AudioRecord> {
  const formData = new FormData();
  formData.append("file", file, fileName);

  let url = `/audio/transcribe?enable_denoise=${enableDenoise}&segment_enable=${segmentEnable}&model_type=${modelType}`;
  if (taskId) {
    url += `&task_id=${encodeURIComponent(taskId)}`;
  }

  const response = await apiClient.post<AudioRecord>(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
    onUploadProgress: (e) => {
      if (e.total) {
        const percent = Math.round((e.loaded * 100) / e.total);
        onProgress?.(percent);
      }
    },
  });

  return response.data;
}

