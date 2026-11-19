"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setErrorMessage(
          payload?.error?.message ?? "Authentication failed. Please try again."
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrorMessage("Network error while communicating with authentication API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="default" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin Governance Portal
            </Badge>
            <Badge variant="outline">RBAC Enforced</Badge>
          </div>
          <CardTitle className="text-2xl">Administrator Sign In</CardTitle>
          <CardDescription>
            Sign in with your authorized <code>SUPER_ADMIN</code>,{" "}
            <code>VERIFICATION_ADMIN</code>, or <code>EDITOR_ADMIN</code>{" "}
            credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="admin-email"
                className="text-sm font-medium flex items-center gap-1.5"
              >
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email Address
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@insafjobcircular.com"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Password
                </label>
                <Link
                  href="/admin/reset-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="admin-password"
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying Credentials..." : "Sign In to Admin Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
