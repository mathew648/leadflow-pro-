import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public marketing + auth + customer-portal paths. The dashboard is guarded
// client-side via AuthGuard, so the middleware just lets everything through —
// the marketing home (/) is now public instead of redirecting to the dashboard.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
