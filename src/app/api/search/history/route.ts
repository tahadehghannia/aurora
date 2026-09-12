import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/session";
import { ok, unauthorized, handleApi } from "@/lib/api/response";

export async function GET() {
  return handleApi(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorized();

    const recent = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { query: true },
    });

    const unique = [...new Set(recent.map((r) => r.query))].slice(0, 6);
    return ok(unique);
  });
}
