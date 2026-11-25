import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const HUB_NAME = 'Dare Adeboye Innovation Hub';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F9FB] flex flex-col justify-between p-4 sm:p-8">
      {/* Top Brand Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#34526E] text-white flex items-center justify-center font-bold text-sm">
            D
          </div>
          <div>
            <div className="font-bold text-[#111827] text-sm leading-tight">{HUB_NAME}</div>
            <div className="text-[11px] text-[#6B7A8C]">Clock In</div>
          </div>
        </div>
      </header>

      {/* Center Visitor Entry (zero staff login links visible to visitors) */}
      <div className="max-w-xl mx-auto w-full my-10">
        <div className="mb-6">
          <div className="text-[11px] font-semibold tracking-[0.08em] uppercase text-[#6B7A8C] mb-1">
            {HUB_NAME.toUpperCase()}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">Clock In</h1>
          <p className="text-sm text-[#6B7A8C] mt-1.5">
            Welcome to {HUB_NAME}. Proceed below to clock in or clock out.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-[#E6ECF2] p-6 sm:p-8">
          <Link
            href="/check-in"
            className="group p-6 sm:p-8 rounded-xl bg-[#EEF3F7] border border-[#DCE6EE] hover:border-[#34526E] transition flex flex-col justify-between gap-5"
          >
            <div>
              <div className="text-2xl font-bold text-[#111827]">Our visitors</div>
              <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                Register on your first visit, or enter your phone number to clock in.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-base font-semibold text-[#34526E] group-hover:translate-x-0.5 transition">
              Continue <ArrowRight className="w-5 h-5" />
            </div>
          </Link>
        </div>
      </div>

      <footer className="text-center text-xs text-[#6B7A8C] py-2">
        {HUB_NAME} &middot; Clock In
      </footer>
    </main>
  );
}
