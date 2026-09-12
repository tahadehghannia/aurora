import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ok, handleApi } from "@/lib/api/response";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  return handleApi(async () => {
    const { email } = schema.parse(await request.json());

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way, regardless of whether the account exists —
    // this avoids leaking which emails are registered.
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires: new Date(Date.now() + 1000 * 60 * 30),
        },
      });
      // NOTE: no email provider is configured in this environment, so the
      // reset link is only logged server-side. Wire up a provider (e.g. Resend)
      // in this branch to ship this for real — the token/expiry/consumption
      // logic in /api/auth/reset-password is already production-ready.
      const resetUrl = `${process.env.AUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
      console.log(`[Aurora] Password reset requested for ${email}.\n  Reset link: ${resetUrl}`);
    }

    return ok({ message: "If an account exists for that email, we've sent a reset link." });
  });
}
