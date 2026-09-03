# Building a Character Sheet Extension for Owlbear Rodeo — a general guide

Distilled from building `nebula-rum/owlbear-mist-sheet` (a Theme-card sheet for Mist
Engine games — City of Mist, Otherscape, Legend in the Mist). None of what follows is
Mist-Engine-specific; it's the reusable shape of "GM manages a roster, players get their
own sheet, everything syncs live" for **any** RPG system on Owlbear Rodeo. Re-read this
before starting a new sheet extension; re-derive nothing that's already settled here.

Not covered (by design — out of scope until actually needed): dice rolling / resolution
mechanics. Mist Engine's own roll button is a good reference if that's needed later, but
this doc stays system- and mechanic-agnostic.

## 1. Project shape: no build step

A character sheet extension can be a handful of static files with zero framework, zero
bundler, zero npm install:

- `index.html` — loads `app.js` as an ES module (`<script type="module" src="app.js">`).
  Renders differently depending on a `?view=` query string (see §7).
- `app.js` — the entire application: data model, rendering, everything. One file is fine;
  it keeps "where does X live" a non-question. Comment *why*, not *what* — record the
  non-obvious reason a piece of code is shaped the way it is (a bug it fixes, an approach
  that was tried and silently broke something), since that's the context a future session
  (human or AI) actually needs and can't re-derive by reading the code alone.
- `style.css` — one stylesheet, CSS custom properties for the palette/theme at the top.
- `owlbear-extension.json` — the manifest Owlbear reads (see §2).
- `background.html` — optional, only needed for an always-on widget (see §8).
- `obr-sdk.bundle.js` — the official `@owlbear-rodeo/sdk`, bundled and committed directly
  so there's no install step at all for a static site.
- `icon.svg` — toolbar icon, using `currentColor` throughout so it inherits Owlbear's own
  toolbar tinting instead of shipping a fixed color that clashes with a theme.

This isn't a purity stance — it's what keeps a single-maintainer fan tool deployable via
GitHub Pages with a plain `git push`, no CI, no build artifacts to keep in sync with
source. A larger team or a more complex sheet might reasonably want a framework; the
patterns below (data model, permissions, sync) apply regardless of how the UI layer is
built.

## 2. The manifest (`owlbear-extension.json`)

```json
{
  "name": "...",
  "version": "1.0.0",
  "manifest_version": 1,
  "description": "...",
  "icon": "/your-repo-name/icon.svg",
  "author": "...",
  "action": {
    "title": "Character Sheet",
    "icon": "/your-repo-name/icon.svg",
    "popover": "/your-repo-name/index.html",
    "height": 820,
    "width": 1180
  },
  "background_url": "/your-repo-name/background.html"
}
```

**Gotchas that cost real debugging time on the reference build:**

- Paths are **absolute from the domain root**, not relative to the manifest's own folder.
  A bare `"icon.svg"` (no leading slash) makes Owlbear concatenate origin + path with
  *no separator inserted* — a malformed host and an immediate, confusing failure.
- A GitHub Pages **project** site (`username.github.io/repo-name/`) serves under a
  subpath, not the domain root — so even a correctly-leading-slash `/icon.svg` resolves
  to the wrong place. The manifest needs the repo name baked into every path
  (`/repo-name/icon.svg`). Forking under a different repo name means updating these
  paths and reinstalling the extension.
- Don't name the manifest file `manifest.json` if you might ever deploy via Netlify Drop
  — it collides with Netlify's own web-app-manifest handling and 401s. Use
  `owlbear-extension.json` (or any other name) instead, and point Owlbear at that URL.
  (Netlify serves from the domain root, so a Netlify deploy wants the bare `/icon.svg`
  form instead of the GitHub-Pages-subpath form — the two hosts want different paths.)
- A manifest change only takes effect for existing installs once it's actually pushed
  live — Owlbear reads the manifest URL live on every use, not a cached/bundled copy.

## 3. Data model: room metadata, not player metadata

**The foundational decision, and the one to get right before anything else:** all
character/campaign data lives in `OBR.room` metadata, never `OBR.player` metadata.

Why: a connected client can only write **its own** `OBR.player.metadata` — never another
connected player's. If the GM needs real edit access to every character's sheet (not
just read-only), player metadata is a dead end from the start. Room metadata is the only
bucket every client can write, so character data has to live there if the GM is ever
going to edit anyone else's sheet directly.

