import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F9FB] grid grid-cols-1 lg:grid-cols-2">
      {/* Left Side: Clean Workspace Hero Image (no text overlay) */}
      <section className="relative bg-[#243B53] min-h-[240px] sm:min-h-[320px] lg:min-h-screen overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/workspace-hero.svg"
          alt={`${HUB_NAME} workspace`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </section>

      {/* Right Side: Visitor Sign-In Entry (zero staff login links visible) */}
      <section className="flex flex-col justify-between px-5 py-8 sm:px-10 sm:py-12 lg:px-16 lg:py-14 bg-[#F7F9FB]">
        <header className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            D
          </div>
          <div>
            <div className="font-bold text-[#111827] text-sm leading-tight">{HUB_NAME}</div>
            <div className="text-[11px] text-[#6B7A8C]">Our visitors &middot; Clock In</div>
          </div>
        </header>

        <div className="w-full max-w-md mx-auto my-8 lg:my-0">
          <div className="mb-6">
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1.5">
              OUR VISITORS
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              Welcome to {HUB_NAME} (DAIH)
            </h1>
            <p className="text-sm sm:text-base text-[#6B7A8C] mt-3 leading-relaxed">
              Sign in when you arrive and sign out before leaving
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E6ECF2] p-6 sm:p-8 space-y-5 shadow-xs">
            <Link
              href="/check-in?mode=returning"
              className="w-full min-h-[54px] px-6 py-3.5 rounded-xl bg-[#34526E] hover:bg-[#294259] active:scale-[0.99] text-white font-semibold text-base transition flex items-center justify-center gap-2.5 shadow-sm"
            >
              <span>For registered users</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <div className="pt-2 text-center">
              <Link
                href="/check-in?mode=new"
                className="inline-flex items-center justify-center min-h-[44px] px-2 text-base font-semibold text-[#34526E] hover:text-[#1E3A54] underline underline-offset-4 decoration-[#34526E]/50 hover:decoration-[#1E3A54] transition"
              >
                If you&apos;re new here, click here
              </Link>
            </div>
          </div>
        </div>

        <footer className="text-xs text-[#6B7A8C]">
          {HUB_NAME} (DAIH) &middot; Clock In
        </footer>
      </section>
    </main>
  );
}
