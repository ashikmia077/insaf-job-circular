import type { NextRequest } from "next/server";
import { updateSessionAndGuardRoutes } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSessionAndGuardRoutes(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/v1/admin/:path*",
  ],
};