Split room metadata into **independently-writable keys**, one per logical piece, so
concurrent edits to different things never clobber each other — `setMetadata()` takes a
partial object and only touches the keys you pass, so this is free:

```
com.yourns.sheet/campaign        → GM-configured, campaign-wide settings
com.yourns.sheet/roster          → lightweight index: {id, access, ownerId}[] — NOT sheet contents
com.yourns.sheet/character/<id>  → one key per character, full sheet contents
com.yourns.sheet/rollLog         → (if applicable) capped shared history array
```

Namespace every key with a reverse-DNS-ish prefix unique to your extension
(`com.yourns.sheet/...`) — room metadata is a single flat key-value space shared by
**every extension installed in that room** (confirmed directly from the SDK types:
`Metadata` is a bare `Record<string, unknown>` with no per-extension scoping at the
platform level). The prefix convention is the only thing preventing collisions with
another extension's keys.

Keep the roster as a thin index (id + access info only) separate from each character's
full sheet, under its own key. Renaming or reassigning one character then only touches
the roster key and that one character's key — never the other characters' data.

## 4. The GM/player permission model

This is the part most worth copying wholesale; it's a solved problem now.

**Role detection:** `await OBR.player.getRole()` returns `"GM"` or `"PLAYER"`. Gate every
GM-only tab/control behind a single `isGM()` helper.

**The permission model isn't a security boundary — say so explicitly, in code comments
and to users.** Owlbear has no per-role write-permission system on room metadata: any
connected client can technically call `room.setMetadata()` regardless of role. Checking
the role before *rendering* a control is the only mechanism available, and it's how
every Owlbear extension with GM-only features works — there's no platform primitive to
lean on instead. This is a non-issue in practice (everyone at the table is someone the
GM invited) but don't misrepresent it as enforced access control.

**Character visibility/assignment — a 3-way access model, per character:**

```js
{ id, access: "gm" | "everyone" | "assigned", ownerId: string | null }
```

- `"gm"` — hidden from all players (NPCs, secrets, work-in-progress sheets).
- `"everyone"` — every connected player can view **and edit** it (covers shared/grabbable
  pregens for a one-shot).
- `"assigned"` — only the GM and the specific player named by `ownerId` can view/edit it.

A player's own accessible-characters resolution is one filter:

```js
function accessibleCharacterIds(playerId) {
  return roster
    .filter(r => r.access === "everyone" || (r.access === "assigned" && r.ownerId === playerId))
    .map(r => r.id);
}
```

**On the player's own sheet tab**, resolve the count and branch:
- 0 accessible characters → show a "your GM hasn't assigned you a character yet" message.
  Nobody gets an empty sheet to fumble with; assignment is explicit and GM-driven.
- 1 → show it directly, no picker.
- 2+ (e.g. one-shot pregens anyone can grab) → a small picker to switch between them.

