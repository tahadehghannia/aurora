import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { ok, apiError, handleApi } from "@/lib/api/response";

export async function POST(request: Request) {
  return handleApi(async () => {
    const { token, password } = resetPasswordSchema.parse(await request.json());

    const record = await prisma.verificationToken.findUnique({ where: { token } });

    if (!record || record.expires < new Date()) {
      // Clean up an expired-but-not-yet-purged token while we're here.
      if (record) await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
      return apiError("This reset link is invalid or has expired. Request a new one.", 400, "INVALID_TOKEN");
    }

    const user = await prisma.user.findUnique({ where: { email: record.identifier } });
    if (!user) {
      return apiError("This reset link is invalid or has expired. Request a new one.", 400, "INVALID_TOKEN");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Single-use: consume this token, and invalidate any other outstanding
      // reset links for the same email so an old, unused link can't be replayed.
      prisma.verificationToken.deleteMany({ where: { identifier: record.identifier } }),
    ]);

    return ok({ message: "Password updated. You can sign in with your new password." });
  });
}
