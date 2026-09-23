"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GRAIN_DATA_URI,
  isLandscapeSlot,
  LAYER_STYLE,
  PARALLAX_DEPTH,
  SLOTS,
} from "@/components/profile/dna-portrait-layout";
import { traitKey, type DnaPortrait, type PortraitItem } from "@/lib/taste/dna-portrait-types";

/**
 * Entertainment DNA as a living portrait.
 *
 * The composition IS the DNA — not a chart with animation applied to it. Every
 * artwork is something the user rated or saved, positioned by how strongly it
 * signals, and each one carries the traits it contributes to, so hovering,
 * filtering and selecting all move through real data rather than decoration.
 *
 * Motion discipline: one ambient animation per tile, most of the frame still,
 * nothing faster than the eye can ignore. All of it stops under
 * prefers-reduced-motion, and none of the information depends on it.
 */

const KIND_LABEL: Record<PortraitItem["kind"], string> = {
  movie: "Film",
  tv_show: "Series",
  album: "Album",
  artist: "Artist",
  song: "Song",
  episode: "Episode",
};

interface PointerOffset {
  x: number;
  y: number;
}

function TileMedia({ item, wide }: { item: PortraitItem; wide: boolean }) {
  // Backdrops are cinematic but only exist for film and TV; cover art falls
  // back to the poster rather than showing an empty frame (§27).
  const src = wide && item.backdropUrl ? item.backdropUrl : item.imageUrl;

  return (
    <>
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 40vw, 22vw"
        className={cn(
          "object-cover",
          item.motion === "zoom" && "dna-motion-zoom",
          item.motion === "drift" && "dna-motion-drift"
        )}
      />

      {/* A slow pass of light — the one thing alive on otherwise still art. */}
      {item.motion === "shimmer" && (
        <span
          aria-hidden
          className="dna-shimmer pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        />
      )}

      {/* Layered treatment rather than animating the whole image (§15). */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span
        aria-hidden
        className="dna-grain pointer-events-none absolute -inset-[4%] opacity-[0.10] mix-blend-overlay"
        style={{ backgroundImage: `url("${GRAIN_DATA_URI}")`, backgroundSize: "160px 160px" }}
      />
    </>
  );
}

interface TileProps {
  item: PortraitItem;
  index: number;
  pointer: PointerOffset;
  dimmed: boolean;
  emphasised: boolean;
  reduced: boolean;
  onSelect: (item: PortraitItem) => void;
  onHover: (id: string | null) => void;
}

function PortraitTile({ item, index, pointer, dimmed, emphasised, reduced, onSelect, onHover }: TileProps) {
  const slot = SLOTS[index] ?? SLOTS[SLOTS.length - 1]!;
  const layer = LAYER_STYLE[item.layer];
  const depth = PARALLAX_DEPTH[item.layer];
  // A landscape slot wants the backdrop; a tall one wants the poster.
  const wide = isLandscapeSlot(slot) && !!item.backdropUrl;

  return (
    <motion.button
      type="button"
      // Background tiles are dropped on small screens: fewer simultaneous
      // animations, and the composition still reads at 3-6 elements (§24).
      className={cn(
        "dna-tile group absolute cursor-pointer overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        // Fewer simultaneous animations and a far less crowded frame on small
        // screens; the composition still reads at five elements (§24).
        index >= 5 && "hidden sm:block"
      )}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: `${slot.w}%`,
        height: `${slot.h}%`,
        zIndex: emphasised ? 40 : layer.z,
        filter: `blur(${emphasised ? "0px" : layer.blur})`,
      }}
      initial={{ opacity: 0, scale: layer.scale * 0.94, y: 12 }}
      animate={{
        opacity: dimmed ? layer.opacity * 0.45 : layer.opacity,
        scale: emphasised ? layer.scale * 1.06 : layer.scale,
        // Nearer layers travel further, which is what reads as depth.
        x: pointer.x * depth,
        y: pointer.y * depth,
      }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              // The reveal staggers outward from the strongest signal (§34).
              opacity: { duration: 0.9, delay: index * 0.08 },
              scale: { type: "spring", stiffness: 180, damping: 26 },
              x: { type: "spring", stiffness: 120, damping: 30 },
              y: { type: "spring", stiffness: 120, damping: 30 },
            }
      }
      onClick={() => onSelect(item)}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(item.id)}
      onBlur={() => onHover(null)}
      aria-label={`${item.title} — ${KIND_LABEL[item.kind]}`}
    >
      <TileMedia item={item} wide={wide} />

      {/* Identification appears on hover/focus, never permanently (§11). */}
      <span
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 p-2 text-left transition-opacity duration-300",
          emphasised ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="block truncate text-caption font-medium text-white">{item.title}</span>
        <span className="block truncate text-[10px] uppercase tracking-wide text-white/70">
          {KIND_LABEL[item.kind]}
          {item.traits[0] ? ` · ${item.traits[0]}` : ""}
        </span>
      </span>
    </motion.button>
  );
}

function DetailPanel({ item, onClose }: { item: PortraitItem; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.35 }}
      className="mx-auto w-full max-w-md rounded-lg border border-border bg-card/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label={`${item.title} details`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">{KIND_LABEL[item.kind]}</p>
          <p className="truncate text-h6 font-semibold text-foreground">{item.title}</p>
          {item.subtitle && <p className="truncate text-body-sm text-muted-foreground">{item.subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      {item.traits.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.traits.map((trait) => (
            <span key={trait} className="rounded-full border border-border px-2.5 py-0.5 text-caption text-muted-foreground">
              {trait}
            </span>
          ))}
        </div>
      )}

      {/* The link from artwork to trait to evidence — the point of the whole
          interaction (§12, §18). */}
      <p className="mt-3 text-body-sm text-foreground">{item.reason}</p>

      <Link
        href={item.href}
        className="mt-3 inline-flex items-center gap-1 text-body-sm font-medium text-brand hover:underline"
      >
        Open
        <ArrowUpRight size={14} aria-hidden />
      </Link>
    </motion.div>
  );
}

