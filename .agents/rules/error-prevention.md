---
trigger: always_on
---

# Error Prevention & Maintainability Rules (React 19 + TypeScript)

> Bộ quy tắc phòng chống lỗi, xử lý ngoại lệ và đảm bảo tính ổn định, dễ bảo trì cho `sale_tool`.

## 1. Giáp Bọc Ngoại Lệ: Error Boundaries & Suspense Boundaries

- Mọi màn hình chính hoặc widget quan trọng (Audio Player, Transcription Panel) phải được bọc bởi **ErrorBoundary** và **Suspense** để lỗi ở một widget không làm sập (white screen) toàn bộ ứng dụng:
  ```tsx
  <ErrorBoundary fallback={AudioPlayerErrorFallback}>
    <Suspense fallback={<AudioPlayerSkeleton />}>
      <WaveformAudioPlayer audioUrl={url} />
    </Suspense>
  </ErrorBoundary>
  ```
- **Lưu ý**: Error Boundary không bắt được lỗi trong asynchronous callback (như trong `setTimeout` hoặc `fetch`). Với async handler, luôn dùng `try...catch` và cập nhật state thông báo lỗi cho người dùng.

## 2. Phòng Tránh Các Bẫy `useEffect` (Pitfalls to Avoid)

1. **Không tính toán Derived State trong `useEffect`**:
   - Nếu một giá trị có thể tính toán trực tiếp từ `props` hoặc `state` hiện tại, hãy tính toán ngay trong luồng render.
   - ❌ **Sai**: `useEffect(() => { setFormattedTime(formatTime(duration)); }, [duration]);`
   - ✅ **Đúng**: `const formattedTime = formatTime(duration);`
2. **Ngăn chặn Infinite Render Loops**:
   - Không truyền object hoặc array literal vào dependency array của `useEffect` nếu không được memoize.
3. **Purity cho React 19 Compiler**:
   - Giữ thân component thuần khiết (pure function) và không tạo side-effect trong quá trình render để compiler tối ưu hóa an toàn.

## 3. Dọn Dẹp Tài Nguyên Phần Cứng & Web Audio (Zero Memory Leaks)

1. **Vòng đời WaveSurfer**:
   - Luôn trả về hàm dọn dẹp `ws.destroy()` trong `useEffect` khởi tạo:
     ```typescript
     useEffect(() => {
       if (!containerRef.current || !url) return;
       const ws = WaveSurfer.create({ ... });
       return () => {
         ws.destroy();
       };
     }, [url]);
     ```
2. **Microphone Hardware Release**:
   - Khi dừng ghi âm hoặc component unmount, **BẮT BUỘC** gọi `stream.getTracks().forEach(track => track.stop())`. Không để đèn micro trên thanh tiêu đề trình duyệt sáng khi đã dừng thu âm.

## 4. Kiểm Soát Race Conditions & Hủy Request Mạng (AbortController)

- Khi người dùng bấm tải lại file hoặc chuyển sang bản ghi khác trong khi API phiên âm đang chạy:
  - Phải hủy request cũ bằng `AbortController` của Axios/Fetch để tránh kết quả của request chậm ghi đè lên dữ liệu mới:
    ```typescript
    const controller = new AbortController();
    axios.post(url, formData, { signal: controller.signal });
    // Hủy: controller.abort();
    ```

## 5. Phòng Thủ Null/Undefined Trên Dữ Liệu Âm Thanh & DOM Refs

- Container Ref cho WaveSurfer: Luôn kiểm tra `if (!containerRef.current) return;` trước khi vẽ sóng.
- Danh sách Segments: Sử dụng optional chaining `segments?.map(...)` hoặc xử lý trường hợp `segments === null` khi người dùng tắt cờ `segment_enable`.
