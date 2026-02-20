"use client";

export function SkeletonLine({ width = "100%", height = "16px" }: { width?: string; height?: string }) {
  return (
    <div
      className="rounded-md animate-shimmer"
      style={{
        width,
        height,
        background: "linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-elevated) 50%, var(--bg-tertiary) 75%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-subtle)] p-6 space-y-4">
      <SkeletonLine width="40%" height="12px" />
      <SkeletonLine width="60%" height="28px" />
      <div className="flex gap-4">
        <SkeletonLine width="30%" height="18px" />
        <SkeletonLine width="30%" height="18px" />
        <SkeletonLine width="30%" height="18px" />
      </div>
    </div>
  );
}

export function SkeletonBar() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <SkeletonLine width="60px" height="13px" />
            <SkeletonLine width="40px" height="12px" />
          </div>
          <SkeletonLine width="100%" height="8px" />
        </div>
      ))}
    </div>
  );
}