**Assignment persistence:** `OBR.player.id` is a stable synchronous getter (backed by
the SDK's own message-bus user id) that survives normal reconnects for the same player
rejoining the same room — so `ownerId` assignments hold up across disconnects. It's not
guaranteed stable across a browser/device switch for anonymous/guest identities
(undocumented); the practical fallback is the GM just re-assigns if that happens. Don't
build anything that assumes cross-device identity continuity.

**GM roster management UI**, concretely: an "Add Character" button, a name field per
row, a `<select>` with three kinds of options (GM only / Everyone / one option per
currently-connected player — built from `OBR.party.getPlayers()`), a remove button (with
confirmation), and a per-row expand toggle that renders the **exact same** full sheet
editor component used on the player-facing tab, inline — the GM edits through the same
UI a player would use, not a separate GM-only editor. See §5 for why this is easy to do
without duplicating code.

## 5. One sheet-renderer, three callers

Refactor sheet rendering to take a `(entity, save)` pair rather than closing over a
single global "the current character." Then the identical, identically-tested UI serves:

1. A player's own sheet (`Hero` tab)
2. The GM editing any roster character inline (`Roster` tab's expand-accordion)
3. A shared/party-wide entity, if your system has one (e.g. a shared resource card) — via
   a generalized read-only-for-some-fields mode

No duplicated rendering code, no "GM version" and "player version" of the sheet to keep
in sync by hand. Field-level permission differences (e.g. "players can toggle this one
flag but not edit anything else") become a parameter or a check inside the shared
renderer, not a fork of the whole component.

## 6. Sync correctness: the part with the most subtle bugs

This is where the reference build's actual bug history lives — worth internalizing
rather than rediscovering.

**Debounced writes.** Don't call `setMetadata()` on every keystroke. Debounce per-key
(~250ms), so a burst of edits to one key collapses to one write, and a concurrent edit to
a *different* key isn't blocked by the debounce timer:

```js
function scheduleSave(key) {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => saveKey(key), 250));
}
```

**`OBR.room.onMetadataChange` fires on every write it sees, including no-op echoes of a
save your own client just made** — even for keys nobody touched. This is the single
biggest source of real bugs in the reference build's history. Two rules that fix it:

1. **Compare with real structural equality (`deepEqual`), not `JSON.stringify`.** A
   round-tripped object's keys aren't guaranteed to come back in the same insertion
   order, so `JSON.stringify(a) !== JSON.stringify(b)` can report "changed" on a
   perfectly identical echo.
2. **Never unconditionally reassign your local metadata object on every callback.**
   ```js
   OBR.room.onMetadataChange((meta) => {
     if (deepEqual(meta, roomMeta)) return;   // <-- the load-bearing line
     roomMeta = meta;
     renderApp();
   });
   ```
   Skipping the reassignment when nothing changed matters because of the next point.

**Never rebuild-and-replace an object your UI already holds a live reference to.** If a
"get this character, normalized" accessor always returns a *fresh* object instead of
reusing whatever's already sitting in your local metadata store, then any full re-render
(including one triggered by a no-op echo above) silently orphans anything holding a
reference to the old instance — most dangerously, an open confirm-dialog's `onConfirm`
closure. The user clicks "Delete," it mutates the orphaned object, `save()` persists the
*current* (unmutated) object instead, and the deletion silently does nothing — with no
error, no visual sign, just "sometimes it doesn't work." The fix is an accessor that
reuses the existing live object when one's already there, only building fresh when
there's genuinely nothing valid yet:

```js
function bindCharacter(id) {
  const key = characterKey(id);
  const existing = roomMeta[key];
  const character = existing || getCharacter(id); // reuse, don't rebuild
  roomMeta[key] = character;
  return { character, save: () => scheduleSave(key) };
}
```

As defense in depth, close any open confirm dialog at the very start of every full
re-render (`closeConfirmDialog()` before rebuilding the DOM) — if a genuine concurrent
edit *does* land mid-dialog despite the above, the dialog visibly disappears instead of
silently no-op'ing, so the user knows to retry rather than assuming it worked.

**Don't steal focus from an actively-typing field.** A full re-render rebuilds every DOM
node, including whatever `<input>`/`<textarea>` currently has focus — and a remote
metadata change can arrive mid-keystroke (including the echo of the very keystroke just
typed). Defer the re-render while an editable element is focused; catch up the instant
it blurs:

```js
function isEditableFocused() {
  const ae = document.activeElement;
  return !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
}
// in the onMetadataChange handler:
if (isEditableFocused()) pendingRenderAfterEdit = true;
else renderApp();
// on focusout:
if (pendingRenderAfterEdit) { pendingRenderAfterEdit = false; renderApp(); }
```

The locally-typed value is already reflected in your local state either way (you updated
it before scheduling the save), so deferring the visual refresh loses nothing.

**Never use the browser's native `confirm()` for destructive actions.** Some browsers
let a user permanently silence a page's dialogs (a "don't allow this page to create
additional dialogs" checkbox), after which `confirm()` returns `false` instantly with no
dialog shown — silently turning every `if (!confirm(...)) return` delete button into a
dead button until the page reloads, with zero indication why. Render your own overlay
dialog instead; it can't be disabled by a browser setting.

## 7. Ephemeral vs. synced state — keep them clearly separate

Not everything a player does needs to go through room metadata. Draw a hard line:

- **Synced (room metadata):** actual character/campaign data — anything another
  connected client needs to see, or that must survive a reload.
- **Ephemeral, per-viewer (a module-level `Set`/`Map`, reset on reload):** working
  scratch state for the current viewer's current interaction — e.g. "which items are
  ticked for an upcoming calculation," "which card is currently flipped/expanded,"
  "which accordion row is open." Nobody else needs to see this, and it shouldn't survive
  a reload.
- **Ephemeral, per-browser but persistent (`localStorage`):** personal preferences that
  should survive a reload but are never shared — language, font size, a "hide this
  widget" toggle, mute state. One `localStorage` key per preference, read once at boot
  with a sane default/fallback.

Getting this split right up front avoids two symmetric mistakes: syncing UI noise that
spams every other client's re-render, or losing real data because it was only ever kept
in memory.

## 8. Multi-view single codebase: query-string-selected render modes

A sheet extension typically needs to appear in more than one Owlbear surface — the
toolbar popover, a larger expanded view, and (optionally) an always-on background
widget. Rather than separate apps, load the same `index.html`/`app.js` with a `?view=`
query parameter that picks which branch of `renderApp()` runs:

- **Default (no param):** the toolbar popover — the normal, compact sheet.
- **`?view=expanded`:** a bigger view of the same sheet (more room for side-by-side
  layout). Opened via `OBR.modal.open({ id, url, fullScreen: true })` — pass an
  **already-absolute URL** you build yourself
  (`window.location.origin + window.location.pathname + "?view=expanded"`), since
  Owlbear's SDK resolves a relative URL by concatenating origin + string with no
  separator, which breaks on any non-domain-root deployment (GitHub Pages project
  sites). `fullScreen: true` beats a fixed pixel size for "always uses the whole
  available window regardless of the viewer's screen."
- **`?view=<widget>`:** a minimal, chrome-free render for an always-on corner widget
  (see §9) — none of the full sheet's tabs/UI, just the one small thing.

Outside a real Owlbear room (see §10), fall back to a plain popup window
(`window.open(...)`) for the expanded view — same query param, same rendering code path,
just a different host mechanism for opening it.

## 9. An always-on widget (background page)

If the sheet needs something visible to the whole table without anyone clicking the
toolbar icon (e.g. a shared roll/event log), the manifest's `background_url` is the
mechanism: Owlbear loads that page automatically, once per connected player, as soon as
the room opens — independent of the toolbar popover entirely.

That page's job is just to open a popover anchored to a screen corner, with its chrome
hidden:

```js
OBR.popover.open({
  id: SOME_STABLE_POPOVER_ID,
  url,                 // build absolute, same reasoning as §8
  width, height,
  anchorOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
  transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
  disableClickAway: true,
  hidePaper: true,
  marginThreshold: 0,
});
```

Key facts worth knowing before building one of these:

- **Any page belonging to the extension can control a popover it knows the id of** —
  not only the page that originally opened it. A collapse/expand toggle inside the
  widget's own page can resize the same popover live via `OBR.popover.setWidth()` /
  `setHeight()`; a completely different page (e.g. the main sheet's topbar) can open/close
  that same popover by id too, with no round trip through the background page needed.
- **Corner real estate is contested.** Owlbear's own UI has controls in the corners too
  (a scene/map toggle, typically bottom-right). A fixed pixel clearance can graze it on
  some screens; computing extra clearance as a fraction of `OBR.viewport.getHeight()`
  (rather than another hardcoded pixel constant) holds up across different screen sizes.
  Tune horizontal and vertical clearance independently (as CSS padding inside the
  widget's own page, not as a single uniform `marginThreshold`) — a uniform margin moves
  every edge together and can't be tuned per axis.
- **Respect a per-player "hide this" preference on the background page's own boot**, not
  just on the live toggle — otherwise a player who hid the widget has it silently
  reappear the next time they reconnect (since the background page reruns from scratch
  on every connect).
- **A background page is a separate script instance** — it never loads the rest of your
  app, so it can't import shared constants/functions from `app.js`. Anything it needs
  (sizing constants, key names) has to be duplicated as literals, with a comment on both
  sides flagging that they must be kept in sync.
- Investigate an official extension's own source before inventing this from scratch —
  it's how the reference build found this whole mechanism (reading the official Dice
  extension's `background.ts`/`PopoverTrays.tsx`).

## 10. Build it testable without a live Owlbear room

Detect whether you're actually running inside Owlbear and provide a local fallback:

```js
if (OBR.isAvailable) {
  backend = "obr";
  // real OBR.* calls
} else {
  backend = "standalone";
  // localStorage-backed fallback for "room metadata", synthetic self id/role, etc.
}
```

This one branch is what makes the whole app testable — including in an automated
browser (Playwright) — without ever opening a real Owlbear room. In standalone mode:
show a small banner so nobody mistakes it for the real thing, keep GM-only tabs visible
(there's no real role concept outside a room, so gate on `backend !== "obr"` as an
automatic pass), and back "room metadata" with a `localStorage` key instead.

**For anything that only exists in real Owlbear** (`OBR.popover`, `background_url`,
`OBR.modal`, `OBR.viewport.getHeight()`, real role gating, the `onMetadataChange` echo
races in §6) — standalone mode can't exercise it, because there's no real SDK backing it.
The technique that actually catches bugs here: swap `obr-sdk.bundle.js` for a small stub
script that intercepts just the relevant calls (records what was called with what
arguments, or simulates a metadata echo), test against that stub, then restore the real
bundle and diff to confirm it's byte-identical to what's shipped. Several real bugs in
the reference build (the delete-bug races, a roll-log-visibility toggle's exact
`popover.open`/`close` arguments) were only caught this way — reasoning about the code
wasn't enough; something had to actually simulate the SDK's callback timing.

Run a cheap syntax check (`node --check app.js`) before considering any edit to a
build-step-free codebase done — there's no bundler/type system to catch a typo otherwise.

## 11. Localization, if needed

A flat per-language dictionary plus one lookup function is enough — no i18n library
needed for a small extension:

```js
const LABELS = { en: { key: "text", ... }, it: { key: "testo", ... } };
let lang = localStorage.getItem(LANG_KEY) === "it" ? "it" : "en";
function t(key, ...args) {
  const entry = LABELS[lang][key];
  return typeof entry === "function" ? entry(...args) : entry; // some entries need interpolation
}
```

If the sheet opens as multiple separate pages (popover + expanded view + a background
widget, per §8/§9), a language toggle in one page only re-renders *that* page — but since
they're same-origin, a `localStorage` write in one fires a `storage` event in every
*other* open page/window automatically. Listening for that event is a free way to keep a
language (or font-size, or any other per-browser preference) toggle in sync live across
all of an extension's simultaneously-open pages, with zero extra plumbing and no round
trip through room metadata.

## 12. Deploying (GitHub Pages)

- Push to `main`; if Pages is configured to deploy from that branch/root, the repo root
  *is* the served site — no build artifact to keep in sync.
- A manifest (`owlbear-extension.json`) change needs an actual push to affect existing
  installs — Owlbear fetches the manifest URL live every time, never a cached copy.
- If Pages hands back a transient `500` from its own deployment API, it's usually a
  brief infra blip, not a real problem — check the platform's own status page, then just
  re-run the deploy.
- If your working environment blocks outbound `git push` (some sandboxed CI/agent
  environments route all `git` traffic through a proxy that only authorizes pre-approved
  repos), that's an environment constraint, not a codebase problem — don't assume it'll
  recur elsewhere. If it does recur and there's truly no `git push` path available, the
  fallback is pushing individual files through the platform's own authenticated web UI;
  verify the file arrived byte-for-byte via a content hash (e.g. SHA-256), not a visual
  diff, since some editors' automatic indentation can silently corrupt pasted/typed
  content (e.g. duplicating blank lines) in a way that's easy to miss by eye.

## 13. Quick checklist for a new system's sheet extension

1. Design the data model as independently-writable room-metadata keys (campaign
   settings / roster index / one key per character / any shared entities), namespaced
   with a unique prefix.
2. Build the 3-way character access model (`gm` / `everyone` / `assigned` + `ownerId`)
   and the player-side resolution (0/1/2+ accessible characters).
3. Write one sheet-renderer that takes `(entity, save)`, reused for the player's own
   tab and the GM's roster editor.
4. Gate GM-only UI on `OBR.player.getRole() === "GM"`, and say clearly (in code and to
   users) that this is a UI courtesy, not enforced security.
5. Get the sync-correctness rules in §6 right from the start — `deepEqual`, reused
   object identity, deferred re-render while typing, no native `confirm()`. These bugs
   are subtle, hard to repro, and expensive to chase down after the fact.
6. Decide what's ephemeral vs. synced per piece of state before writing it, not after.
7. Stand up the `OBR.isAvailable` standalone fallback early — it's the only reason the
   rest of this is testable at all during development.
8. Only add `?view=expanded` / a background widget / localization once the core
   sheet+roster+sync loop above is solid — they're additive, not foundational.

## Source

Distilled from `nebula-rum/owlbear-mist-sheet` (`app.js`, `CLAUDE.md`, and
`docs/DEVELOPMENT-LOG.md`, a 35-pass build history) — consult that repo directly for a
worked, line-level example of every pattern above, or for the roll-log/dice-button
mechanics this doc deliberately left out.
