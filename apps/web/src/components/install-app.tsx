"use client";
import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

/**
 * Smart "Install app" button:
 * - Android / desktop Chrome: fires the native install prompt (one-tap install).
 * - iOS Safari: shows Add-to-Home-Screen instructions (Apple blocks programmatic install).
 * Hidden when already installed.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(ios);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setInstalled(standalone);

    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleClick() {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* ignore */ }
      setDeferred(null);
    } else {
      setShowHelp(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={className ?? "inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"}
      >
        <Download className="w-4 h-4" /> Install app
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={() => setShowHelp(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Add TradieJet to your phone</h3>
              <button onClick={() => setShowHelp(false)} aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            {isIOS ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex items-start gap-2"><span className="font-bold text-brand-600">1.</span> Tap the <Share className="w-4 h-4 inline mx-0.5 text-blue-500" /> <strong>Share</strong> button at the bottom of Safari.</li>
                <li className="flex items-start gap-2"><span className="font-bold text-brand-600">2.</span> Scroll down and tap <Plus className="w-4 h-4 inline mx-0.5" /> <strong>Add to Home Screen</strong>.</li>
                <li className="flex items-start gap-2"><span className="font-bold text-brand-600">3.</span> Tap <strong>Add</strong> — TradieJet is now on your home screen like an app. 🎉</li>
              </ol>
            ) : (
              <div className="text-sm text-gray-700 space-y-2">
                <p>To install on Android, open this site in <strong>Chrome</strong>, then:</p>
                <ol className="space-y-2">
                  <li className="flex items-start gap-2"><span className="font-bold text-brand-600">1.</span> Tap the <strong>⋮</strong> menu (top right).</li>
                  <li className="flex items-start gap-2"><span className="font-bold text-brand-600">2.</span> Tap <strong>Install app</strong> / Add to Home screen.</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
