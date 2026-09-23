import "server-only";
import { z } from "zod";
import { enhance, evidenceBlock } from "@/lib/ai/enhance";
import { IDENTITY_PROMPT } from "@/lib/ai/prompts";
import type { EntertainmentIdentity, TasteSpectrum } from "@/lib/taste/identity-types";

/**
 * AI wording for the Entertainment Identity (§6, §7).
 *
 * The archetype itself is NOT chosen by the model. Aurora matches it from
 * measured spectrums, and the model is given the result and asked to describe
 * it. That split matters: the claim "you are an Atmospheric Thinker" is
 * auditable arithmetic over the user's library, and only the sentence around it
 * is generated.
 */

export const aiIdentitySchema = z.object({
  description: z.string().trim().min(10).max(320),
  traits: z.array(z.string().trim().min(2).max(24)).max(4).default([]),
  emergingTraits: z.array(z.string().trim().min(2).max(24)).max(2).default([]),
});

export type AiIdentity = z.infer<typeof aiIdentitySchema>;

/**
 * Phrasings that turn a taste description into a personality or health claim (§7).
 *
 * Split into two alternations on purpose: the phrases need word boundaries so
 * "you are" doesn't fire inside another word, while the stems must NOT have a
 * trailing boundary — `\bdepress\b` never matches "depressed", which is the
 * form a model would actually write.
 */
const PERSONALITY_PHRASES = /\b(?:you are|you're a|your personality|as a person|kind of person)\b/i;
const SENSITIVE_STEMS = /psycholog|mental health|depress|anxious|anxiety|neurodiver|trauma|suicid|therapy|disorder/i;

function mentionsSensitiveClaim(text: string): boolean {
  return PERSONALITY_PHRASES.test(text) || SENSITIVE_STEMS.test(text);
}

/**
 * Rejects output that drifted from describing taste into describing the person.
 *
 * The prompt forbids it, but a prompt is a request, not a guarantee — and this
 * is the one failure mode where shipping the text anyway would be actively
 * harmful rather than merely wrong.
 */
export function isSafeIdentityCopy(candidate: AiIdentity): boolean {
  if (mentionsSensitiveClaim(candidate.description)) return false;
  return [...candidate.traits, ...candidate.emergingTraits].every((trait) => !mentionsSensitiveClaim(trait));
}

function describeSpectrum(spectrum: TasteSpectrum): string {
  const side =
    spectrum.position > 60 ? spectrum.rightLabel : spectrum.position < 40 ? spectrum.leftLabel : "balanced";
  return `${spectrum.leftLabel} vs ${spectrum.rightLabel}: leans ${side} (${spectrum.position}/100, measured from ${spectrum.sampleSize} titles)`;
}

/** Compact evidence only — never raw rows, never profile fields (§20, §21, §31). */
export function buildIdentityEvidence(identity: EntertainmentIdentity): string {
  return [
    `Archetype Aurora matched: ${identity.archetype.name}`,
    `Aurora's own summary of it: ${identity.archetype.summary}`,
    `Match confidence: ${identity.confidence}`,
    "",
    evidenceBlock([
      { label: "Measured taste spectrums", lines: identity.spectrums.map(describeSpectrum) },
      { label: "Countable facts from their library", lines: identity.evidence.map((e) => e.text) },
      { label: "Strongest mood signals", lines: identity.traits },
    ]),
  ].join("\n");
}

export async function generateIdentityCopy(
  userId: string,
  identity: EntertainmentIdentity,
  options: { force?: boolean } = {}
) {
  const result = await enhance({
    userId,
    kind: "IDENTITY",
    prompt: IDENTITY_PROMPT,
    schema: aiIdentitySchema,
    ...(options.force === undefined ? {} : { force: options.force }),
    buildUser: () => buildIdentityEvidence(identity),
  });

  if (!result) return null;
  // A cached artifact is re-checked too: the guard may have tightened since.
  if (!isSafeIdentityCopy(result.data)) return null;
  return result;
}
