import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/** TradieJet wordmark: bolt mark + "Tradie" + accented "Jet". */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg bg-brand-600 text-white", markClassName)}>
        <Zap className="w-4 h-4" fill="currentColor" />
      </span>
      <span>Tradie<span className="text-brand-600">Jet</span></span>
    </span>
  );
}
