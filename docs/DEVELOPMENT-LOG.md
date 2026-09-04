# Development log

> This is the pass-by-pass record of design decisions behind this build — check it
> before assuming something odd is an oversight.

## Research pass: confirming no existing Mothership sheet exists

Before building anything, searched the official Owlbear Rodeo extension store
(extensions.owlbear.rodeo), the unofficial community-maintained "Rogue Store"
(owlbear.rogue.pub), and general web/GitHub search for any existing Mothership RPG
character sheet extension, official or fan-made. Found none — the official store has
system-specific sheets for other games (ShadowDark, Lancer, Daggerheart, Draw Steel) and
system-agnostic tools (DummySheet, Chronicle!, Sheet from Beyond, Forge!), plus a
standalone (non-OBR) Mothership character sheet web app
(`github.com/artliches/mosh-sheet`) with no manifest and not listed in either store — so
not an installable extension. Confirmed a genuine gap existed.

## Architecture research pass: porting from owlbear-mist-sheet

Rather than design the extension architecture from scratch, cloned and read through
`nebula-rum/owlbear-mist-sheet` (a sibling project, a Legend in the Mist / Mist Engine
sheet built by the same account) — its `CLAUDE.md`, `app.js`, and 35-pass
`docs/DEVELOPMENT-LOG.md` — specifically to answer: how does the GM assign characters to
players, what can the GM see vs. a player, and what's the underlying sync architecture.
Wrote up everything genuinely system-agnostic (not Mist-Engine-specific) into
`docs/OWLBEAR-CHARACTER-SHEET-EXTENSION-GUIDE.md` in *this* repo, so it could be applied
here and reused for any future sheet extension. Covers: room-metadata vs. player-metadata
data model and why, the 3-way GM/player access model, sync-correctness rules (the Mist
sheet's real bug history around `OBR.room.onMetadataChange` echoes, stale object
identity, and focus-stealing re-renders), ephemeral-vs-synced state, the `?view=` query-
param pattern for multiple render surfaces, always-on background-popover widgets, and the
`OBR.isAvailable` standalone-testing fallback that makes any of this testable without a
live Owlbear room.

## Planning pass

Given the two official PDFs (Basic — the creation-flow sheet with the full skill tree;
Advanced — the clean play sheet), planned the extension in EnterPlanMode against the
guide above. Four open decisions were put to the user rather than assumed:

- **Skill tree fidelity**: full SVG graph matching the PDF's connector lines, chosen over
  a simplified grouped-column-with-text-only approach.
- **Portrait/photo**: skipped for v1 — room metadata isn't meant for image blobs, and OBR
  extensions have no built-in file-upload API; an image-URL field was the alternative
  considered but also deferred.
- **Stat/save rolling**: plain number-entry fields with the step's formula shown as a
  hint, not live roll buttons — matches "no dice-rolling portion yet," flagged out of
  scope in an earlier research pass on this same repo.
- **Class scope**: the 4 core classes (Marine/Android/Scientist/Teamster) hard-coded, no
  GM-defined homebrew classes for v1.

## Extracting the skill tree from the PDF

The Basic sheet's skill list (42 skills across Trained/Expert/Master columns) has several
non-obvious diagonal/cross-row prerequisite links that aren't visible from the row layout
alone — e.g. Zoology feeds Pathology, Psychology, *and* Field Medicine; Mechanical Repair
feeds Engineering, Robotics, *and* Cybernetics; Wilderness Survival has three valid
prerequisites (Botany, Theology, Military Training). Eyeballing the rendered PDF page at
normal zoom was not reliable enough to transcribe this correctly.

Instead: used `pymupdf` to parse the Basic sheet PDF's actual vector drawing commands —
line-segment endpoints and the small circular "bullet" nodes marking each skill — and
matched each connector line's start/end to its nearest node by coordinate proximity. This
surfaced a real complication: the diagram uses **shared trunk lines** (several source
lines merge into one shared line before a single arrowhead, rather than one arrowhead per
source), so a naive "one edge per arrowhead" count undercounted real prerequisite edges.
Resolved by cross-checking the vector-derived edges against high-resolution crops of the
actual PDF region rendered as images (`page.get_pixmap` at 8–12x zoom) and reading the
connector paths directly, region by region, rather than trusting either method alone. The
final 40-edge, 42-node graph (`SKILLS` in `app.js`) was verified this way end to end
before being transcribed as code — don't "fix" a surprising-looking edge without
re-checking the source PDF first.

## Build

Built directly from the guide's patterns rather than re-deriving them:

- **Data model**: `com.mothership.sheet/roster` + `com.mothership.sheet/character/<id>`
  keys, same shape and same `bindCharacter()`/`deepEqual`/debounced-save mechanics as the
  Mist sheet.
- **Basic/Advanced toggle**: a per-viewer `localStorage` preference
  (`mothership-sheet-view`), not room state — same pattern as the Mist sheet's
  font-size/language toggles. Both views call the same shared field components (stat
  circles, status pills, line-lists) and render the identical underlying character
  record, so switching never loses data.
- **Dark mode**: a second per-viewer `localStorage` preference
  (`mothership-sheet-theme`), CSS custom properties on `:root` redefined under both
  `@media (prefers-color-scheme: dark)` and `:root[data-theme="dark"]`. The source
  sheet's solid-black header bars and Personal Details panel translate as `background:
  var(--ink); color: var(--bg)` — light mode gets black-bar-white-text as printed; dark
  mode gets the same rule automatically producing a light block with dark text, with no
  separate dark-mode override needed for those specific elements.
- **Visual style**: flat rounded-rect panels with a heavy border, solid-fill uppercase
  section headers, bordered circles for stats/saves, stadium-shaped current/max pills —
  translated directly from the source PDFs' own flat vector style, no parchment texture
  or card-flip mechanics needed (unlike the Mist sheet).

## Verification

Standalone-mode Playwright pass (the pre-installed Chromium, driven directly — no test
framework, matching the guide's §10 recommendation to test the standalone fallback
first): roster character creation and GM-side expand-editor; skill-tree prerequisite
enforcement (Piloting starts disabled, enables after Zero-G is taken, and stays taken
after Zero-G is later cleared — matches the "any one prerequisite, checked only at
selection time" rule); Advanced view correctly reflects skills chosen in Basic view;
"Everyone" access assignment correctly surfaces the sheet on the Character tab; dark-mode
toggle correctly sets the CSS custom properties. Caught and fixed a real bug this way: the
Health/Wounds/Stress status-pill captions were mislabeling the *second* value using the
option meant for the first ("Maximum" appearing where "Current" belonged), and Stress's
second value read "Max" instead of the rule-accurate "Minimum" — fixed in
`statusPillField`/`statusReportRow` and re-verified via screenshot.

`node --check app.js` run after every edit, per the guide's §10.
