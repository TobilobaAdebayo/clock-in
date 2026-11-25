import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F7F9FB] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E6ECF2] p-8 space-y-4">
        <div className="w-14 h-14 bg-[#EEF3F7] text-[#34526E] rounded-2xl flex items-center justify-center mx-auto font-bold text-xl">
          404
        </div>
        <h1 className="text-2xl font-bold text-[#111827]">Page Not Found</h1>
        <p className="text-sm text-[#6B7A8C]">
          The page you are looking for does not exist in Dare Adeboye Innovation Hub&apos;s Clock In portal.
        </p>
        <div className="pt-2">
          <Link
            href="/check-in"
            className="inline-block w-full py-2.5 px-4 bg-[#34526E] hover:bg-[#294259] text-white text-sm font-semibold rounded-lg transition"
          >
            Our visitors
          </Link>
        </div>
      </div>
    </main>
  );
}
