---
trigger: always_on
---

# React 19 & TypeScript Coding Style

> Chuẩn mực viết code, quy ước đặt tên và thực hành sạch cho React 19 và TypeScript trong `sale_tool`.

## 1. Tiêu Chuẩn TypeScript & Props

- **Không sử dụng `React.FC`**: Định nghĩa kiểu props trực tiếp để hợp đồng props rõ ràng, không ngầm định `children`:
  ```tsx
  // ❌ Tránh
  const Button: React.FC<ButtonProps> = ({ children }) => ...;

  // ✅ Chuẩn React 19
  interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: "primary" | "secondary";
  }
  export function Button({ children, onClick, variant = "primary" }: ButtonProps) {
    return <button onClick={onClick} className={...}>{children}</button>;
  }
  ```
- **Strict Typing**: Tránh `any` trong mọi tình huống. Dùng `unknown` hoặc generic nếu chưa xác định được kiểu dữ liệu.
- **Path Aliases**: Luôn dùng `@/...` (ví dụ: `@/components/ui/button`, `@/features/transcription`), cấm dùng đường dẫn tương đối dài (`../../../`).

## 2. Quy Ước Đặt Tên (Naming Conventions)

| Đối tượng | Quy tắc | Ví dụ |
| :--- | :--- | :--- |
| **Component Files** | PascalCase | `AudioPlayer.tsx`, `WaveformVisualizer.tsx` |
| **Custom Hooks** | camelCase bắt đầu bằng `use` | `useWaveSurfer.ts`, `useAudioRecorder.ts` |
| **Utilities / Services** | camelCase | `formatDuration.ts`, `apiClient.ts` |
| **TypeScript Types** | PascalCase | `AudioSegment`, `TranscriptionResponse` |
| **Constants** | UPPER_SNAKE_CASE | `DEFAULT_SAMPLE_RATE`, `MAX_AUDIO_SIZE_MB` |

## 3. Tiêu Chuẩn Component & Tính Bất Biến (Immutability)

- **Functional Components**: 100% sử dụng hàm và hooks.
- **Kích thước giới hạn (Max 150-200 lines)**: Mỗi file component tối đa **150 - 200 dòng**. Nếu phình to, lập tức phân rã thành các sub-components hoặc bóc tách logic sang Custom Hook.
- **Không đột biến dữ liệu (Immutability)**: Tuyệt đối không thay đổi trực tiếp `state` hoặc `props`. Luôn dùng functional updates hoặc spread operator (`[...prev, newItem]`, `{ ...prev, key: value }`).
- **Tận dụng React 19 Compiler**: Tránh lạm dụng thủ công `useMemo`, `useCallback` hoặc `React.memo` cho các tác vụ đơn giản; React 19 Compiler đã tự động tối ưu hóa việc memoize. Chỉ dùng cho các tính toán dữ liệu lớn thực sự tốn kém.

## 4. Styling với Tailwind CSS v4

- Sử dụng utility `cn()` (`clsx` + `tailwind-merge`) cho toàn bộ class có điều kiện:
  ```tsx
  className={cn("base-classes", isActive && "active-classes", className)}
  ```
- Ưu tiên Dark Mode theo bảng màu hiện đại: nền đen `zinc-950`/`slate-900`, bề mặt card `zinc-900/80` phủ viền mảnh `border-zinc-800/80` và điểm nhấn tím Neon/Indigo (`indigo-500`, `violet-500`).
