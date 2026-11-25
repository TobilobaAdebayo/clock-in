import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware (UX layer only).
 * Note: Staff auth refresh cookies are HttpOnly and path-scoped to `/api/v1/auth`,
 * so client-side UX route gating is handled in `(staff)/layout.tsx` and `(admin)/layout.tsx`,
 * while the Express backend remains the authoritative RBAC gate on every `/api/v1/*` request.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.svg).*)'],
};
