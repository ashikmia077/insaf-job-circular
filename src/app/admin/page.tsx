import { redirect } from "next/navigation";
import { getCurrentAdminContext } from "@/lib/supabase/session";
import {
  normalizeAdminRole,
  ROLE_PERMISSION_MATRIX,
} from "@/config/permissions.config";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminGatePage() {
  const admin = await getCurrentAdminContext();
  const canonicalRole = normalizeAdminRole(admin?.role);

  if (!admin || !admin.isActive || !canonicalRole) {
    redirect("/admin/login");
  }

  const permissions = ROLE_PERMISSION_MATRIX[canonicalRole];

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Insaf Job Circular — Governance Session Verified
            </h1>
            <p className="text-sm text-muted-foreground">
              Signed in as {admin.fullName ?? admin.email} ({admin.email})
            </p>
          </div>
          <Badge variant="default" className="font-mono">
            {canonicalRole}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Server-Enforced Permissions
            </CardTitle>
            <CardDescription>
              Enforced on Next.js API routes, Service Layer, and PostgreSQL RLS
              policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {permissions.map((perm) => (
              <Badge key={perm} variant="secondary" className="font-mono">
                {perm}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
