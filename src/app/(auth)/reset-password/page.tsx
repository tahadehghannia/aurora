import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  const record = token ? await prisma.verificationToken.findUnique({ where: { token } }) : null;
  const isValid = !!record && record.expires > new Date();

  if (!isValid) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
          <KeyRound size={22} />
        </div>
        <div className="space-y-1">
          <p className="text-body-md font-medium">This link is invalid or has expired</p>
          <p className="text-body-sm text-muted-foreground">
            Reset links expire after 30 minutes. Request a new one to continue.
          </p>
        </div>
        <Link href="/forgot-password" className="text-body-sm font-medium text-foreground hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token!} />;
}
