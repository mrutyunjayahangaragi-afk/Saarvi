export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4"
    >
      <div className="relative w-12 h-12">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 animate-pulse" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-600 animate-spin" />
      </div>
      <p className="text-sm font-medium text-slate-500 animate-pulse">
        Loading...
      </p>
      <span className="sr-only">Loading page content...</span>
    </div>
  );
}
