"use client";

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export default function SkeletonCard({
  lines = 3,
  className = "",
}: SkeletonCardProps) {
  return (
    <div
      className={`p-5 bg-white dark:bg-[#111c38] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs animate-pulse ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded" />
          <div className="h-2.5 w-1/2 bg-slate-100 dark:bg-slate-800 rounded" />
        </div>
      </div>
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 bg-slate-100 dark:bg-slate-800 rounded mb-2 ${i === lines - 2 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}
