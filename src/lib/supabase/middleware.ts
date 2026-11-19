import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/config/env.config";
import { normalizeAdminRole } from "@/config/permissions.config";

const PUBLIC_ADMIN_AUTH_PATHS = new Set([
  "/admin/login",
  "/admin/reset-password",
  "/admin/update-password",
]);

export function isSupabaseConnectionConfigured(): boolean {
  const env = getClientEnv();
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project-ref.supabase.co") &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== "your-supabase-anon-public-key"
  );
}

/**
 * Refreshes the Supabase session cookie and guards protected `/admin/*` and `/api/v1/admin/*` routes.
 */
export async function updateSessionAndGuardRoutes(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;
  const isProtectedAdminPage =
    pathname.startsWith("/admin") && !PUBLIC_ADMIN_AUTH_PATHS.has(pathname);
  const isProtectedAdminApi = pathname.startsWith("/api/v1/admin");

  if (!isSupabaseConnectionConfigured()) {
    if (isProtectedAdminApi) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SUPABASE_NOT_CONFIGURED",
            message:
              "Supabase credentials are not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
          },
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        { status: 503 }
      );
    }

    if (isProtectedAdminPage) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("next", pathname);
      loginUrl.searchParams.set("setup", "required");
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  const env = getClientEnv();
  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && (isProtectedAdminPage || isProtectedAdminApi)) {
    if (isProtectedAdminApi) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHENTICATED",
            message: "Valid administrator session required.",
          },
          meta: {
            requestId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && (isProtectedAdminPage || isProtectedAdminApi)) {
    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("id, email, full_name, role, is_active, deleted_at")
      .eq("id", user.id)
      .maybeSingle();

    const canonicalRole = normalizeAdminRole(profile?.role);
    const isAuthorizedAdmin =
      Boolean(profile) &&
      profile?.is_active === true &&
      !profile?.deleted_at &&
      canonicalRole !== null;

    if (!isAuthorizedAdmin) {
      if (isProtectedAdminApi) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN_ADMIN_ACCESS",
              message:
                "Authenticated user does not have an active administrator profile.",
            },
            meta: {
              requestId: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
            },
          },
          { status: 403 }
        );
      }

      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/admin/login";
      loginUrl.searchParams.set("error", "unauthorized_admin");
      return NextResponse.redirect(loginUrl);
    }

    supabaseResponse.headers.set("x-insaf-admin-role", canonicalRole);
  }

  return supabaseResponse;
}
