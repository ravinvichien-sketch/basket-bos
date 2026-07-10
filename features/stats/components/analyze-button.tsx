"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface AnalysisResult {
  grade: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  tips: string[];
}

export function AnalyzeButton({
  gameId,
  profileId,
  nickname,
}: {
  gameId: string;
  profileId: string;
  nickname: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/analyze-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, profileId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
        return;
      }
      setResult(data);
    } catch {
      setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setLoading(false);
    }
  }

  const gradeColor: Record<string, string> = {
    A: "text-emerald-400 border-emerald-400/40 bg-emerald-500/10",
    B: "text-blue-400 border-blue-400/40 bg-blue-500/10",
    C: "text-amber-400 border-amber-400/40 bg-amber-500/10",
    D: "text-red-400 border-red-400/40 bg-red-500/10",
  };

  return (
    <>
      <button
        type="button"
        onClick={analyze}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-lg bg-surface-overlay px-2 py-1 text-[10px] font-semibold text-ink-dim hover:bg-surface-overlay/70 hover:text-ink transition disabled:opacity-40"
      >
        {loading ? "🤖 วิเคราะห์..." : "🤖 AI วิเคราะห์"}
      </button>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setResult(null)}>
          <div
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface-raised p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold">🤖 AI Coach — {nickname}</h3>
              <button
                onClick={() => setResult(null)}
                className="h-7 w-7 rounded-full bg-surface-overlay text-xs hover:bg-surface transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className={cn("rounded-xl border px-3 py-2 text-center", gradeColor[result.grade] ?? "border-white/10 bg-surface-overlay")}>
                <span className="text-2xl font-black">{result.grade}</span>
                <p className="text-xs text-ink-dim mt-0.5">{result.summary}</p>
              </div>

              {result.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-emerald-400 mb-1">✅ จุดแข็ง</p>
                  <ul className="space-y-0.5">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-ink-dim pl-3 relative before:content-['•'] before:absolute before:left-0">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.weaknesses.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-400 mb-1">⚠️ จุดที่ต้องปรับปรุง</p>
                  <ul className="space-y-0.5">
                    {result.weaknesses.map((s, i) => (
                      <li key={i} className="text-xs text-ink-dim pl-3 relative before:content-['•'] before:absolute before:left-0">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.tips.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-blue-400 mb-1">💡 คำแนะนำ</p>
                  <ul className="space-y-0.5">
                    {result.tips.map((s, i) => (
                      <li key={i} className="text-xs text-ink-dim pl-3 relative before:content-['•'] before:absolute before:left-0">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setError(null)}>
          <div className="max-w-sm rounded-2xl bg-surface-raised p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <button
              onClick={() => setError(null)}
              className="w-full rounded-xl bg-court py-2 text-sm font-semibold text-white"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </>
  );
}
