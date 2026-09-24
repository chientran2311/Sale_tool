# API Client & Server State Integration

> Mẫu kết nối với Backend FastAPI, theo dõi % tải lên và hủy bỏ request mạng.

## 1. DTO Types Khớp Chuẩn Backend

```typescript
export interface AudioSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface AudioRecordResponse {
  id: number;
  filename: string;
  text: string;
  duration: number;
  formatted_duration: string;
  denoise_enabled: boolean;
  segment_enabled: boolean;
  segments: AudioSegment[] | null;
  created_at: string;
}
```

## 2. Axios Client Hỗ Trợ Progress & AbortSignal

```typescript
import axios from "axios";

export async function transcribeAudio(
  file: File | Blob,
  fileName: string = "recording.webm",
  enableDenoise: boolean = true,
  segmentEnable: boolean = true,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<AudioRecordResponse> {
  const formData = new FormData();
  formData.append("file", file, fileName);

  const url = `/api/v1/audio/transcribe?enable_denoise=${enableDenoise}&segment_enable=${segmentEnable}`;

  const response = await axios.post<AudioRecordResponse>(url, formData, {
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
```
