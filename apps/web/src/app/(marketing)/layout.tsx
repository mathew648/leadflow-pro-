import Link from "next/link";
import { Logo } from "@/components/logo";
import { SubscribeForm } from "@/components/subscribe-form";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <Link href="/" aria-label="TradieJet home">
            <Logo className="text-lg" markClassName="w-8 h-8" />
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <Link href="/features" className="hover:text-gray-900">Features</Link>
            <Link href="/compare" className="hover:text-gray-900">Why us</Link>
            <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/blog" className="hover:text-gray-900">Blog</Link>
            <Link href="/waitlist" className="hover:text-gray-900">Waitlist</Link>
            <Link href="/contact" className="hover:text-gray-900">Contact</Link>
          </nav>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/login" className="text-sm font-medium text-gray-700 hover:text-gray-900">Log in</Link>
            <Link
              href="/register"
              className="rounded-lg bg-brand-600 px-3.5 sm:px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 whitespace-nowrap"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 border-b">
            <div>
              <p className="font-semibold text-gray-900">Stay in the loop</p>
              <p className="text-sm text-gray-500 mt-1">Trade tips &amp; product updates. No spam.</p>
            </div>
            <SubscribeForm source="footer" />
          </div>
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <Logo className="text-base text-gray-700" markClassName="w-6 h-6" />
            <p>Built for Australian &amp; New Zealand trades businesses.</p>
            <div className="flex gap-5 flex-wrap">
              <Link href="/features" className="hover:text-gray-900">Features</Link>
              <Link href="/pricing" className="hover:text-gray-900">Pricing</Link>
              <Link href="/blog" className="hover:text-gray-900">Blog</Link>
              <Link href="/waitlist" className="hover:text-gray-900">Waitlist</Link>
              <Link href="/contact" className="hover:text-gray-900">Contact</Link>
              <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-900">Terms</Link>
              <Link href="/login" className="hover:text-gray-900">Log in</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
