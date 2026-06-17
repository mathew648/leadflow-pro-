import { Zap, Bell } from "lucide-react";

/** Lightweight CSS preview of the app — a leads inbox with a live "new lead" toast. */
export function HeroMockup() {
  const leads = [
    { name: "Sarah M.", job: "Switchboard upgrade", time: "2m", hot: true },
    { name: "Dave K.", job: "Hot water repair", time: "18m", hot: false },
    { name: "Acme Cafe", job: "Lighting fit-out", time: "1h", hot: false },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* App window */}
      <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden text-gray-900">
        <div className="flex items-center gap-2 px-4 h-10 border-b bg-gray-50">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="ml-3 inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
            <Zap className="w-3 h-3 text-brand-600" fill="currentColor" /> Leads
          </span>
        </div>
        <div className="p-4 space-y-2.5">
          {leads.map((l) => (
            <div key={l.name} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold text-sm flex items-center justify-center">
                {l.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{l.name}</p>
                <p className="text-xs text-gray-500 truncate">{l.job}</p>
              </div>
              {l.hot && <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 rounded-full px-2 py-0.5">🔥 Hot</span>}
              <span className="text-[11px] text-gray-400">{l.time}</span>
            </div>
          ))}
        </div>
      </div>
      {/* Floating "new lead" toast */}
      <div className="absolute -bottom-4 -right-3 sm:-right-6 bg-white rounded-xl shadow-xl ring-1 ring-black/5 px-3.5 py-2.5 flex items-center gap-2.5 text-gray-900">
        <span className="w-8 h-8 rounded-lg bg-green-100 text-green-700 flex items-center justify-center"><Bell className="w-4 h-4" /></span>
        <div className="leading-tight">
          <p className="text-xs font-semibold">New lead — auto-replied ✅</p>
          <p className="text-[11px] text-gray-500">Quote sent in 2 minutes</p>
        </div>
      </div>
    </div>
  );
}
