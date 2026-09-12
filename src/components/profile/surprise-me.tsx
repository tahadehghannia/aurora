"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shuffle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { CONTENT_ROUTE } from "@/types/content";
import type { SurpriseDiscovery } from "@/lib/taste/surprise";

export function SurpriseMe() {
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [result, setResult] = useState<SurpriseDiscovery | null>(null);

  const go = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<SurpriseDiscovery | null>("/api/taste/surprise");
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setHasFetched(true);
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3">
      {!hasFetched && (
        <Button variant="outline" size="sm" onClick={go} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
          Surprise me
        </Button>
      )}
      {hasFetched && !result && (
        <p className="text-body-sm text-muted-foreground">
          Not enough taste signal yet to surprise you responsibly — rate a few more things first.
        </p>
      )}
      {result && (
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
            {result.card.imageUrl && <Image src={result.card.imageUrl} alt="" fill sizes="44px" className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/${CONTENT_ROUTE[result.card.kind]}/${result.card.slug}`} className="text-body-sm font-medium text-foreground hover:underline">
              {result.card.title}
            </Link>
            <p className="text-caption text-muted-foreground">{result.reason}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={go} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
          </Button>
        </div>
      )}
    </section>
  );
}
