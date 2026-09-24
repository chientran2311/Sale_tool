---
name: react
description: React best practices, modern architecture, patterns, and conventions for React 19 + TypeScript + Vite web applications. Use when writing React components, custom hooks, state management, audio and waveform integrations (wavesurfer.js, Web Audio API), Tailwind CSS styling, and API integration.
---

# React Best Practices & Clean Architecture (React 19 + TypeScript)

Official skill for writing modern, scalable, and error-free React 19 applications with TypeScript and Vite.

---

## 1. Core Rules & Index

Always prefer modern React 19 idioms, TypeScript strict typing, and Feature-Based Architecture. Detailed guidelines and code examples are modularized in the `references/` directory:

| Topic | Key Guideline | Reference Document |
| :--- | :--- | :--- |
| **Architecture & Structure** | Feature-Based 5-layer flow; public API `index.ts`; strict isolation | [project-structure.md](../../rules/project-structure.md) |
| **Coding Style & Typing** | No `React.FC`; explicit props; immutability; max 150-200 lines | [coding-style.md](../../rules/coding-style.md) |
| **Error Prevention** | Error Boundaries; Suspense; no derived state in `useEffect` | [error-prevention.md](../../rules/error-prevention.md) |
| **Component Patterns** | AsyncBoundary; Slot Pattern (`asChild`) | [component-patterns.md](references/component-patterns.md) |
| **Audio & Media Hooks** | Lifecycle management for `WaveSurfer.js`; Microphone capture & release | [audio-hooks.md](references/audio-hooks.md) |
| **API & Server State** | Axios upload progress; AbortSignal cancellation; DTO typing | [api-and-state.md](references/api-and-state.md) |

---

## 2. Quick Snippet: Clean Component with Custom Hook & Boundary

```tsx
import { useTranscription } from "@/features/transcription/hooks/useTranscription";
import { AsyncBoundary } from "@/components/common/AsyncBoundary";
import { WaveformVisualizer } from "@/features/waveform";
import { SegmentList } from "@/features/segments";

export function TranscriptionScreen() {
  const { isTranscribing, progress, record, transcribe } = useTranscription();

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-white">Audio Transcription</h1>
      </header>

      {/* Media Player with Error Boundary */}
      {record?.audioUrl && (
        <AsyncBoundary loadingFallback={<div className="h-20 bg-zinc-900 animate-pulse rounded-lg" />} errorFallback={({ error }) => <div className="text-rose-400">Lỗi âm thanh: {error.message}</div>}>
          <WaveformVisualizer audioUrl={record.audioUrl} />
        </AsyncBoundary>
      )}

      {/* Segments Timeline */}
      {record?.segments && (
        <SegmentList segments={record.segments} />
      )}
    </div>
  );
}
```
