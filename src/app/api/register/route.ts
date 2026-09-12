import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { apiError, created, handleApi } from "@/lib/api/response";

export async function POST(request: Request) {
  return handleApi(async () => {
    const body = await request.json();
    const input = registerSchema.parse(body);

    const [existingEmail, existingUsername] = await Promise.all([
      prisma.user.findUnique({ where: { email: input.email } }),
      prisma.profile.findUnique({ where: { username: input.username } }),
    ]);

    if (existingEmail) {
      return apiError("An account with that email already exists.", 409, "EMAIL_TAKEN");
    }
    if (existingUsername) {
      return apiError("That username is already taken.", 409, "USERNAME_TAKEN");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    try {
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
          profile: {
            create: {
              username: input.username,
            },
          },
          preference: {
            create: {},
          },
        },
        select: { id: true, email: true, name: true },
      });

      return created(user);
    } catch (err) {
      // A concurrent signup can win the create race between our existence
      // checks above and this insert — fall back to the unique constraint.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target ?? "");
        if (target.includes("username")) {
          return apiError("That username is already taken.", 409, "USERNAME_TAKEN");
        }
        return apiError("An account with that email already exists.", 409, "EMAIL_TAKEN");
      }
      throw err;
    }
  });
}
