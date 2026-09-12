# Entertainment Identity — Research & UX Strategy

Research conducted before designing Aurora's Entertainment Identity system. The
goal was to understand *why* personality-discovery products create a feeling of
self-recognition, and which of those mechanics transfer honestly to a product
built on observed behaviour rather than self-report.

## 1. Products studied

| Product | Onboarding | Progress | Reveal | Identity | Explanation | Traits | Visualization | Shareability | Post-result exploration | Retention | Mobile | Strength | Weakness |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **16Personalities** | Zero-friction, no signup to start | Continuous bar through a single long question set | Immediate, no paywall on the core result | 4-letter code + evocative archetype name ("Turbulent Campaigner") | Long-form prose per type | 5 dimensions shown as 0–100 percentage splits rather than binaries | Horizontal percentage bars per dimension | Type code is a compact, memorable token people put in bios | Thousands of words: strengths, relationships, career, workplace | Type becomes an identity label users return to and re-read | Fully responsive, reads as a long article | Result feels immediately legible and shareable; percentage splits avoid crude binaries | Prose is broad enough to invite the Barnum effect; hard to tell what is *you* vs. what is everyone |
| **Truity TypeFinder** | Credibility-first: social proof ("519,039 tests taken in the last 30 days"), medical review, media citations | Explicit chunking — "Step 1 of 8" across ~130 questions | Free overview, then a soft paywall for the full report | MBTI-style type | Overview free, depth paid | Dimension scores | Basic bars | Lower — the good stuff is gated | Specialised reports (career, team) | Account creation to "view your results at any time" | Responsive | Chunked progress makes a long assessment feel finite; social proof builds trust before effort | Gating the explanation undercuts the moment of recognition |
| **Personality Hacker** | Reframes MBTI cognitive functions as "Genius Styles" | — | — | Evocative labels instead of jargon ("Perspectives/Harmony") | Growth-oriented: blind spots, leverage points | Cognitive functions renamed to be learnable | — | Distinctive vocabulary | Exercises and development paths per type | Positions identity as *evolving*, not fixed — a reason to come back | Responsive | Naming is the whole product: replacing jargon with evocative language lowers the barrier to entry | Requires buying into a bespoke vocabulary |
| **MBTI (official)** | Practitioner-administered, formal | — | Delivered in a session | 4-letter type | Practitioner-led interpretation | 4 dichotomies | — | Low | Workshops | Institutional | — | Authority and consistency | Forced dichotomies; retest instability |

