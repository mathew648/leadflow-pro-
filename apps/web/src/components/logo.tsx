import { cn } from "@/lib/utils";

/** TradieJet jet mark — an upward jet/arrowhead (takeoff = speed). */
export function JetMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <path d="M256 100 L414 398 L256 326 L98 398 Z" fill="currentColor" />
    </svg>
  );
}

/** TradieJet wordmark: jet mark + "Tradie" + accented "Jet". */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-600 text-white", markClassName)}>
        <JetMark className="w-4 h-4" />
      </span>
      <span>Tradie<span className="text-brand-600">Jet</span></span>
    </span>
  );
}
