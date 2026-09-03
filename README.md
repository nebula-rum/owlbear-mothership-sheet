# Mothership — Character Profile

A custom Owlbear Rodeo extension for the Mothership RPG. Real Character Profile sheet,
switchable Basic (step-by-step creation, full skill tree) and Advanced (clean play sheet)
views, a GM-managed Roster, and a dark mode — no build step, nothing to install.

**Features**

- **Advanced** view — the clean play sheet: personal details, Stats & Saves, Status
  Report (Health/Wounds/Stress + Conditions), Skills, Equipment, Weapons.
- **Basic** view — the step-by-step creation sheet, numbered 1–8 to match the official
  sheet: roll-and-record Stats/Saves, class selection with bonus/trauma reference, the
  full 3-tier skill tree (Trained/Expert/Master) with prerequisite enforcement, and
  equipment loadout.
- Both views show the **same character** — switch anytime, per-viewer, with nothing lost.
- A GM-only **Roster** tab: create characters, assign each to a specific player /
  everyone / GM-only, and edit any character's full sheet directly.
- **Dark mode**, per viewer, independent of the Basic/Advanced choice.

## Install

1. In your Owlbear room: puzzle-piece icon → Add custom extension → paste this URL:
   `https://nebula-rum.github.io/owlbear-mothership-sheet/owlbear-extension.json`
2. As GM, open **Roster** and add a character for each player, assigning who can see/edit
   it. Players won't see anything on their **Character** tab until you do this.

One shared install works across any of your Mothership rooms, no per-room setup beyond
adding it once.

## GM notes

- **Roster** tab: add/rename characters, set each one's access (GM only / Everyone / a
  specific player), expand any character to edit its sheet directly — the same Basic or
  Advanced editor a player would see.
- The 4 core classes (Marine, Android, Scientist, Teamster) and the full skill tree are
  built in. Stat/save class bonuses are shown as reference text on the Basic view's class
  cards — add them to your rolled numbers yourself, same as on the physical sheet.

## License

[MIT](LICENSE).

Mothership® is a trademark of Tuesday Knight Games. This is an unofficial fan-made tool,
not affiliated with or endorsed by them.

## Contributing

It's a few plain files, no build step:

- `app.js` — reference data (classes, skill tree), data model, rendering.
- `style.css` — visual design (palette as CSS custom properties at the top, light/dark).
- `owlbear-extension.json` — extension manifest Owlbear reads.

Open `index.html` directly in a browser (or `python3 -m http.server`) to preview changes
outside Owlbear first — it falls back to local-only storage automatically in that mode.

- `owlbear-extension.json`'s `icon`/`popover` paths are set to
  `/owlbear-mothership-sheet/...`, matching this repo's name — GitHub Pages project
  repos serve under a `/<repo>/` subpath, not the domain root. **If you rename or fork
  under a different repo name**, edit those paths to match your actual repo name, commit,
  then reinstall the extension.
- Don't rename the manifest file to `manifest.json` if you ever deploy via Netlify Drop —
  it 401s there. `owlbear-extension.json` is fine as-is.

See `CLAUDE.md` and `docs/DEVELOPMENT-LOG.md` for the full architecture writeup and build
history, and `docs/OWLBEAR-CHARACTER-SHEET-EXTENSION-GUIDE.md` for the general (non-
Mothership-specific) patterns this extension was built from.

PRs and forks welcome.
