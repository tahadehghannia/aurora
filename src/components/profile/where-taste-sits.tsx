"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  clusterOffset,
  describeLean,
  spokenPosition,
} from "@/components/profile/where-taste-sits-model";
import type { SpectrumExemplar, TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * Where your taste sits.
 *
 * The axis is the composition, not a bar with a value on it. Each dimension is
 * a field the user's own artwork sits inside, clustered at the end they lean
 * toward — so the pull is something you see before you read anything. The
 * marker settles into place rather than appearing at it.
 *
 * The numbers, labels and evidence are exactly the ones the taste model already
 * produced; nothing here recomputes taste, and the artwork is the same set of
 * items the position was measured from.
 */

function Artwork({
  exemplar,
  index,
  count,
  position,
  active,
  expanded,
  reduced,
}: {
  exemplar: SpectrumExemplar;
  index: number;
  count: number;
  position: number;
  active: boolean;
  expanded: boolean;
  reduced: boolean;
}) {
  return (
    <motion.div
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${clusterOffset(index, count, position)}%`, zIndex: 10 + index }}
      initial={{ opacity: 0, y: 8, scale: 0.94 }}
      animate={{
        opacity: active ? 1 : 0.82,
        y: 0,
        scale: expanded ? 1.18 : active ? 1.04 : 1,
      }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.8, delay: 0.25 + index * 0.07, ease: [0.22, 0.61, 0.36, 1] }
      }
    >
      <Link
        href={exemplar.href}
        tabIndex={expanded ? 0 : -1}
        title={exemplar.title}
        className="block overflow-hidden rounded-sm ring-1 ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="relative block h-14 w-10 sm:h-16 sm:w-11">
          <Image
            src={exemplar.imageUrl}
            alt=""
            fill
            sizes="44px"
            loading="lazy"
            className={cn("object-cover", !reduced && "dna-motion-zoom")}
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        </span>
      </Link>
    </motion.div>
  );
}

function Dimension({ spectrum, reduced }: { spectrum: TasteSpectrum; reduced: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const detailId = useId();

  const lean = describeLean(spectrum);
  const active = hovered || expanded;
  const { exemplars } = spectrum;


  return (
    <div
      className="border-b border-border/60 py-6 last:border-b-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {/* The poles. Weight, not colour, marks the side they sit on (§14). */}
        <div className="flex items-baseline justify-between gap-4">
          <span
            className={cn(
              "text-caption uppercase tracking-[0.18em] transition-colors duration-500",
              lean.leansRight === false ? "font-medium text-foreground" : "text-muted-foreground/60"
            )}
          >
            {spectrum.leftLabel}
          </span>
          <span
            className={cn(
              "text-caption uppercase tracking-[0.18em] transition-colors duration-500",
              lean.leansRight === true ? "font-medium text-foreground" : "text-muted-foreground/60"
            )}
          >
            {spectrum.rightLabel}
          </span>
        </div>

        {/* The field: artwork clustered where the taste pulls. */}
        <div
          className="relative mt-3 h-20 sm:h-24"
          role="img"
          aria-label={spokenPosition(spectrum)}
        >
          {exemplars.map((exemplar, index) => (
            <Artwork
              key={exemplar.id}
              exemplar={exemplar}
              index={index}
              count={exemplars.length}
              position={spectrum.position}
              active={active}
              expanded={expanded}
              reduced={reduced}
            />
          ))}
        </div>

        {/* The rail, and the marker that settles onto it. */}
        <div className="relative mt-1 h-4">
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
          <motion.span
            aria-hidden
            className="absolute top-1/2 h-px -translate-y-1/2 bg-brand/70"
            initial={{ left: "50%", right: "50%" }}
            animate={
              lean.leansRight
                ? { left: "50%", right: `${100 - spectrum.position}%` }
                : { left: `${spectrum.position}%`, right: "50%" }
            }
            transition={reduced ? { duration: 0 } : { duration: 1.2, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          />
          <motion.span
            aria-hidden
            className={cn(
              "absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand transition-transform",
              active && "scale-150"
            )}
            initial={{ left: "50%", opacity: 0 }}
            animate={{ left: `${spectrum.position}%`, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { duration: 1.2, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          />
        </div>

        {/* The reading, in words — never colour or position alone (§14, §23). */}
        <p className="mt-3 text-body-sm text-foreground">
          <span className="text-muted-foreground">{lean.strength} </span>
          <span className="font-medium">{lean.label}</span>
        </p>
      </button>

      <div
        id={detailId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500",
          expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          {/* Existing evidence, verbatim — nothing generated here. */}
          <p className="pt-2 text-caption text-muted-foreground">{spectrum.evidence}</p>
          <p className="pt-1 text-caption text-muted-foreground/70">
            Measured from {spectrum.sampleSize} {spectrum.sampleSize === 1 ? "title" : "titles"} in your library.
          </p>
          {exemplars.length > 0 && (
            <ul className="flex flex-wrap gap-x-3 gap-y-1 pt-2">
              {exemplars.map((exemplar) => (
                <li key={exemplar.id}>
                  <Link href={exemplar.href} className="text-caption text-muted-foreground hover:text-brand">
                    {exemplar.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function WhereTasteSits({ spectrums }: { spectrums: TasteSpectrum[] }) {
  const reduced = useReducedMotion() ?? false;
  if (spectrums.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="space-y-1">
        <h3 className="text-caption font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
          Where your taste sits
        </h3>
        <p className="text-body-sm text-muted-foreground">
          Four axes, measured from your own library. Neither end is better than the other.
        </p>
      </div>

      <div className="max-w-3xl">
        {spectrums.map((spectrum) => (
          <Dimension key={spectrum.key} spectrum={spectrum} reduced={reduced} />
        ))}
      </div>
    </section>
  );
}
