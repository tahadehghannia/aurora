import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/components/profile/settings-form";

export const metadata: Metadata = { title: "Settings · Profile" };

export default async function ProfileSettingsPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
    prisma.userPreference.findUnique({ where: { userId } }),
  ]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8 sm:px-8">
      <h1 className="text-h4 font-semibold">Settings</h1>
      <SettingsForm
        name={user?.name ?? ""}
        bio={user?.profile?.bio ?? ""}
        username={user?.profile?.username ?? ""}
        isPublic={user?.profile?.isPublic ?? true}
        showRatingsPublicly={user?.profile?.showRatingsPublicly ?? true}
        showActivityPublicly={user?.profile?.showActivityPublicly ?? true}
        showCollectionsPublicly={user?.profile?.showCollectionsPublicly ?? true}
        showTasteDataPublicly={user?.profile?.showTasteDataPublicly ?? true}
        preference={{
          mutedGenres: preference?.mutedGenres ?? [],
          mutedMoods: preference?.mutedMoods ?? [],
          mutedCreators: preference?.mutedCreators ?? [],
          boostedMoods: preference?.boostedMoods ?? [],
        }}
      />
    </div>
  );
}
