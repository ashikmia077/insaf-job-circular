"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        setErrorMessage(
          payload?.error?.message ?? "Unable to process password reset request."
        );
        return;
      }

      setStatusMessage(payload.data.message);
    } catch {
      setErrorMessage("Network error while requesting password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-xl">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset Administrator Password
          </CardTitle>
          <CardDescription>
            Enter your administrator email address to receive a secure password
            recovery link.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleReset} className="space-y-4">
            {statusMessage && (
              <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>{statusMessage}</span>
              </div>
            )}
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
              <label htmlFor="reset-email" className="text-sm font-medium">
                Administrator Email
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@insafjobcircular.com"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending Recovery Link..." : "Send Password Reset Link"}
            </Button>
          </form>

          <div className="pt-2">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Administrator Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
