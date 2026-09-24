---
trigger: always_on
---

# Feature-Based Project Structure (Bulletproof Architecture)

> Quy chuẩn tổ chức cây thư mục 5 tầng, ranh giới module và hợp đồng public API cho `sale_tool`.

## 1. Cây Thư Mục Tổng Thể 5 Tầng (`src/`)

Ứng dụng tổ chức theo **Domain Ownership (Nghiệp vụ)** thay vì phân loại theo vai trò kỹ thuật:

```text
src/
├── app/                  # Tầng 1: Routing, Global Providers (Theme, Toast), Root App Entry
├── pages/                # Tầng 2: Màn hình view lắp ráp, điều phối các feature containers
├── features/             # Tầng 3: Các domain nghiệp vụ cốt lõi (Core Business)
│   ├── core/             # Slices dùng chung giữa các feature (Domain types, shared badges)
│   ├── audio-record/     # Ghi âm microphone trực tiếp trên trình duyệt
│   ├── transcription/    # Upload file, gọi API khử nhiễu DeepFilter & PhoWhisper STT
│   ├── waveform/         # Tích hợp sóng âm thanh WaveSurfer.js & Controls
│   ├── segments/         # Timeline danh sách câu thoại, đồng bộ click-to-seek audio
│   └── history/          # Bảng tra cứu lịch sử bản ghi từ PostgreSQL
├── components/           # Tầng 4: Shared UI Primitives không chứa nghiệp vụ (Button, Card, Modal, Badge)
│   └── ui/               # Primitive components (Tailwind CSS v4 + cn utility)
└── shared/ (lib/ utils/) # Tầng 5: API client (Axios), formatters, shared types
```

## 2. Cấu Trúc Nội Bộ Mỗi Feature & Public API Surface

Mỗi feature chỉ tạo các thư mục thực sự cần thiết và **BẮT BUỘC** có file `index.ts` làm cổng giao tiếp public:

```text
features/<feature-name>/
├── components/   # UI components nội bộ của feature
├── hooks/        # Custom hooks chứa logic nghiệp vụ và state của feature
├── api/          # Các hàm gọi API Axios tương ứng
├── types/        # Kiểu TypeScript scoped trong feature
└── index.ts      # Public API duy nhất xuất ra ngoài (components, hooks, types)
```

## 3. Ranh Giới Module & Luồng Phụ Thuộc (Dependency Guardrails)

1. **Luồng phụ thuộc một chiều nghiêm ngặt (Strict Downward Flow)**:
   - `app/` ➔ `pages/` ➔ `features/` ➔ `components/` ➔ `lib/ utils/`.
   - Tầng trên được phép import tầng dưới; **tầng dưới tuyệt đối không import ngược lên tầng trên**.
2. **Cấm Import Chéo giữa các Feature ngang hàng (No Sibling Imports)**:
   - `features/waveform` **không được** import trực tiếp từ `features/history` hay ngược lại.
   - Nếu cần tương tác, hãy điều phối ở tầng `pages/` hoặc `app/` thông qua props callback hoặc React `children`.
3. **Mô-đun dùng chung giữa các feature**:
   - Nếu một component hoặc hook mang tính chất nghiệp vụ được dùng ở 2 feature trở lên, đưa vào `features/core/`. Tuyệt đối không nhét nghiệp vụ vào `components/ui/`.
4. **Không Deep-Import vào nội bộ Feature**:
   - Bên ngoài chỉ import từ `@/features/<feature-name>`, không import sâu vào `@/features/<feature-name>/components/...`.
