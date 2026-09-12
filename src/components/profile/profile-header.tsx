"use client";

import Link from "next/link";
import { Settings, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface ProfileHeaderProps {
  name: string;
  username: string;
  bio: string | null;
  image: string | null;
  memberSince: Date;
  isOwnProfile: boolean;
  counts: { ratings: number; saved: number; collections: number; playlists: number };
  /** Rendered on the right for a viewed (not own) profile — e.g. a Follow button. */
  socialAction?: React.ReactNode;
}

export function ProfileHeader({ name, username, bio, image, memberSince, isOwnProfile, counts, socialAction }: ProfileHeaderProps) {
  const initials = (name || username || "?").slice(0, 2).toUpperCase();
  const memberYear = memberSince.getFullYear();

  const share = async () => {
    const url = `${window.location.origin}/u/${username}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${name} on Aurora`, url });
      } catch {
        /* user cancelled */
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Profile link copied.");
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
      <Avatar className="h-20 w-20 shrink-0">
        {image && <AvatarImage src={image} alt="" />}
        <AvatarFallback className="text-h5">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-h4 font-semibold">{name}</h1>
            <p className="text-body-sm text-muted-foreground">@{username}</p>
          </div>
          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <>
                <Button variant="ghost" size="sm" onClick={share}>
                  <Share2 size={15} />
                  Share
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/profile/settings" />}>
                  <Settings size={15} />
                  Edit profile
                </Button>
              </>
            ) : (
              socialAction
            )}
          </div>
        </div>

        {bio && <p className="max-w-md text-body-sm text-foreground">{bio}</p>}

        <p className="text-caption text-muted-foreground">Member since {memberYear}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-body-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{counts.ratings}</span> rating{counts.ratings === 1 ? "" : "s"}
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span>
            <span className="font-medium text-foreground">{counts.saved}</span> saved
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span>
            <span className="font-medium text-foreground">{counts.collections}</span> collection
            {counts.collections === 1 ? "" : "s"}
          </span>
          <span aria-hidden className="text-border">
            ·
          </span>
          <span>
            <span className="font-medium text-foreground">{counts.playlists}</span> playlist
            {counts.playlists === 1 ? "" : "s"}
          </span>
        </div>
      </div>
    </div>
  );
}
