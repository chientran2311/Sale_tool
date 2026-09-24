import { apiClient } from "@/lib/api-client";
import type { AudioRecord } from "@/features/core";

export async function fetchAudioRecordsApi(skip: number = 0, limit: number = 50): Promise<AudioRecord[]> {
  const response = await apiClient.get<AudioRecord[]>(`/audio/records?skip=${skip}&limit=${limit}`);
  return response.data;
}

export async function fetchAudioRecordByIdApi(id: number): Promise<AudioRecord> {
  const response = await apiClient.get<AudioRecord>(`/audio/records/${id}`);
  return response.data;
}
