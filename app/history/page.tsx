"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ScanSummary {
  id: string;
  detectedMainUrl: string | null;
  detectedKeyword: string | null;
  detectedArticleType: string | null;
  score: number | null;
  verdict: string | null;
  finalDecision: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/history")
      .then(r => r.json())
      .then((data: ScanSummary[]) => { setScans(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const deleteScan = async (id: string) => {
    await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    setScans(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push("/")} className="text-white/30 hover:text-white/60 text-sm transition-colors">
          ← RankGod
        </button>
        <span className="text-white/20 text-xs tracking-widest uppercase">History</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : scans.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-white/20 text-sm">No scans yet.</p>
            <button onClick={() => router.push("/")} className="mt-4 text-white/40 hover:text-white/60 text-sm transition-colors">
              Start your first analysis →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {scans.map(scan => (
              <div key={scan.id} className="border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm truncate">{scan.detectedMainUrl || scan.detectedKeyword || "Text input"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {scan.score !== null && (
                      <span className="text-white/40 text-xs">{Math.round(scan.score)}/100</span>
                    )}
                    {scan.verdict && <span className="text-white/30 text-xs">{scan.verdict}</span>}
                    {scan.detectedArticleType && <span className="text-white/20 text-xs">{scan.detectedArticleType}</span>}
                    <span className="text-white/20 text-xs">{new Date(scan.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteScan(scan.id)}
                  className="text-white/20 hover:text-red-400/60 text-xs ml-4 transition-colors"
                >
                  delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
