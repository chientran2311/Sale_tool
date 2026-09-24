---
trigger: always_on
---

# React 19 Design Patterns & Best Practices

> Các mẫu thiết kế (Patterns) và thực hành chuyên sâu cho React 19 trong `sale_tool`.

## 1. Tách Biệt State & State Colocation

Không bao giờ gom tất cả state vào một store global khổng lồ:

1. **Server State (Dữ liệu mạng / Backend)**:
   - Dữ liệu lịch sử, kết quả phiên âm, trạng thái gọi API (`isLoading`, `isError`, `data`).
   - Quản lý qua Custom Hooks chuyên biệt cho API. Không đẩy server state vào Redux/Zustand.
2. **Client UI State (Trạng thái giao diện)**:
   - Dark/Light mode, tab đang active, đóng/mở dialog modal.
   - **State Colocation**: Đặt state ở vị trí gần nhất với component tiêu thụ nó để tránh kích hoạt re-render toàn bộ cây component.
3. **Async Context với `use()` trong React 19**:
   - Sử dụng hook `use(ThemeContext)` để đọc context linh hoạt trong luồng render.
   - Tách biệt Context dữ liệu động (thay đổi liên tục) khỏi Context cấu hình tĩnh hoặc Action dispatchers để tránh re-render thừa.

## 2. Custom Hooks Pattern (Tách Logic khỏi JSX)

- File Component (`.tsx`) chỉ chịu trách nhiệm render UI, giao diện và nhận diện tương tác.
- Toàn bộ thao tác phức tạp (Web Audio API, MediaRecorder, WaveSurfer lifecycle, Axios HTTP calls) phải đưa vào Custom Hook:
  ```tsx
  // ✅ Chuẩn: Component sạch, tiêu thụ hook
  export function TranscriptionPanel() {
    const { isTranscribing, progress, result, handleTranscribe } = useTranscription();
    return <TranscriptionView onUpload={handleTranscribe} progress={progress} result={result} />;
  }
  ```

## 3. Slot Pattern (`asChild`)

- Áp dụng mẫu Slot Pattern tương tự Radix UI / shadcn khi cần truyền hành vi và styles của một button/link vào phần tử con mà không tạo thẻ `<div>` bọc thừa trong DOM:
  ```tsx
  <Button asChild>
    <a href="/download">Tải file âm thanh</a>
  </Button>
  ```