**Sources:** [16Personalities](https://www.16personalities.com/), [Truity TypeFinder](https://www.truity.com/test/type-finder-personality-test-new), [Personality Hacker — "Why Call Myers-Briggs Genius Styles?"](https://www.personalityhacker.com/call-myers-briggs-genius-styles/), [Developer Experience — 16Personalities](https://developerexperience.io/articles/16personalities), [Live Science — How accurate is Myers-Briggs?](https://www.livescience.com/65513-does-myers-briggs-personality-test-work.html), [Wikipedia — Barnum effect](https://en.wikipedia.org/wiki/Barnum_effect), [TraitLab — The Barnum Effect](https://blog.traitlab.com/barnum-effect).

## 2. The emotional structure they share

All four follow roughly the same arc:

```
Curiosity  →  Effort  →  Progress  →  Anticipation  →  Reveal
   →  Recognition  →  Explanation  →  Exploration  →  Sharing  →  Return
```

The load-bearing step is **Recognition** — the instant the user thinks *"that's
me."* Everything before it exists to earn attention; everything after it exists
to extend the session. Users describe the moment in strikingly emotional terms
("like someone putting a mirror to your face").

Two mechanics do most of the work:

1. **Effort creates ownership.** A 130-question assessment isn't UX friction, it's
   investment. The result feels *earned* because it cost something.
2. **A name makes it portable.** "Campaigner" is repeatable, memorable, and
   belongs to the user in a way a score never does.

## 3. The failure mode — and Aurora's structural advantage

The central critique of these products is the **Barnum (Forer) effect**: people
rate vague, universally-applicable descriptions as highly accurate about
themselves. Forer's 1949 experiment gave every student the *same* horoscope-derived
profile and got a mean accuracy rating of 4.3/5.

TraitLab's analysis names the precise distinction:

> "Accuracy alone does not make a description valuable. It must also clearly
> distinguish the individual from other people."

The warning signs are: vague language, uniformly flattering framing, no
quantification, and descriptions that would be accepted equally by someone else.

**This is where Aurora differs structurally, and it should be the whole thesis.**

| Personality tests | Aurora |
|---|---|
| Input is **self-report** — what you say about yourself | Input is **observed behaviour** — what you actually rated, saved, watched, played |
| Evidence is **prose** | Evidence is **countable** ("you rated 12 atmospheric films 4+") |
| Claims are **unfalsifiable** | Claims are **auditable** — the user can click through to the exact titles |
| A result is **fixed** once taken | A result **changes** as behaviour changes |

Aurora never has to *ask* the user who they are. It can show its work. So the
identity should be presented as an **observation with receipts**, not a verdict.

## 4. What Aurora takes, and what it refuses

**Take:**
- **A named identity.** An evocative label ("Cinematic Explorer") is far more
  memorable and shareable than a list of top genres. Personality Hacker's
  insight — that naming is the product — applies directly.
- **Deliberate pacing on reveal.** Anticipation is created by sequencing and
  restraint, not decoration.
- **Dimensional spectrums over binaries.** 16Personalities' percentage splits are
  a genuinely better UX than forced categories; taste is continuous.
- **Explanation immediately after the reveal**, never gated — Truity's paywall is
  exactly where its experience breaks.
- **Identity as evolving.** Personality Hacker frames type as something you grow
  within; Aurora's identity genuinely *does* change, which is a better version of
  the same retention hook.

**Refuse:**
- MBTI branding, four-letter codes, type names, colour system, illustrations.
- Barnum-style prose that would fit anyone. Every sentence must be traceable to a
  count in the database or it does not ship.
- Uniformly flattering language. An identity that can never be unflattering has no
  discriminative power.
- Psychological framing of any kind. This is a model of *entertainment behaviour*,
  not personality, and the copy must never imply otherwise.
- Assigning an identity before there's evidence for one. A near-empty account gets
  an honest "still taking shape" state, not a guess.

## 5. Aurora's adaptation

| Personality product | Aurora |
|---|---|
| Personality type | **Entertainment Identity** — one named archetype |
| Personality traits | **Entertainment DNA** — the dimensional evidence underneath |
| "Why am I this type?" | **Why Aurora sees you this way** — countable receipts |
| Dimension percentages | **Taste Spectrums** — positioned against the catalogue, not invented |
| Type descriptions | **Identity summary** — one sentence, hedged, evidence-derived |
| Retaking the test | **Behaviour changing the result** — no retake needed |
| Type comparison | **Taste Match** |
| Share card | **Entertainment Identity Card** |

The assessment step has no analogue and shouldn't be invented: Aurora's
"questions" are the user's actual ratings and saves. That replaces *effort creates
ownership* with something better — **accumulated history creates ownership** — but
it means Aurora must work harder at the reveal, because the user hasn't just spent
ten minutes earning it.

## 6. Design principles adopted

1. **Every claim carries a receipt.** No identity trait, spectrum position, or
   insight renders without a count behind it.
2. **Discriminative, not just accurate.** Prefer statements that would *not* be
   true of a different user. Where possible, position the user relative to the
   catalogue rather than in the abstract.
3. **Hedged language.** "You often…", "Your recent activity leans…" — never "You
   are…" or "You always…".
4. **Silence beats fabrication.** Below the evidence threshold, show the
   taking-shape state and concrete actions to generate signal.
5. **The identity is a doorway, not a verdict.** Every trait, mood, and spectrum
   is a link into content — the profile must not be a dead end.
6. **Restraint carries the emotion.** Pacing, typography and composition do the
   work; no confetti, glow, or gradient heroes. Reduced motion respected.
