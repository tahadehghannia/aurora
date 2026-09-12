"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { fetchJson } from "@/lib/api/client";

interface Preference {
  mutedGenres: string[];
  mutedMoods: string[];
  mutedCreators: string[];
  boostedMoods: string[];
}

interface SettingsFormProps {
  name: string;
  bio: string;
  username: string;
  isPublic: boolean;
  showRatingsPublicly: boolean;
  showActivityPublicly: boolean;
  showCollectionsPublicly: boolean;
  showTasteDataPublicly: boolean;
  preference: Preference;
}

function creatorLabel(key: string): string {
  if (key.startsWith("director:")) return key.slice("director:".length);
  if (key.startsWith("artist:")) return "Artist";
  return key;
}

export function SettingsForm({
  name: initialName,
  bio: initialBio,
  username,
  isPublic: initialIsPublic,
  showRatingsPublicly: initialShowRatings,
  showActivityPublicly: initialShowActivity,
  showCollectionsPublicly: initialShowCollections,
  showTasteDataPublicly: initialShowTasteData,
  preference: initialPreference,
}: SettingsFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [showRatings, setShowRatings] = useState(initialShowRatings);
  const [showActivity, setShowActivity] = useState(initialShowActivity);
  const [showCollections, setShowCollections] = useState(initialShowCollections);
  const [showTasteData, setShowTasteData] = useState(initialShowTasteData);
  const [preference, setPreference] = useState(initialPreference);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          bio,
          isPublic,
          showRatingsPublicly: showRatings,
          showActivityPublicly: showActivity,
          showCollectionsPublicly: showCollections,
          showTasteDataPublicly: showTasteData,
        }),
      });
      if (!res.ok) throw new Error("Couldn't save your changes.");
      toast.success("Profile updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const unmute = async (type: "genre" | "creator" | "mood", value: string) => {
    try {
      await fetchJson("/api/taste/mute", { method: "POST", body: JSON.stringify({ type, value, muted: false }) });
      setPreference((p) => ({
        ...p,
        mutedGenres: type === "genre" ? p.mutedGenres.filter((v) => v !== value) : p.mutedGenres,
        mutedMoods: type === "mood" ? p.mutedMoods.filter((v) => v !== value) : p.mutedMoods,
        mutedCreators: type === "creator" ? p.mutedCreators.filter((v) => v !== value) : p.mutedCreators,
      }));
    } catch {
      toast.error("Couldn't update that — try again.");
    }
  };

  const resetAll = async () => {
    setResetting(true);
    try {
      await fetchJson("/api/taste/reset", { method: "POST" });
      setPreference({ mutedGenres: [], mutedMoods: [], mutedCreators: [], boostedMoods: [] });
      toast.success("Recommendation preferences reset.");
    } catch {
      toast.error("Couldn't reset — try again.");
    } finally {
      setResetting(false);
    }
  };

  const hasOverrides =
    preference.mutedGenres.length > 0 || preference.mutedMoods.length > 0 || preference.mutedCreators.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <p className="text-body-sm font-medium">Theme</p>
          <p className="text-caption text-muted-foreground">Switch between light and dark.</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Name</Label>
          <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="settings-bio">Bio</Label>
          <Textarea id="settings-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-body-sm font-medium">Privacy</p>
          <Link
            href={`/u/${username}`}
            className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
          >
            View public profile
            <ExternalLink size={12} />
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <p id="privacy-public" className="text-body-sm font-medium">
              Public profile
            </p>
            <p className="text-caption text-muted-foreground">Let other Aurora members find and view your profile.</p>
          </div>
          <Switch checked={isPublic} onCheckedChange={setIsPublic} aria-labelledby="privacy-public" />
        </div>

        {isPublic && (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card px-4">
            <div className="flex items-center justify-between py-3">
              <p id="privacy-taste" className="text-body-sm text-foreground">
                Entertainment DNA, Mood Profile &amp; Taste Evolution
              </p>
              <Switch
                checked={showTasteData}
                onCheckedChange={setShowTasteData}
                aria-labelledby="privacy-taste"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <p id="privacy-ratings" className="text-body-sm text-foreground">
                Ratings &amp; Favorites
              </p>
              <Switch
                checked={showRatings}
                onCheckedChange={setShowRatings}
                aria-labelledby="privacy-ratings"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <p id="privacy-collections" className="text-body-sm text-foreground">
                Collections &amp; Playlists
              </p>
              <Switch
                checked={showCollections}
                onCheckedChange={setShowCollections}
                aria-labelledby="privacy-collections"
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <p id="privacy-activity" className="text-body-sm text-foreground">
                Activity Journal
              </p>
              <Switch
                checked={showActivity}
                onCheckedChange={setShowActivity}
                aria-labelledby="privacy-activity"
              />
            </div>
          </div>
        )}
      </div>

      <Button onClick={submit} disabled={submitting} className="self-start">
        {submitting && <Loader2 className="animate-spin" size={16} />}
        Save changes
      </Button>

      <div className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <p className="text-body-sm font-medium">Recommendation preferences</p>
          {hasOverrides && (
            <Button variant="ghost" size="sm" onClick={resetAll} disabled={resetting}>
              {resetting && <Loader2 className="animate-spin" size={14} />}
              Reset all
            </Button>
          )}
        </div>

        {!hasOverrides ? (
          <p className="text-caption text-muted-foreground">
            No muted genres, moods or creators. Use &ldquo;Hide creator&rdquo; or &ldquo;Not for me&rdquo; anywhere in Aurora to
            fine-tune your recommendations.
          </p>
        ) : (
          <div className="space-y-3">
            {preference.mutedGenres.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-caption text-muted-foreground">Muted genres</p>
                <div className="flex flex-wrap gap-1.5">
                  {preference.mutedGenres.map((g) => (
                    <button
                      key={g}
                      onClick={() => unmute("genre", g)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground"
                    >
                      {g} <X size={11} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {preference.mutedMoods.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-caption text-muted-foreground">Muted moods</p>
                <div className="flex flex-wrap gap-1.5">
                  {preference.mutedMoods.map((m) => (
                    <button
                      key={m}
                      onClick={() => unmute("mood", m)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground"
                    >
                      {m} <X size={11} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            {preference.mutedCreators.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-caption text-muted-foreground">Hidden creators</p>
                <div className="flex flex-wrap gap-1.5">
                  {preference.mutedCreators.map((c) => (
                    <button
                      key={c}
                      onClick={() => unmute("creator", c)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-caption text-muted-foreground hover:text-foreground"
                    >
                      {creatorLabel(c)} <X size={11} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
