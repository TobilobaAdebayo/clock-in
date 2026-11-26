import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] w-full bg-[#F7F9FB] flex flex-col lg:grid lg:grid-cols-2 overflow-x-hidden">
      {/* Left Side: Clean Workspace Hero Image (no text overlay) */}
      <section className="relative bg-[#243B53] h-36 sm:h-52 lg:h-auto lg:min-h-screen w-full flex-shrink-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/workspace-hero.svg"
          alt={`${HUB_NAME} workspace`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </section>

      {/* Right Side: Visitor Sign-In Entry (zero staff login links visible) */}
      <section className="flex-1 flex flex-col justify-between px-4 py-4 sm:px-10 sm:py-10 lg:px-16 lg:py-14 bg-[#F7F9FB]">
        <header className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            D
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#111827] text-xs sm:text-sm leading-tight">
              {HUB_NAME}
            </div>
            <div className="text-[11px] text-[#6B7A8C]">Our visitors &middot; Clock In</div>
          </div>
        </header>

        <div className="w-full max-w-md mx-auto my-4 sm:my-6 lg:my-0">
          <div className="mb-4 sm:mb-6">
            <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1">
              OUR VISITORS
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#111827] leading-[1.15]">
              Welcome to {HUB_NAME} (DAIH)
            </h1>
            <p className="text-sm sm:text-base text-[#6B7A8C] mt-2 sm:mt-3 leading-relaxed">
              Sign in when you arrive and sign out before leaving
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E6ECF2] p-4 sm:p-8 space-y-3.5 sm:space-y-5 shadow-xs">
            <Link
              href="/check-in?mode=returning"
              className="w-full min-h-[50px] sm:min-h-[54px] px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-[#34526E] hover:bg-[#294259] active:scale-[0.99] text-white font-semibold text-base transition flex items-center justify-center gap-2.5 shadow-sm"
            >
              <span>For registered users</span>
              <ArrowRight className="w-5 h-5 flex-shrink-0" />
            </Link>

            <div className="pt-1 sm:pt-2 text-center">
              <Link
                href="/check-in?mode=new"
                className="inline-flex items-center justify-center min-h-[44px] px-2 text-sm sm:text-base font-semibold text-[#34526E] hover:text-[#1E3A54] underline underline-offset-4 decoration-[#34526E]/50 hover:decoration-[#1E3A54] transition"
              >
                If you&apos;re new here, click here
              </Link>
            </div>
          </div>
        </div>

        <footer className="text-xs text-[#6B7A8C] pt-2">
          {HUB_NAME} (DAIH) &middot; Clock In
        </footer>
      </section>
    </main>
  );
}
