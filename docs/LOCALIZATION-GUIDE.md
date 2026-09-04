# Localization guide

How to translate Mothership material — this digital sheet, and separately, printed/PDF
sheets — into another language, keeping terminology consistent between the two. Written
while planning an Italian localization of this extension, but nothing below is Italian-
specific except the worked examples; swap the target language and it still applies.

## The two-track workflow

Keep translation **content** and translation **integration** in separate places, done by
different people with different tools:

1. **Content** — the actual translated text — gets drafted and reviewed wherever a
   non-technical, ideally native-speaking reviewer is comfortable: a Google Doc, a
   spreadsheet, a separate Cowork/chat session. It should never require touching this
   repo or understanding its code.
2. **Integration** — wiring translated strings into the actual sheet (or laying them out
   in a PDF) — happens in the target artifact itself, because it's the only place the
   real constraints are visible: exact field widths, how a button label wraps, how a
   PDF's fixed page geometry handles a longer word. A translation produced in isolation,
   without those constraints in front of the translator, routinely doesn't fit.

Practically: draft content first using this guide's terminology and register rules, then
bring it here (or into the PDF tool) for a fitting pass — expect the fitting pass to send
a few strings back for a shorter alternative, that's normal and not a sign the first draft
was wrong.

## Terminology glossary — decide once, reuse everywhere

Build a single glossary (a table: English term → target-language term → notes) before
translating anything, and use it for *every* Mothership artifact in that language — this
digital sheet, a translated PDF, character voice/flavor text, all of it. Term drift
between artifacts (the digital sheet says one thing, a translated handout says another)
is more confusing to players than any individual word choice.

Three categories need different treatment:

- **Game-mechanical terms** (Stats: Strength/Speed/Intellect/Combat; Saves: Sanity/Fear/
  Body; Wounds; Stress; skill tiers Trained/Expert/Master) — check first whether an
  *official* localization of Mothership already exists in the target language before
  inventing translations. If Tuesday Knight Games or a licensed local publisher has
  published one, match it — players who own that book expect the terms they already
  know. If none exists, translate once, put it in the glossary, and never vary it.
- **Skill names** (the 42 entries in `SKILLS`, e.g. "Jury-Rigging", "Zero-G") — these are
  flavor as much as mechanics. A skill's `label` is the only translatable field; its key
  (`"jury-rigging"`) is a stable internal ID other code references by, and prereq links
  are wired by ID, not by label — so relabeling is safe and never touches game logic.
- **UI chrome** (button labels, tab names, field placeholders — "Add", "Remove", "Roster",
  "Personal Notes") — translate for fluency, not literalism; these don't need to match
  any published rulebook, just read naturally.

## Register and tone

Mothership's voice is terse, technical, blue-collar-in-space — not high fantasy. In
Italian (and most Romance languages), that means:
- Informal address (**tu**, not **lei**) — this is a horror-tabletop product for a table
  of friends, not a corporate form.
- Prefer short, direct phrasing over grammatically-correct-but-longer constructions where
  both exist — the layout constraints below make this more than a style preference.
- Keep invented sci-fi terms (ship names, faction names, in-fiction proper nouns)
  untranslated unless the source material itself translates them.

## Digital-sheet constraints (this repo specifically)

This is the part a translator working in a Google Doc can't see, and the part most
likely to break something if skipped. Several rounds of this sheet's own layout work
went into fitting English text at these exact widths — Italian runs roughly 20-30%
longer than English on average, and some of these fields have single-digit pixels of
margin left:

- **Personal Details labels** ("Character Name", "Pronouns", "Player Name") must fit on
  one line in the Basic view's identity column — this already required a dedicated
  layout pass (see the git history around the "identity-stats-row" ratio). A translated
  label meaningfully longer than its English source will wrap, which we specifically
  fixed English text to avoid.
- **Stat/Save labels** (Strength/Speed/Intellect/Combat, Sanity/Fear/Body) render as
  4-across and 3-across rows of small circles in the Basic view's compact mode
  (`.circle-row.compact`) — the row's own *label text width*, not the circle, is what
  determines whether they fit on one line without wrapping (this was a real bug: see the
  "wound box is fucked" fix in the git history). Longer translated labels may need the
  row's font-size or gap tightened further, the same way the English version was tuned.
- **Step titles** (Basic view's numbered steps 1-8) were deliberately trimmed short
  ("Roll 2d10+25", not "Roll 2d10+25 for each Stat") specifically to fit their panel
  headers. Translate for the trimmed version's meaning, not a literal expansion back to
  the original official-sheet phrasing.
- **Skill tree node labels and prereq hints** — the 3-column skill tree already runs at
  a tight `min-width` tuned to avoid horizontal scroll (`.skill-tree-cols`); the
  "requires: X or Y or Z" hint text already wraps to 2-3 lines for the longest English
  entries. A translation can let hints wrap further (vertical space here is cheap) but
  should keep the skill `label` itself as short as the English original where possible.
- **Buttons and badges** ("+ Add Character", "Collapse", "GM only") are the least
  constrained — most have flexible-width containers — but icon-only buttons with a
  `title` tooltip (lock toggle, dark-mode toggle) have no visible text at all to worry
  about; only their `title` attribute needs translating, for accessibility/hover text.

When in doubt, translate first for meaning, then treat "does it fit without wrapping
where the English didn't wrap" as a hard constraint to check against the running app,
not an aesthetic nice-to-have — several of these fields wrap ungracefully rather than
truncating, which reads as a bug, not a design choice.

## PDF/print constraints (different from the digital sheet)

A translated PDF character sheet has *more* freedom than this digital one in some ways
(you control font size, leading, and can redraw a text box's bounds) and *less* in
others (the page is a fixed physical size, and matching the original's grid/panel
layout matters for anyone using the digital and print versions side by side, or for a
GM who's memorized where things are on the official sheet).

- Preserve the original PDF's panel structure and reading order — don't consolidate or
  reflow panels even if the translated text would fit more efficiently a different way;
  players comparing to the official English sheet should be able to point at a spot and
  find the same box.
- Where translated text is longer than the box's original point size accommodates,
  prefer reducing that box's font size over expanding the box (which cascades into
  needing to move every other element on the page) — but don't go below whatever the
  document's smallest existing font size already is, to avoid a legibility regression.
- Reuse this guide's glossary exactly — a PDF and the digital sheet using different
  Italian words for "Wounds" is worse than either one individually being slightly
  imperfect.

## Handoff format (content → integration)

When translated content is ready to bring back for integration, deliver it as a flat
key → translated-string list keyed the same way the source is structured (e.g. by
`CLASSES.marine.trauma`, `SKILLS.linguistics.label`, or a short slug for each hardcoded
UI string), not as free-flowing prose or a reformatted document — that's what turns into
a mechanical drop-in rather than a second research pass to figure out which translated
sentence maps to which field. A spreadsheet with columns `key | English | Italian |
notes` works well and is easy for a non-technical reviewer to comment on directly.

## Before translating, check

- [ ] Does an official Mothership localization already exist in the target language?
      If so, source the glossary from it, don't invent one.
- [ ] Glossary drafted and agreed for all game-mechanical terms before any UI or flavor
      text translation starts.
- [ ] Register decided (informal address, terse phrasing) and noted for the translator.
- [ ] Translator has this file, so field-width constraints are known before drafting
      starts, not discovered during integration.
