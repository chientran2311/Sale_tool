import { apiClient } from "@/lib/api-client";

export type ReportMode = "plan" | "report";

export interface ReportGeneratePayload {
  mode: ReportMode;
  report_date: string;
  content: string;
}

export interface ReportGenerateResponse {
  mode: ReportMode;
  report_date: string;
  caption: string;
  summary_text: string;
  image_data_url: string;
}

export interface ReportSendPayload {
  mode: ReportMode;
  report_date: string;
  summary_text: string;
  image_data_url?: string;
  chat_id?: string;
}

export interface ReportSendResponse {
  success: boolean;
  message: string;
  chat_id: string;
  message_id?: number;
  caption: string;
  summary_text?: string;
  image_data_url?: string;
}

export async function generateReportApi(
  payload: ReportGeneratePayload
): Promise<ReportGenerateResponse> {
  const res = await apiClient.post<ReportGenerateResponse>(
    "/reports/generate",
    payload
  );
  return res.data;
}

export async function sendReportApi(
  payload: ReportSendPayload
): Promise<ReportSendResponse> {
  const res = await apiClient.post<ReportSendResponse>(
    "/reports/send",
    payload
  );
  return res.data;
}

export async function processAndSendApi(
  payload: ReportGeneratePayload
): Promise<ReportSendResponse> {
  const res = await apiClient.post<ReportSendResponse>(
    "/reports/process-and-send",
    payload
  );
  return res.data;
}

export interface ReportComboItem {
  mode: "plan" | "report";
  report_date: string;
  caption: string;
  summary_text: string;
  image_data_url: string;
}

export interface ReportComboGeneratePayload {
  report_date: string;
  content: string;
}

export interface ReportComboGenerateResponse {
  report: ReportComboItem;
  plan: ReportComboItem;
}

export async function generateComboReportApi(
  payload: ReportComboGeneratePayload
): Promise<ReportComboGenerateResponse> {
  const res = await apiClient.post<ReportComboGenerateResponse>(
    "/reports/generate-combo",
    payload
  );
  return res.data;
}

export interface RenderImageSection {
  num: string;
  title: string;
  items: string[];
}

export interface RenderImagePayload {
  content: string;
  title?: string;
  sections?: RenderImageSection[];
}

export interface RenderImageResponse {
  image_data_url: string;
}

export async function renderLiveImageApi(
  payload: RenderImagePayload
): Promise<RenderImageResponse> {
  const res = await apiClient.post<RenderImageResponse>(
    "/reports/render-image",
    payload
  );
  return res.data;
}

export interface DeleteMessagePayload {
  message_id: number;
  chat_id?: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  message: string;
}

export async function deleteMessageApi(
  payload: DeleteMessagePayload
): Promise<DeleteMessageResponse> {
  const res = await apiClient.post<DeleteMessageResponse>(
    "/reports/delete-message",
    payload
  );
  return res.data;
}

