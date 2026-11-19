"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Database,
  Cpu,
  BellRing,
  FileCheck2,
  Lock,
  Layers,
  Megaphone,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { siteConfig } from "@/config/site.config";
import { CANONICAL_ADMIN_ROLES } from "@/config/permissions.config";

const architecturePillars = [
  {
    icon: ShieldCheck,
    title: "Multi-Admin RBAC & Audit Trail",
    description:
      "3 canonical governance roles (SUPER_ADMIN, EDITOR_ADMIN, VERIFICATION_ADMIN) enforced via Server Services, PostgreSQL RLS, and append-only audit_logs.",
    status: "Phase 2 Active",
  },
  {
    icon: Cpu,
    title: "Python Worker + Redis Queue",
    description:
      "Polite, robots.txt-compliant background collector, AI OCR/NLP extraction pipeline, and SHA-256 + canonical fingerprint deduplication.",
    status: "Worker Blueprint Ready",
  },
  {
    icon: FileCheck2,
    title: "Official Notice Verification",
    description:
      "PDF/image notice management in Supabase Storage with SHA-256 integrity checks and deterministic auto-publish eligibility rules.",
    status: "Verification Service Ready",
  },
  {
    icon: BellRing,
    title: "PWA + FCM Deadline Alerts",
    description:
      "Installable Web App manifest, Service Worker push listener, and Firebase Cloud Messaging topic architecture for deadline reminders.",
    status: "PWA Shell Ready",
  },
  {
    icon: Database,
    title: "Supabase 20-Table Schema + RLS",
    description:
      "Complete 20-table relational model (jobs, categories, organizations, sources, notices, verifications, updates, profiles, audit_logs) with 5 SQL migrations.",
    status: "5 SQL Migrations Ready",
  },
  {
    icon: Megaphone,
    title: "Insaf Computer Ad Engine",
    description:
      "First-party placement slot management and privacy-safe impression/click tracking for Insaf Computer digital services.",
    status: "Domain Schema Ready",
  },
];

export function ArchitectureShell() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container py-10 md:py-16 space-y-10">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">
              Phase 2 — Database, Auth & Multi-Admin Governance
            </Badge>
            <Badge variant="secondary">Next.js 14 + TypeScript</Badge>
            <Badge variant="outline">Branch: dev</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {siteConfig.name}{" "}
            <span className="text-muted-foreground font-normal">
              ({siteConfig.bengaliName})
            </span>
          </h1>
          <p className="max-w-3xl text-muted-foreground text-base md:text-lg">
            Phase 2 Database Foundation (20 tables, 5 migrations, immutable
            audit triggers), Supabase Authentication Middleware, RBAC
            Enforcement, and 7 Modular Domain Services initialized.
          </p>
        </motion.section>

        <Separator />

        <section aria-labelledby="pillars-heading" className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="pillars-heading" className="text-xl font-semibold">
              Initialized System Architecture Modules
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {architecturePillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.05 }}
                >
                  <Card className="h-full flex flex-col justify-between">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-md bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" />
                          {pillar.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{pillar.title}</CardTitle>
                      <CardDescription>{pillar.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="security-posture-heading"
          className="grid gap-4 md:grid-cols-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-primary" />
                Configured RBAC Roles
              </CardTitle>
              <CardDescription>
                Defined in <code>src/config/permissions.config.ts</code> and
                mirrored in PostgreSQL ENUM <code>admin_role</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {CANONICAL_ADMIN_ROLES.map((role) => (
                <Badge key={role} variant="outline" className="font-mono">
                  {role}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Target Bangladesh Job Taxonomy
              </CardTitle>
              <CardDescription>
                Defined in <code>src/config/site.config.ts</code> for structured
                filtering and FCM topic subscriptions.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {siteConfig.categories.map((cat) => (
                <Badge key={cat.slug} variant="secondary">
                  {cat.labelEn} · {cat.labelBn}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