/**
 * Whether the device has a fine pointer (a mouse), as an external store.
 *
 * Coarse pointers get no parallax at all — there is nothing to track, and the
 * listener would only cost work (§10, §24). Read through useSyncExternalStore
 * rather than an effect so the first client render already has the right
 * answer instead of flipping a frame later.
 */
function usePointerFine(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(pointer: fine)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(pointer: fine)").matches,
    // The server can't know; assume no pointer so nothing animates before hydration.
    () => false
  );
}

export function DnaPortraitStage({ portrait }: { portrait: DnaPortrait }) {
  const reduced = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const [pointer, setPointer] = useState<PointerOffset>({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<PortraitItem | null>(null);
  const [activeTrait, setActiveTrait] = useState<string | null>(null);

  const handlePointer = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Normalised to -1..1 from the centre; multiplied by each layer's depth.
    setPointer({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 2,
    });
  }, []);

  const fine = usePointerFine();
  const parallaxOn = fine && !reduced;

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const { items, traits } = portrait;

  const matchesTrait = (item: PortraitItem) =>
    !activeTrait || item.traits.some((trait) => traitKey(trait) === activeTrait);

  return (
    <section className="space-y-5">
      <div
        ref={stageRef}
        onMouseMove={parallaxOn ? handlePointer : undefined}
        onMouseLeave={parallaxOn ? () => setPointer({ x: 0, y: 0 }) : undefined}
        className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-border bg-black sm:aspect-[16/10]"
      >
        {/* Ambient ground: a slow vignette breath, nothing more (§20). */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.85)_100%)]",
            !reduced && "dna-breathe"
          )}
        />

        {items.map((item, index) => (
          <PortraitTile
            key={item.id}
            item={item}
            index={index}
            pointer={parallaxOn ? pointer : { x: 0, y: 0 }}
            reduced={reduced}
            dimmed={!matchesTrait(item) || (hovered !== null && hovered !== item.id)}
            emphasised={hovered === item.id || selected?.id === item.id}
            onSelect={setSelected}
            onHover={setHovered}
          />
        ))}

        {/* Still-forming portraits show their gaps rather than borrowing
            someone else's taste to fill them (§35). */}
        {Array.from({ length: portrait.openSlots }).map((_, i) => {
          const slot = SLOTS[items.length + i] ?? SLOTS[SLOTS.length - 1]!;
          return (
            <span
              key={`open-${i}`}
              aria-hidden
              className="absolute z-10 rounded-sm border border-dashed border-white/10"
              style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}
            />
          );
        })}

        {/* A scrim under the identity. Without it the copy sits directly on
            artwork and becomes unreadable wherever a light poster lands behind
            it — which is exactly what happens on narrow screens, where the
            centre gap is only a hundred or so pixels wide. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[35] bg-[radial-gradient(ellipse_74%_52%_at_50%_50%,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.84)_45%,transparent_80%)] sm:bg-[radial-gradient(ellipse_44%_34%_at_50%_50%,rgba(0,0,0,0.9)_0%,rgba(0,0,0,0.7)_45%,transparent_80%)]"
        />

        {/* The centre stays calm while everything around it moves (§19), and
            steps aside when a selection takes its place. */}
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: selected ? 0 : 1, y: 0 }}
            transition={reduced ? { duration: 0 } : { duration: selected ? 0.3 : 1.2, delay: selected ? 0 : 0.5 }}
            className="max-w-sm text-center"
          >
            <p className="text-caption uppercase tracking-[0.2em] text-white/60">Your entertainment identity</p>
            <p className="mt-1.5 text-h4 font-semibold tracking-tight text-white drop-shadow-lg sm:text-h3">
              {portrait.identityName ?? "Taking shape"}
            </p>
            {/* Clamped on small screens: a five-line paragraph over artwork
                crowds the frame, and the full text is a tap away on Taste. */}
            {portrait.identityDescription && (
              <p className="mx-auto mt-2 line-clamp-2 max-w-xs text-body-sm text-white/75 drop-shadow sm:line-clamp-none">
                {portrait.identityDescription}
              </p>
            )}
            {portrait.identityTraits.length > 0 && (
              <p className="mt-2.5 text-caption text-white/60">{portrait.identityTraits.join(" · ")}</p>
            )}
          </motion.div>
        </div>

        {/* Selection resolves to the centre — the same place the identity sits,
            so the artwork and the identity occupy one focal point (§12). */}
        <AnimatePresence mode="wait">
          {selected && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
              <DetailPanel key={selected.id} item={selected} onClose={() => setSelected(null)} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Filtering by trait brings the related artwork forward (§13). */}
      {traits.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter your DNA by trait">
          {traits.map((trait) => {
            const active = activeTrait === trait.key;
            return (
              <button
                key={trait.key}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTrait(active ? null : trait.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-brand hover:text-foreground"
                )}
              >
                {trait.label}
                <span className="ml-1.5 text-muted-foreground/70">{trait.count}</span>
              </button>
            );
          })}
          {activeTrait && (
            <button
              type="button"
              onClick={() => setActiveTrait(null)}
              className="px-2 py-1.5 text-caption text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Show all
            </button>
          )}
        </div>
      )}

    </section>
  );
}
