import { SaarviLoadingLogo } from "@/components/brand/SaarviLoadingLogo";

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[70vh] flex flex-col items-center justify-center p-6"
    >
      <SaarviLoadingLogo
        size="lg"
        message="Saarvi is preparing your workspace..."
      />
    </div>
  );
}
