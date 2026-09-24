import axios from "axios";

export const apiClient = axios.create({
  baseURL: "/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  // Không giới hạn timeout cho các tệp âm thanh dài (> 1-2 tiếng)
  timeout: 0,
});

