"use client";

import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

interface FollowButtonProps {
  userId: string;
  initialFollowing: boolean;
}

export function FollowButton({ userId, initialFollowing }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    setPending(true);
    const next = !following;
    try {
      await fetchJson("/api/follow", { method: next ? "POST" : "DELETE", body: JSON.stringify({ userId }) });
      setFollowing(next);
    } catch {
      toast.error("Couldn't update that — try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant={following ? "outline" : "default"} size="sm" onClick={toggle} disabled={pending}>
      {following ? <Check size={14} /> : <UserPlus size={14} />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
