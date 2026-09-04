import OBR from "./obr-sdk.bundle.js";

/* =========================================================================
   Mothership — Character Profile
   Single-file app (data model, rendering) — see docs/DEVELOPMENT-LOG.md for the
   architecture this was built from (ported from nebula-rum/owlbear-mist-sheet).
   ========================================================================= */

const THEME_KEY = "mothership-sheet-theme"; // "light" | "dark"
const VIEW_KEY = "mothership-sheet-view"; // "advanced" | "basic"
const LOCAL_ROOM_KEY = "mothership-sheet-room"; // standalone/local-preview fallback

const ROOM_KEYS = {
  roster: "com.mothership.sheet/roster",
};
function characterKey(id) {
  return "com.mothership.sheet/character/" + id;
}

/* =========================================================================
   Reference data: classes
   Transcribed directly from the Basic sheet's step 3 (stat/save bonuses) and
   step 6 (trauma response). Bonuses are shown as a hint, never auto-applied
   to the stored stat/save numbers — the player adds them by hand, same as on
   the physical sheet, so re-picking a class can never silently double-apply
   or need to "undo" a previous bonus.
   ========================================================================= */
const CLASSES = {
  marine: {
    label: "Marine",
    statBonusText: "+10 Combat",
    saveBonusText: "+10 Body Save, +20 Fear Save",
    woundsBonusText: "+1 Max Wounds",
    startingSkillsText: "Military Training, Athletics",
    bonusSkillText: "Bonus: 1 Expert Skill OR 2 Trained Skills",
    trauma: "Whenever you panic, every close friendly player must make a Fear save.",
    maxWoundsBonus: 1,
  },
  android: {
    label: "Android",
    statBonusText: "+20 Intellect, −10 to 1 stat",
    saveBonusText: "+60 Fear Save",
    woundsBonusText: "+1 Max Wounds",
    startingSkillsText: "Linguistics, Computers, Mathematics",
    bonusSkillText: "Bonus: 1 Expert Skill OR 2 Trained Skills",
    trauma: "Fear saves made by close friendly players are at disadvantage.",
    statPenaltyChoice: true,
    maxWoundsBonus: 1,
  },
  scientist: {
    label: "Scientist",
    statBonusText: "+10 Intellect, +5 to 1 stat",
    saveBonusText: "+30 Sanity Save",
    woundsBonusText: "",
    startingSkillsText: "1 Master Skill, and an Expert and Trained Skill prerequisite.",
    bonusSkillText: "Bonus: 1 Trained Skill",
    trauma: "Whenever you fail a Sanity save, all close friendly players gain 1 Stress.",
    statBonusChoice: true,
    maxWoundsBonus: 0,
  },
  teamster: {
    label: "Teamster",
    statBonusText: "+5 to all stats",
    saveBonusText: "+10 to all saves",
    woundsBonusText: "",
    startingSkillsText: "Industrial Equipment, Zero-G",
    bonusSkillText: "Bonus: 1 Trained Skill and 1 Expert Skill.",
    trauma: "Once per session, you may take advantage on a Panic check.",
    maxWoundsBonus: 0,
  },
};
const CLASS_ORDER = ["marine", "android", "scientist", "teamster"];

const STAT_KEYS = ["strength", "speed", "intellect", "combat"];
const STAT_LABELS = { strength: "Strength", speed: "Speed", intellect: "Intellect", combat: "Combat" };
const SAVE_KEYS = ["sanity", "fear", "body"];
const SAVE_LABELS = { sanity: "Sanity", fear: "Fear", body: "Body" };

/* =========================================================================
   Reference data: skill tree
   Extracted from the Basic sheet's vector artwork (line-segment endpoints
   matched to each skill's bullet circle, then visually cross-checked against
   the rendered PDF row by row) rather than eyeballed — the tree has several
   non-obvious diagonal/cross-row prerequisite links the straight row layout
   doesn't suggest on its own. `prereqs` lists every valid prerequisite for a
   skill; per the sheet's own rule, having ANY ONE of them is sufficient to
   take that skill ("must first take at least one of its prerequisite Skills").
   `row` is the skill's position in the sheet's original 17-row layout, used
   only for the Basic view's 3-column grid so it visually matches the sheet.
   ========================================================================= */
const SKILLS = {
  // Trained (no prerequisite)
  linguistics: { label: "Linguistics", tier: "trained", row: 0, prereqs: [] },
  zoology: { label: "Zoology", tier: "trained", row: 1, prereqs: [] },
  botany: { label: "Botany", tier: "trained", row: 3, prereqs: [] },
  geology: { label: "Geology", tier: "trained", row: 4, prereqs: [] },
  "industrial-equipment": { label: "Industrial Equipment", tier: "trained", row: 5, prereqs: [] },
  "jury-rigging": { label: "Jury-Rigging", tier: "trained", row: 6, prereqs: [] },
  chemistry: { label: "Chemistry", tier: "trained", row: 7, prereqs: [] },
  computers: { label: "Computers", tier: "trained", row: 8, prereqs: [] },
  "zero-g": { label: "Zero-G", tier: "trained", row: 9, prereqs: [] },
  mathematics: { label: "Mathematics", tier: "trained", row: 10, prereqs: [] },
  art: { label: "Art", tier: "trained", row: 11, prereqs: [] },
  archaeology: { label: "Archaeology", tier: "trained", row: 12, prereqs: [] },
  theology: { label: "Theology", tier: "trained", row: 13, prereqs: [] },
  "military-training": { label: "Military Training", tier: "trained", row: 14, prereqs: [] },
  rimwise: { label: "Rimwise", tier: "trained", row: 15, prereqs: [] },
  athletics: { label: "Athletics", tier: "trained", row: 16, prereqs: [] },

  // Expert
  psychology: { label: "Psychology", tier: "expert", row: 0, prereqs: ["linguistics", "zoology"] },
  pathology: { label: "Pathology", tier: "expert", row: 1, prereqs: ["zoology"] },
  "field-medicine": { label: "Field Medicine", tier: "expert", row: 2, prereqs: ["zoology"] },
  ecology: { label: "Ecology", tier: "expert", row: 3, prereqs: ["botany"] },
  "asteroid-mining": { label: "Asteroid Mining", tier: "expert", row: 4, prereqs: ["geology"] },
  "mechanical-repair": { label: "Mechanical Repair", tier: "expert", row: 5, prereqs: ["industrial-equipment", "jury-rigging"] },
  explosives: { label: "Explosives", tier: "expert", row: 6, prereqs: ["jury-rigging", "chemistry", "military-training"] },
  pharmacology: { label: "Pharmacology", tier: "expert", row: 7, prereqs: ["chemistry"] },
  hacking: { label: "Hacking", tier: "expert", row: 8, prereqs: ["computers"] },
  piloting: { label: "Piloting", tier: "expert", row: 9, prereqs: ["zero-g"] },
  physics: { label: "Physics", tier: "expert", row: 10, prereqs: ["mathematics"] },
  mysticism: { label: "Mysticism", tier: "expert", row: 11, prereqs: ["art", "archaeology"] },
  "wilderness-survival": { label: "Wilderness Survival", tier: "expert", row: 13, prereqs: ["botany", "theology", "military-training"] },
  firearms: { label: "Firearms", tier: "expert", row: 14, prereqs: ["military-training", "rimwise"] },
  "hand-to-hand-combat": { label: "Hand-to-Hand Combat", tier: "expert", row: 15, prereqs: ["rimwise", "military-training", "athletics"] },

  // Master
  sophontology: { label: "Sophontology", tier: "master", row: 0, prereqs: ["psychology"] },
  exobiology: { label: "Exobiology", tier: "master", row: 1, prereqs: ["pathology"] },
  surgery: { label: "Surgery", tier: "master", row: 2, prereqs: ["field-medicine", "pathology"] },
  planetology: { label: "Planetology", tier: "master", row: 3, prereqs: ["ecology", "asteroid-mining"] },
  robotics: { label: "Robotics", tier: "master", row: 4, prereqs: ["mechanical-repair"] },
  engineering: { label: "Engineering", tier: "master", row: 5, prereqs: ["mechanical-repair"] },
  cybernetics: { label: "Cybernetics", tier: "master", row: 6, prereqs: ["mechanical-repair"] },
  "artificial-intelligence": { label: "Artificial Intelligence", tier: "master", row: 8, prereqs: ["hacking"] },
  hyperspace: { label: "Hyperspace", tier: "master", row: 10, prereqs: ["physics", "piloting", "mysticism"] },
  xenoesotericism: { label: "Xenoesotericism", tier: "master", row: 11, prereqs: ["mysticism"] },
  command: { label: "Command", tier: "master", row: 14, prereqs: ["firearms", "piloting"] },
};
const SKILL_ROW_COUNT = 17;
const SKILL_TIER_BONUS = { trained: 10, expert: 15, master: 20 };
function skillsInColumn(tier) {
  return Object.entries(SKILLS)
    .filter(([, s]) => s.tier === tier)
    .sort((a, b) => a[1].row - b[1].row);
}

/* ---------- generic dom helper ---------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// Structural equality (key-order independent) — see the guide's §6: used instead of
// JSON.stringify to decide whether an incoming room-metadata snapshot actually
// differs from what we already have.
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

function trashIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.innerHTML =
    '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

function lockIcon(locked) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.innerHTML = locked
    ? '<rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'
    : '<rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 11V7a4 4 0 0 1 7.5-2" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>';
  return svg;
}

/* ---------- in-app confirm dialog (never the browser's native confirm()) ---------- */
let activeConfirmClose = null;
function closeConfirmDialog() {
  if (activeConfirmClose) activeConfirmClose();
}
function showConfirmDialog(message, onConfirm) {
  closeConfirmDialog();
  const overlay = el("div", { class: "confirm-overlay" });
  const box = el("div", { class: "confirm-box" });
  box.appendChild(el("div", { class: "confirm-message", text: message }));
  const actions = el("div", { class: "confirm-actions" });

  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    if (activeConfirmClose === close) activeConfirmClose = null;
  }
  activeConfirmClose = close;

  actions.appendChild(el("button", { class: "btn ghost", text: "Cancel", onclick: close }));
  actions.appendChild(
    el("button", {
      class: "btn danger",
      text: "Remove",
      onclick: () => {
        close();
        onConfirm();
      },
    })
  );
  box.appendChild(actions);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
}

/* ---------- personal notes editor (a much larger writing surface than fits inline) ---------- */
let activeNotesClose = null;
function closeNotesEditor() {
  if (activeNotesClose) activeNotesClose();
}
function openNotesEditor(character, save, locked) {
  closeConfirmDialog();
  closeNotesEditor();
  const overlay = el("div", { class: "confirm-overlay" });
  const box = el("div", { class: "confirm-box notes-box" });
  box.appendChild(el("div", { class: "notes-box-title", text: "Personal Notes" }));
  const area = el("textarea", {
    class: "field-textarea notes-box-textarea",
    disabled: locked || undefined,
    oninput: (e) => { character.personalNotes = e.target.value; save(); },
  });
  area.value = character.personalNotes || "";
  box.appendChild(area);
  const actions = el("div", { class: "confirm-actions" });

  function onKey(e) {
    if (e.key === "Escape") close();
  }
  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
    if (activeNotesClose === close) activeNotesClose = null;
    refreshTabContent();
  }
  activeNotesClose = close;

  actions.appendChild(el("button", { class: "btn primary", text: "Done", onclick: close }));
  box.appendChild(actions);
  overlay.appendChild(box);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  document.body.appendChild(overlay);
  area.focus();
}
function personalNotesLink(character, save) {
  const locked = sheetLocked;
  return el("button", {
    type: "button",
    class: "notes-link",
    onclick: () => openNotesEditor(character, save, locked),
  }, [
    "Personal Notes",
    character.personalNotes ? el("span", { class: "notes-link-badge", text: "✓" }) : el("span", { class: "notes-link-arrow", text: "→" }),
  ]);
}

/* =========================================================================
   Runtime state
   ========================================================================= */
let backend = "standalone"; // "obr" | "standalone"
let selfId = null;
let selfName = "";
let selfRole = "PLAYER";
let partyPlayers = [];

let activeTab = "sheet"; // "sheet" | "roster"
let activeCharacterId = null;
let expandedRosterId = null;

// Set for the duration of a single renderCharacterSheet() call when the viewer is a
// player looking at a character the GM has locked — every field-level component below
// checks this module-level flag rather than threading a readOnly param through the whole
// render tree. The GM's own view (Roster tab's expanded editor) always renders with this
// false, regardless of a character's lock state, since locking only restricts players.
let sheetLocked = false;

// Basic is the default starting point (character creation); a viewer who explicitly
// picks Advanced has that remembered, same as every other per-viewer preference here.
let sheetView = localStorage.getItem(VIEW_KEY) === "advanced" ? "advanced" : "basic";
function setSheetView(v) {
  sheetView = v;
  localStorage.setItem(VIEW_KEY, v);
  renderApp();
}

let theme = (() => {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "dark" || saved === "light" ? saved : null; // null = follow system
})();
function applyTheme() {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}
function toggleTheme() {
  const current = theme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  theme = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
  renderApp();
}
applyTheme();

function isGM() {
  // Outside Owlbear there's no room/role concept, so GM-only tabs stay visible in
  // standalone/local-preview mode to make it possible to test them.
  return backend !== "obr" || selfRole === "GM";
}

const app = document.getElementById("app");

/* =========================================================================
   Room metadata store — see the guide's §3/§6. Debounced per-key saves,
   deepEqual-guarded incoming changes, reused object identity, deferred
   re-render while a field is focused.
   ========================================================================= */
let roomMeta = {};
const roomSaveTimers = new Map();
let pendingRenderAfterEdit = false;

function isEditableFocused() {
  const ae = document.activeElement;
  return !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA");
}
document.addEventListener("focusout", () => {
  if (!pendingRenderAfterEdit) return;
  pendingRenderAfterEdit = false;
  renderApp();
});

async function loadRoomMeta() {
  if (backend === "obr") {
    roomMeta = await OBR.room.getMetadata();
  } else {
    try {
      const raw = localStorage.getItem(LOCAL_ROOM_KEY);
      roomMeta = raw ? JSON.parse(raw) : {};
    } catch {
      roomMeta = {};
    }
  }
}
function scheduleRoomSave(key) {
  clearTimeout(roomSaveTimers.get(key));
  roomSaveTimers.set(
    key,
    setTimeout(() => saveRoomKey(key), 250)
  );
}
async function saveRoomKey(key) {
  if (backend === "obr") {
    try {
      await OBR.room.setMetadata({ [key]: roomMeta[key] });
    } catch (e) {
      console.error("Mothership sheet: failed to save room key", key, e);
    }
  } else {
    localStorage.setItem(LOCAL_ROOM_KEY, JSON.stringify(roomMeta));
  }
}

/* ---------- roster (GM-managed index) ---------- */
function defaultRosterEntry(id) {
  return { id, access: "gm", ownerId: null, locked: false };
}
function normalizeRoster(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.id)
    .map((r) => ({
      id: r.id,
      access: ["gm", "everyone", "assigned"].includes(r.access) ? r.access : "gm",
      ownerId: typeof r.ownerId === "string" ? r.ownerId : null,
      locked: !!r.locked,
    }));
}
function getRoster() {
  return normalizeRoster(roomMeta[ROOM_KEYS.roster]);
}
function rosterEntryFor(id) {
  return getRoster().find((r) => r.id === id) || null;
}
function updateRoster(mutator) {
  const r = getRoster();
  mutator(r);
  roomMeta[ROOM_KEYS.roster] = r;
  scheduleRoomSave(ROOM_KEYS.roster);
}
function accessibleCharacterIds(playerId) {
  return getRoster()
    .filter((r) => r.access === "everyone" || (r.access === "assigned" && r.ownerId === playerId))
    .map((r) => r.id);
}
function connectedPlayers() {
  const others = partyPlayers.filter((p) => p.id !== selfId).map((p) => ({ id: p.id, name: p.name }));
  return [{ id: selfId, name: selfName }, ...others];
}

/* ---------- character data model ---------- */
function defaultCharacter(id) {
  return {
    id,
    name: "",
    pronouns: "",
    playerName: "",
    personalNotes: "",
    highScore: "",
    trinket: "",
    patch: "",
    class: null,
    classStatChoice: null,
    stats: { strength: "", speed: "", intellect: "", combat: "" },
    saves: { sanity: "", fear: "", body: "" },
    health: { current: "", max: "" },
    wounds: { current: "0", max: "2" },
    stress: { current: "2", min: "2" },
    skills: [],
    skillTraining: { inProgress: "", timeRemaining: "" },
    conditions: "",
    equipment: [],
    weapons: [],
    armorPoints: "",
    credits: "",
  };
}
function normalizeLineList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && typeof x === "object")
    .map((x) => ({ id: x.id || uid(), text: typeof x.text === "string" ? x.text : "" }));
}
function normalizeCharacter(raw, id) {
  const c = Object.assign(defaultCharacter(id), raw || {});
  c.id = id;
  c.stats = Object.assign({ strength: "", speed: "", intellect: "", combat: "" }, raw && raw.stats);
  c.saves = Object.assign({ sanity: "", fear: "", body: "" }, raw && raw.saves);
  c.health = Object.assign({ current: "", max: "" }, raw && raw.health);
  c.wounds = Object.assign({ current: "0", max: "2" }, raw && raw.wounds);
  c.stress = Object.assign({ current: "2", min: "2" }, raw && raw.stress);
  c.skillTraining = Object.assign({ inProgress: "", timeRemaining: "" }, raw && raw.skillTraining);
  c.skills = Array.isArray(raw && raw.skills)
    ? raw.skills
        .filter((s) => s && SKILLS[s.id] && ["trained", "expert", "master"].includes(s.tier))
        .map((s) => ({ id: s.id, tier: s.tier }))
    : [];
  c.equipment = normalizeLineList(raw && raw.equipment);
  c.weapons = normalizeLineList(raw && raw.weapons);
  c.class = CLASSES[raw && raw.class] ? raw.class : null;
  return c;
}
function getCharacter(id) {
  return normalizeCharacter(roomMeta[characterKey(id)], id);
}
// Reuses the SAME object identity across re-renders whenever roomMeta already holds a
// live, normalized character for this id — see the guide's §6 ("the delete bug") for
// why this matters: without it, a re-render mid-confirm-dialog silently orphans the
// dialog's captured reference and its action becomes a no-op.
function bindCharacter(id) {
  const key = characterKey(id);
  const existing = roomMeta[key];
  const character = existing || getCharacter(id);
  roomMeta[key] = character;
  return { character, save: () => scheduleRoomSave(key) };
}
function characterSkillTier(character, skillId) {
  const entry = character.skills.find((s) => s.id === skillId);
  return entry ? entry.tier : null;
}
function skillPrereqMet(character, skillId) {
  const skill = SKILLS[skillId];
  if (!skill.prereqs.length) return true;
  return skill.prereqs.some((p) => characterSkillTier(character, p) !== null);
}
function toggleCharacterSkill(character, save, skillId, tier) {
  const idx = character.skills.findIndex((s) => s.id === skillId);
  if (idx >= 0 && character.skills[idx].tier === tier) {
    character.skills.splice(idx, 1); // clicking the same tier again clears it
  } else if (idx >= 0) {
    character.skills[idx].tier = tier;
  } else {
    character.skills.push({ id: skillId, tier });
  }
  save();
  refreshTabContent();
}

/* =========================================================================
   Top-level render
   ========================================================================= */
function renderApp() {
  closeConfirmDialog();
  closeNotesEditor();
  app.innerHTML = "";

  if (backend === "standalone") {
    app.appendChild(el("div", { class: "standalone-banner", text: "Local preview — not connected to an Owlbear room" }));
  }

  if (activeTab === "roster" && !isGM()) activeTab = "sheet";

  app.appendChild(renderTopbar());
  const content = el("div", { id: "tab-content" });
  content.appendChild(renderActiveTab());
  app.appendChild(content);
  app.appendChild(el("div", { class: "credits-footer", text: "Mothership® is a trademark of Tuesday Knight Games. Unofficial fan-made tool." }));
}
function refreshTabContent() {
  const content = document.getElementById("tab-content");
  if (!content) return renderApp();
  content.innerHTML = "";
  content.appendChild(renderActiveTab());
}
function renderActiveTab() {
  if (activeTab === "roster" && isGM()) return renderRosterTab();
  return renderMySheetTab();
}

function themeIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  const effective = theme || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  svg.innerHTML =
    effective === "dark"
      ? '<circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
      : '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>';
  return svg;
}

function renderTopbar() {
  const bar = el("div", { class: "topbar" });
  const brand = el("div", { class: "topbar-brand" });
  const mark = el("div", { class: "brand-mark" });
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.innerHTML =
    '<path d="M7.08 25.45 L7.08 7.08 L16 20.2 L24.92 7.08 L24.92 25.45" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>' +
    '<path d="M8.39 25.45 L8.39 11.34 L16 22.54 L23.61 11.34 L23.61 25.45" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>' +
    '<path d="M9.7 25.45 L9.7 15.61 L16 24.86 L22.3 15.61 L22.3 25.45" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square" stroke-linejoin="miter"/>';
  mark.appendChild(svg);
  brand.appendChild(mark);
  brand.appendChild(el("span", { text: "Mothership" }));
  bar.appendChild(brand);

  const tabButtons = [
    el("button", {
      class: "tab-btn" + (activeTab === "sheet" ? " active" : ""),
      text: "Character",
      onclick: () => { activeTab = "sheet"; renderApp(); },
    }),
  ];
  if (isGM()) {
    tabButtons.push(
      el("button", {
        class: "tab-btn" + (activeTab === "roster" ? " active" : ""),
        text: "Roster",
        onclick: () => { activeTab = "roster"; renderApp(); },
      })
    );
  }
  bar.appendChild(el("div", { class: "tabs" }, tabButtons));

  const controls = el("div", { class: "topbar-controls" });
  const viewToggle = el("div", { class: "view-toggle" }, [
    el("button", {
      class: sheetView === "basic" ? "active" : "",
      text: "Basic",
      title: "Basic view — step-by-step creation, full skill tree",
      onclick: () => setSheetView("basic"),
    }),
    el("button", {
      class: sheetView === "advanced" ? "active" : "",
      text: "Advanced",
      title: "Advanced view — clean play sheet",
      onclick: () => setSheetView("advanced"),
    }),
  ]);
  controls.appendChild(viewToggle);
  controls.appendChild(
    el("button", { class: "icon-btn", title: "Toggle dark mode", onclick: toggleTheme }, [themeIcon()])
  );
  bar.appendChild(controls);

  return bar;
}

/* =========================================================================
   Character tab ("Hero" equivalent) — resolves accessible character(s)
   ========================================================================= */
function renderMySheetTab() {
  const wrap = el("div");
  const accessibleIds = accessibleCharacterIds(selfId);

  if (accessibleIds.length === 0) {
    wrap.appendChild(el("div", { class: "party-empty", text: "Your GM hasn't assigned you a character yet — ask them to add one on the Roster tab." }));
    return wrap;
  }
  if (!activeCharacterId || !accessibleIds.includes(activeCharacterId)) {
    activeCharacterId = accessibleIds[0];
  }
  if (accessibleIds.length > 1) {
    const pickerWrap = el("div", { class: "section-title" });
    const picker = el("div", { class: "tabs" });
    accessibleIds.forEach((id) => {
      const ch = getCharacter(id);
      picker.appendChild(
        el("button", {
          class: "tab-btn" + (id === activeCharacterId ? " active" : ""),
          text: ch.name || "Unnamed",
          onclick: () => { activeCharacterId = id; refreshTabContent(); },
        })
      );
    });
    pickerWrap.appendChild(picker);
    wrap.appendChild(pickerWrap);
  }

  const entry = rosterEntryFor(activeCharacterId);
  sheetLocked = !isGM() && !!entry && entry.locked;
  if (sheetLocked) {
    wrap.appendChild(
      el("div", { class: "locked-banner" }, [lockIcon(true), el("span", { text: "Locked by your GM — you can view this sheet, but not edit it." })])
    );
  }

  const { character, save } = bindCharacter(activeCharacterId);
  wrap.appendChild(renderCharacterSheet(character, save));
  sheetLocked = false;
  return wrap;
}

function renderCharacterSheet(character, save) {
  return sheetView === "basic" ? renderCharacterSheetBasic(character, save) : renderCharacterSheetAdvanced(character, save);
}

/* =========================================================================
   Shared field components
   ========================================================================= */
function textField(label, value, onInput, opts = {}) {
  const wrap = el("div", { class: "field-row" });
  if (label) wrap.appendChild(el("label", { class: "field-label", text: label }));
  const input = el("input", {
    type: "text",
    class: "field-input",
    value: value || "",
    placeholder: opts.placeholder || "",
    disabled: sheetLocked || undefined,
    oninput: (e) => onInput(e.target.value),
  });
  wrap.appendChild(input);
  return wrap;
}
function textAreaField(label, value, onInput, opts = {}) {
  const wrap = el("div", { class: "field-row" + (opts.tall ? " field-row-fill" : "") });
  if (label) wrap.appendChild(el("label", { class: "field-label", text: label }));
  const area = el("textarea", {
    class: "field-textarea" + (opts.tall ? " field-textarea-tall" : ""),
    placeholder: opts.placeholder || "",
    disabled: sheetLocked || undefined,
    oninput: (e) => onInput(e.target.value),
  });
  area.value = value || "";
  wrap.appendChild(area);
  return wrap;
}
function numberCircle(labelText, value, onInput, opts = {}) {
  const block = el("div", { class: "stat-block" + (opts.compact ? " compact" : "") });
  const circle = el("div", { class: "stat-circle" + (opts.compact ? " compact" : "") });
  circle.appendChild(
    el("input", {
      type: "text",
      inputmode: "numeric",
      value: value || "",
      disabled: sheetLocked || undefined,
      oninput: (e) => onInput(e.target.value),
    })
  );
  block.appendChild(circle);
  block.appendChild(el("div", { class: "stat-label", text: labelText }));
  return block;
}
function statusPillField(labelText, current, second, onCurrent, onSecond, opts = {}) {
  const locked = sheetLocked;
  const block = el("div", { class: "pill-block" });
  block.appendChild(el("div", { class: "stat-label", text: labelText }));

  const pill = el("div", { class: "status-pill" });
  const stepper = el("div", { class: "pill-stepper" });
  const step = (delta) => {
    if (locked) return;
    const next = Math.max(0, (parseInt(current, 10) || 0) + delta);
    onCurrent(String(next));
    refreshTabContent();
  };
  stepper.appendChild(el("button", { type: "button", class: "pill-step-btn up", title: "Increase", disabled: locked || undefined, onclick: () => step(1) }));
  stepper.appendChild(el("button", { type: "button", class: "pill-step-btn down", title: "Decrease", disabled: locked || undefined, onclick: () => step(-1) }));
  pill.appendChild(stepper);
  pill.appendChild(el("input", { type: "text", inputmode: "numeric", value: current || "", disabled: locked || undefined, oninput: (e) => onCurrent(e.target.value) }));
  pill.appendChild(el("span", { class: "pill-divider", text: "/" }));
  pill.appendChild(el("input", { type: "text", inputmode: "numeric", value: second || "", disabled: locked || undefined, oninput: (e) => onSecond(e.target.value) }));
  block.appendChild(pill);

  block.appendChild(el("div", { class: "pill-caption" }, [el("span", { text: "Current" }), el("span", { text: opts.secondLabel || "Max" })]));
  return block;
}

function renderLineList(character, save, key, opts) {
  const wrap = el("div", { class: "line-list" });
  character[key].forEach((item) => {
    const row = el("div", { class: "line-list-row" });
    row.appendChild(
      el("input", {
        type: "text",
        class: "field-input",
        value: item.text,
        placeholder: opts.placeholder || "",
        disabled: sheetLocked || undefined,
        oninput: (e) => {
          item.text = e.target.value;
          save();
        },
      })
    );
    row.appendChild(
      el(
        "button",
        {
          class: "trash-btn",
          title: "Remove",
          disabled: sheetLocked || undefined,
          onclick: () => {
            showConfirmDialog(`Remove this ${opts.singular || "item"}?`, () => {
              character[key] = character[key].filter((x) => x.id !== item.id);
              save();
              refreshTabContent();
            });
          },
        },
        [trashIcon()]
      )
    );
    wrap.appendChild(row);
  });
  const outer = el("div");
  outer.appendChild(wrap);
  if (!opts.hideAddButton) {
    outer.appendChild(
      el("button", {
        class: "add-row-btn",
        text: "+ Add " + (opts.singular || "item"),
        disabled: sheetLocked || undefined,
        onclick: () => {
          character[key].push({ id: uid(), text: "" });
          save();
          refreshTabContent();
        },
      })
    );
  }
  return outer;
}
// A list's title on the left, a small "+" button right-aligned on the same line —
// used where a section header should double as the add-item control (Basic view's
// step 8), instead of a dashed "+ Add ..." button sitting below the list.
function lineListSectionHeader(title, onAdd) {
  return el("div", { class: "list-section-header" }, [
    el("span", { text: title }),
    el("button", { type: "button", class: "list-add-btn", title: "Add " + title.toLowerCase(), disabled: sheetLocked || undefined, onclick: onAdd }, ["+"]),
  ]);
}
// A panel's own dark title bar, with the same "+" add control from lineListSectionHeader
// pinned to its right edge instead of sitting in a separate row below it — used where the
// panel header already names the list (Advanced view's Equipment/Weapons), so the title
// stays centered like every other panel header while the button floats over it.
function panelHeaderWithAdd(title, onAdd) {
  return el("div", { class: "panel-header panel-header-with-add" }, [
    el("span", {}, [title]),
    el("button", { type: "button", class: "list-add-btn", title: "Add " + title.toLowerCase(), disabled: sheetLocked || undefined, onclick: onAdd }, ["+"]),
  ]);
}

function statusReportSection(character, save) {
  const wrap = el("div");
  wrap.appendChild(statusReportRow(character, save, ["health", "wounds", "stress"]));
  wrap.appendChild(
    textAreaField("Conditions", character.conditions, (v) => { character.conditions = v; save(); }, { placeholder: "Injuries, afflictions, cybernetics…" })
  );
  return wrap;
}

function skillTrainingSection(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Skill Training" }));
  const body = el("div", { class: "panel-body" });
  const row = el("div", { class: "field-row" }, []);
  const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;" });
  grid.appendChild(
    textField("In Progress", character.skillTraining.inProgress, (v) => { character.skillTraining.inProgress = v; save(); })
  );
  grid.appendChild(
    textField("Time Remaining", character.skillTraining.timeRemaining, (v) => { character.skillTraining.timeRemaining = v; save(); })
  );
  row.appendChild(grid);
  body.appendChild(row);
  wrap.appendChild(body);
  return wrap;
}

function equipmentPanel(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(
    panelHeaderWithAdd("Equipment", () => {
      character.equipment.push({ id: uid(), text: "" });
      save();
      refreshTabContent();
    })
  );
  const body = el("div", { class: "panel-body" });
  body.appendChild(renderLineList(character, save, "equipment", { singular: "item", placeholder: "Equipment item…", hideAddButton: true }));
  const row = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;" });
  row.appendChild(textField("Armor Points", character.armorPoints, (v) => { character.armorPoints = v; save(); }));
  row.appendChild(textField("Credits", character.credits, (v) => { character.credits = v; save(); }));
  body.appendChild(row);
  wrap.appendChild(body);
  return wrap;
}
function weaponsPanel(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(
    panelHeaderWithAdd("Weapons", () => {
      character.weapons.push({ id: uid(), text: "" });
      save();
      refreshTabContent();
    })
  );
  const body = el("div", { class: "panel-body" });
  body.appendChild(renderLineList(character, save, "weapons", { singular: "weapon", placeholder: "Weapon…", hideAddButton: true }));
  wrap.appendChild(body);
  return wrap;
}

/* =========================================================================
   Advanced view — the clean play sheet
   ========================================================================= */
function personalDetailsPanelAdvanced(character, save) {
  const wrap = el("div", { class: "panel personal-details-panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Personal Details" }));
  const body = el("div", { class: "panel-body" });
  body.appendChild(textField("Character Name", character.name, (v) => { character.name = v; save(); }));
  const row2 = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;" });
  row2.appendChild(textField("Pronouns", character.pronouns, (v) => { character.pronouns = v; save(); }));
  row2.appendChild(textField("Player Name", character.playerName, (v) => { character.playerName = v; save(); }));
  body.appendChild(row2);
  const row3 = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:12px;" });
  row3.appendChild(textField("Trinket", character.trinket, (v) => { character.trinket = v; save(); }));
  row3.appendChild(textField("Patch", character.patch, (v) => { character.patch = v; save(); }));
  body.appendChild(row3);
  body.appendChild(textField("High Score", character.highScore, (v) => { character.highScore = v; save(); }));
  body.appendChild(personalNotesLink(character, save));
  wrap.appendChild(body);
  return wrap;
}
function classPanelAdvanced(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Class" }));
  const body = el("div", { class: "panel-body" });
  body.appendChild(classSelect(character, save));
  const cls = character.class ? CLASSES[character.class] : null;
  body.appendChild(
    el("div", { class: "trauma-box", style: "margin-top:10px;", text: cls ? cls.trauma : "Select a class above to see its Trauma Response." })
  );
  wrap.appendChild(body);
  return wrap;
}
function classSelect(character, save) {
  const wrap = el("div", { class: "field-row" });
  wrap.appendChild(el("label", { class: "field-label", text: "Class" }));
  const select = el(
    "select",
    {
      class: "field-input",
      disabled: sheetLocked || undefined,
      onchange: (e) => {
        character.class = e.target.value || null;
        save();
        refreshTabContent();
      },
    },
    [
      el("option", { value: "", text: "— none —", selected: !character.class ? "selected" : undefined }),
      ...CLASS_ORDER.map((k) => el("option", { value: k, text: CLASSES[k].label, selected: character.class === k ? "selected" : undefined })),
    ]
  );
  wrap.appendChild(select);
  return wrap;
}
function skillListAdvanced(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Skills" }));
  const body = el("div", { class: "panel-body" });
  if (character.skills.length === 0) {
    body.appendChild(el("div", { class: "skill-list-empty", text: "No skills chosen yet — switch to the Basic view to pick skills from the tree." }));
  } else {
    const list = el("div", { class: "skill-list" });
    [...character.skills]
      .sort((a, b) => (SKILLS[a.id]?.label || "").localeCompare(SKILLS[b.id]?.label || ""))
      .forEach((s) => {
        const skill = SKILLS[s.id];
        if (!skill) return;
        const row = el("div", { class: "skill-list-row" });
        row.appendChild(el("span", { class: "skill-list-name", text: skill.label }));
        row.appendChild(el("span", { class: "skill-list-tier", text: `${s.tier} (+${SKILL_TIER_BONUS[s.tier]})` }));
        list.appendChild(row);
      });
    body.appendChild(list);
  }
  body.appendChild(skillTrainingBlock(character, save));
  wrap.appendChild(body);
  return wrap;
}
function skillTrainingBlock(character, save) {
  const wrap = el("div", { class: "panel-body tight", style: "margin-top:10px;border-top:2px solid var(--muted-border);" });
  wrap.appendChild(el("div", { class: "field-label", text: "Skill Training" }));
  const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;" });
  grid.appendChild(textField("In Progress", character.skillTraining.inProgress, (v) => { character.skillTraining.inProgress = v; save(); }));
  grid.appendChild(textField("Time Remaining", character.skillTraining.timeRemaining, (v) => { character.skillTraining.timeRemaining = v; save(); }));
  wrap.appendChild(grid);
  return wrap;
}

function statsPanelAdvanced(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Stats" }));
  wrap.appendChild(el("div", { class: "panel-body" }, [statsAndSavesSectionStatsOnly(character, save)]));
  return wrap;
}
function savesPanelAdvanced(character, save) {
  const wrap = el("div", { class: "panel" });
  wrap.appendChild(el("div", { class: "panel-header", text: "Saves" }));
  wrap.appendChild(el("div", { class: "panel-body" }, [statsAndSavesSectionSavesOnly(character, save)]));
  return wrap;
}

function renderCharacterSheetAdvanced(character, save) {
  const wrap = el("div", { class: "advanced-three-col" });

  // Column 1: identity. Column 2: the numeric "vitals". Column 3: skills & loadout —
  // three roughly-even columns so the whole sheet fits without scrolling, rather than
  // one tall narrow sidebar plus one tall wide column.
  const col1 = el("div", { class: "stack" });
  col1.appendChild(personalDetailsPanelAdvanced(character, save));
  col1.appendChild(classPanelAdvanced(character, save));

  const col2 = el("div", { class: "stack" });
  col2.appendChild(statsPanelAdvanced(character, save));
  col2.appendChild(savesPanelAdvanced(character, save));
  const statusPanel = el("div", { class: "panel" });
  statusPanel.appendChild(el("div", { class: "panel-header", text: "Status Report" }));
  statusPanel.appendChild(el("div", { class: "panel-body" }, [statusReportSection(character, save)]));
  col2.appendChild(statusPanel);

  const col3 = el("div", { class: "stack" });
  col3.appendChild(skillListAdvanced(character, save));
  col3.appendChild(equipmentPanel(character, save));
  col3.appendChild(weaponsPanel(character, save));

  wrap.appendChild(col1);
  wrap.appendChild(col2);
  wrap.appendChild(col3);
  return wrap;
}

/* =========================================================================
   Basic view — step-by-step creation sheet with the full skill tree
   ========================================================================= */
function stepPanel(number, title, bodyChildren) {
  const wrap = el("div", { class: "panel" });
  const header = el("div", { class: "panel-header" });
  header.appendChild(el("span", {}, [el("span", { class: "step-number", text: String(number) }), title]));
  wrap.appendChild(header);
  wrap.appendChild(el("div", { class: "panel-body" }, bodyChildren));
  return wrap;
}
function classCard(character, save, key) {
  const cls = CLASSES[key];
  const selected = character.class === key;
  const locked = sheetLocked;
  const card = el("div", {
    class: "class-card" + (selected ? " selected" : "") + (locked ? " locked-noninteractive" : ""),
    onclick: () => {
      if (locked) return;
      character.class = selected ? null : key;
      save();
      refreshTabContent();
    },
  });
  card.appendChild(el("div", { class: "class-name", text: cls.label }));
  const ul = el("ul");
  ul.appendChild(el("li", { text: cls.statBonusText }));
  ul.appendChild(el("li", { text: cls.saveBonusText }));
  if (cls.woundsBonusText) ul.appendChild(el("li", { text: cls.woundsBonusText }));
  card.appendChild(ul);
  if (selected && (cls.statPenaltyChoice || cls.statBonusChoice)) {
    const choiceRow = el("div", { class: "stat-choice-row" });
    choiceRow.addEventListener("click", (e) => e.stopPropagation());
    choiceRow.appendChild(el("span", { text: cls.statPenaltyChoice ? "−10 to:" : "+5 to:" }));
    const select = el(
      "select",
      {
        disabled: sheetLocked || undefined,
        onchange: (e) => { character.classStatChoice = e.target.value; save(); },
      },
      STAT_KEYS.map((k) => el("option", { value: k, text: STAT_LABELS[k], selected: character.classStatChoice === k ? "selected" : undefined }))
    );
    choiceRow.appendChild(select);
    card.appendChild(choiceRow);
  }
  return card;
}
function classStepPanel(character, save) {
  const grid = el("div", { class: "class-grid" });
  CLASS_ORDER.forEach((key) => grid.appendChild(classCard(character, save, key)));
  return stepPanel(3, "Select Your Class", [
    el("div", { class: "hint", text: "Tap a class to select it. Its stat/save bonuses are shown for reference — add them to your rolled Stats & Saves above yourself." }),
    grid,
  ]);
}
function traumaStepPanel(character) {
  const cls = character.class ? CLASSES[character.class] : null;
  return stepPanel(6, "Take Note of Your Class's Trauma Response", [
    el("div", { class: "trauma-box", text: cls ? cls.trauma : "Select a class above to see its Trauma Response." }),
  ]);
}

function skillTreeNode(character, save, skillId) {
  const skill = SKILLS[skillId];
  const currentTier = characterSkillTier(character, skillId);
  const met = skillPrereqMet(character, skillId);
  const row = el("div", { class: "skill-node-row" });
  const active = currentTier === skill.tier;
  const btn = el("button", {
    class: "skill-node-btn" + (active ? " " + skill.tier : ""),
    "data-skill-id": skillId,
    disabled: sheetLocked || (skill.tier !== "trained" && !met) ? "disabled" : undefined,
    title: active ? "Click to clear" : `Take as ${skill.tier}`,
    onclick: () => toggleCharacterSkill(character, save, skillId, skill.tier),
  });
  row.appendChild(btn);
  const labelWrap = el("div", { class: "skill-node-label" }, [skill.label]);
  if (skill.prereqs.length) {
    labelWrap.appendChild(
      el("span", { class: "skill-prereq-hint", text: "requires: " + skill.prereqs.map((p) => SKILLS[p].label).join(" or ") })
    );
  }
  row.appendChild(labelWrap);
  return row;
}
function skillTreeColumn(character, save, tier, title) {
  const col = el("div");
  col.appendChild(el("div", { class: "skill-tree-col-header", text: title }));
  const bySkillRow = {};
  skillsInColumn(tier).forEach(([id]) => { bySkillRow[SKILLS[id].row] = id; });
  for (let r = 0; r < SKILL_ROW_COUNT; r++) {
    const id = bySkillRow[r];
    if (id) col.appendChild(skillTreeNode(character, save, id));
    else col.appendChild(el("div", { class: "skill-node-row placeholder" }, [el("span", { text: "·" })]));
  }
  return col;
}
// One column per class, directly under the step 7 title — each class's starting
// skills and bonus-skill allowance, matching the source sheet's own header row (this
// is also where "Bonus: ..." moved from the step 3 class cards, which now only cover
// stat/save bonuses).
function classSkillsRow() {
  const grid = el("div", { class: "class-skills-row" });
  CLASS_ORDER.forEach((key) => {
    const cls = CLASSES[key];
    const cell = el("div", { class: "class-skills-cell" });
    cell.appendChild(el("div", { class: "class-name", text: cls.label }));
    cell.appendChild(el("div", { class: "class-skills-text", text: cls.startingSkillsText }));
    cell.appendChild(el("div", { class: "class-bonus-skill", text: cls.bonusSkillText }));
    grid.appendChild(cell);
  });
  return grid;
}
function skillTreeStepPanel(character, save) {
  const treeWrap = el("div", { class: "skill-tree-wrap" });
  const cols = el("div", { class: "skill-tree-cols" });
  cols.appendChild(skillTreeColumn(character, save, "trained", "Trained (+10)"));
  cols.appendChild(skillTreeColumn(character, save, "expert", "Expert (+15)"));
  cols.appendChild(skillTreeColumn(character, save, "master", "Master (+20)"));
  treeWrap.appendChild(cols);
  return stepPanel(7, "Note Class Skills and Choose Bonus Skills", [
    el("div", { class: "hint", text: "To take a Master or Expert skill you must first have at least one of its listed prerequisites. Tap a dot to take that skill at that tier; tap it again to clear it." }),
    classSkillsRow(),
    treeWrap,
  ]);
}
// Step 8 writes straight into the same fields the Advanced view's Equipment/Weapons
// panels and Personal Details show (`equipment`, `weapons`, `trinket`, `patch`,
// `armorPoints`, `credits`) — reusing the exact same list component Advanced uses for
// Equipment/Weapons, so nothing entered here needs a separate "loadout" record to stay
// in sync; the two views are just two renderings of the same data.
function equipmentStepPanel(character, save) {
  return stepPanel(8, "Roll for Your Equipment Loadout, Trinket & Patch", [
    lineListSectionHeader("Equipment", () => {
      character.equipment.push({ id: uid(), text: "" });
      save();
      refreshTabContent();
    }),
    renderLineList(character, save, "equipment", { singular: "item", placeholder: "Equipment item…", hideAddButton: true }),
    lineListSectionHeader("Weapons", () => {
      character.weapons.push({ id: uid(), text: "" });
      save();
      refreshTabContent();
    }),
    renderLineList(character, save, "weapons", { singular: "weapon", placeholder: "Weapon…", hideAddButton: true }),
    el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;" }, [
      textField("Trinket", character.trinket, (v) => { character.trinket = v; save(); }),
      textField("Patch", character.patch, (v) => { character.patch = v; save(); }),
    ]),
    el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;" }, [
      textField("Armor Points", character.armorPoints, (v) => { character.armorPoints = v; save(); }),
      textField("Credits (2d10×10)", character.credits, (v) => { character.credits = v; save(); }),
    ]),
  ]);
}

function renderCharacterSheetBasic(character, save) {
  const wrap = el("div");
  const cols = el("div", { class: "basic-outer-cols" });

  // Left column — matches the source sheet's left half: identity + Stats/Saves side by
  // side at the top, then the numbered creation steps 3-6.
  const left = el("div", { class: "stack" });

  const header = el("div", { class: "panel" });
  header.appendChild(el("div", { class: "panel-header", text: "Personal Details" }));
  const headerBody = el("div", { class: "dark-block panel-body" });
  headerBody.appendChild(textField("Character Name", character.name, (v) => { character.name = v; save(); }));
  headerBody.appendChild(textField("Pronouns", character.pronouns, (v) => { character.pronouns = v; save(); }));
  headerBody.appendChild(textField("Player Name", character.playerName, (v) => { character.playerName = v; save(); }));
  headerBody.appendChild(personalNotesLink(character, save));
  header.appendChild(headerBody);

  // Personal Details sits to the left of Stats/Saves (stacked), matching the source
  // sheet's top-left arrangement. Personal Details only holds single-line fields now, so
  // it gets a narrower share than Stats/Saves, which needs the room for its circles.
  const identityAndStats = el("div", { class: "identity-stats-row" });
  identityAndStats.appendChild(header);
  const statsStack = el("div", { class: "stack" });
  statsStack.appendChild(stepPanel(1, "Roll 2d10+25", [statsAndSavesSectionStatsOnly(character, save, { compact: true })]));
  statsStack.appendChild(stepPanel(2, "Roll 2d10+10", [statsAndSavesSectionSavesOnly(character, save, { compact: true })]));
  identityAndStats.appendChild(statsStack);
  left.appendChild(identityAndStats);

  left.appendChild(classStepPanel(character, save));

  // Steps 4 and 5 sit side by side (still two separate boxes), matching the source
  // sheet's row — Health/Wounds gets more room since it holds two pills to Stress's one.
  const healthStressRow = el("div", { class: "health-stress-row" });
  healthStressRow.appendChild(
    stepPanel(4, "Roll 1d10+10 for Health — starts at Max and 0 Wounds", [
      statusReportRow(character, save, ["health", "wounds"]),
    ])
  );
  healthStressRow.appendChild(stepPanel(5, "Stress — starts at 2", [statusReportRow(character, save, ["stress"])]));
  left.appendChild(healthStressRow);

  left.appendChild(traumaStepPanel(character));

  // Right column — the full skill tree (step 7), then step 8's loadout below it, then
  // Conditions and Skill Training which sit below on the source sheet's right half.
  const right = el("div", { class: "stack" });
  right.appendChild(skillTreeStepPanel(character, save));
  right.appendChild(equipmentStepPanel(character, save));

  const conditionsPanel = el("div", { class: "panel" });
  conditionsPanel.appendChild(el("div", { class: "panel-header", text: "Conditions" }));
  conditionsPanel.appendChild(
    el("div", { class: "panel-body" }, [
      textAreaField(null, character.conditions, (v) => { character.conditions = v; save(); }),
    ])
  );
  right.appendChild(conditionsPanel);
  right.appendChild(skillTrainingSection(character, save));

  cols.appendChild(left);
  cols.appendChild(right);
  wrap.appendChild(cols);

  return wrap;
}
function statsAndSavesSectionStatsOnly(character, save, opts = {}) {
  const row = el("div", { class: "circle-row" + (opts.compact ? " compact" : "") });
  STAT_KEYS.forEach((k) => row.appendChild(numberCircle(STAT_LABELS[k], character.stats[k], (v) => { character.stats[k] = v; save(); }, opts)));
  return row;
}
function statsAndSavesSectionSavesOnly(character, save, opts = {}) {
  const row = el("div", { class: "circle-row" + (opts.compact ? " compact" : "") });
  SAVE_KEYS.forEach((k) => row.appendChild(numberCircle(SAVE_LABELS[k], character.saves[k], (v) => { character.saves[k] = v; save(); }, opts)));
  return row;
}
function statusReportRow(character, save, keys) {
  const row = el("div", { class: "pill-row" });
  const labels = { health: "Health", wounds: "Wounds", stress: "Stress" };
  keys.forEach((key) => {
    const secondLabel = key === "stress" ? "Min" : "Max";
    row.appendChild(
      statusPillField(
        labels[key],
        character[key].current,
        key === "stress" ? character[key].min : character[key].max,
        (v) => { character[key].current = v; save(); },
        (v) => {
          if (key === "stress") character[key].min = v;
          else character[key].max = v;
          save();
        },
        { secondLabel }
      )
    );
  });
  return row;
}

/* =========================================================================
   Roster tab (GM only)
   ========================================================================= */
function renderRosterTab() {
  // The GM's own editor is never subject to a character's lock — only players are.
  sheetLocked = false;
  const wrap = el("div", { class: "section-title-wrap" });
  const title = el("div", { class: "section-title" }, [
    el("span", { text: "Roster" }),
    el("button", {
      class: "btn small",
      text: "+ Add Character",
      onclick: () => {
        const id = uid();
        updateRoster((r) => r.push(defaultRosterEntry(id)));
        roomMeta[characterKey(id)] = defaultCharacter(id);
        scheduleRoomSave(characterKey(id));
        expandedRosterId = id;
        refreshTabContent();
      },
    }),
  ]);
  wrap.appendChild(title);
  wrap.appendChild(el("div", { class: "hint", text: "Add a character for each Hero, then assign who can see and edit it. Players won't see anything on the Character tab until you do." }));

  const roster = getRoster();
  if (roster.length === 0) {
    wrap.appendChild(el("div", { class: "party-empty", text: "No characters yet." }));
    return wrap;
  }
  const players = connectedPlayers();

  roster.forEach((entry) => {
    const character = getCharacter(entry.id);
    const rowWrap = el("div", { class: "roster-item" });
    const row = el("div", { class: "roster-row" });
    row.appendChild(
      el("input", {
        type: "text",
        class: "field-input",
        placeholder: "Character name",
        value: character.name,
        oninput: (e) => {
          const { character: c, save } = bindCharacter(entry.id);
          c.name = e.target.value;
          save();
        },
      })
    );
    const accessOptions = [
      el("option", { value: "gm", text: "GM only", selected: entry.access === "gm" ? "selected" : undefined }),
      el("option", { value: "everyone", text: "Everyone", selected: entry.access === "everyone" ? "selected" : undefined }),
      ...players.map((p) =>
        el("option", { value: p.id, text: p.name, selected: entry.access === "assigned" && entry.ownerId === p.id ? "selected" : undefined })
      ),
    ];
    row.appendChild(
      el(
        "select",
        {
          class: "access-select",
          onchange: (e) => {
            const v = e.target.value;
            updateRoster((r) => {
              const target = r.find((x) => x.id === entry.id);
              if (!target) return;
              if (v === "gm") { target.access = "gm"; target.ownerId = null; }
              else if (v === "everyone") { target.access = "everyone"; target.ownerId = null; }
              else { target.access = "assigned"; target.ownerId = v; }
            });
          },
        },
        accessOptions
      )
    );
    row.appendChild(
      el(
        "button",
        {
          type: "button",
          class: "icon-btn lock-toggle-btn" + (entry.locked ? " active" : ""),
          title: entry.locked ? "Locked — players can view but not edit. Click to unlock." : "Unlocked — players with access can edit. Click to lock.",
          onclick: () => {
            updateRoster((r) => {
              const target = r.find((x) => x.id === entry.id);
              if (target) target.locked = !target.locked;
            });
            refreshTabContent();
          },
        },
        [lockIcon(entry.locked)]
      )
    );
    const expanded = expandedRosterId === entry.id;
    row.appendChild(
      el("button", {
        class: "btn small ghost",
        text: expanded ? "Collapse" : "Expand",
        onclick: () => { expandedRosterId = expanded ? null : entry.id; refreshTabContent(); },
      })
    );
    row.appendChild(
      el("button", {
        class: "trash-btn",
        title: "Remove character",
        onclick: () => {
          showConfirmDialog("Remove this character? This cannot be undone.", () => {
            updateRoster((r) => {
              const idx = r.findIndex((x) => x.id === entry.id);
              if (idx >= 0) r.splice(idx, 1);
            });
            delete roomMeta[characterKey(entry.id)];
            scheduleRoomSave(characterKey(entry.id));
            if (expandedRosterId === entry.id) expandedRosterId = null;
            refreshTabContent();
          });
        },
      }, [trashIcon()])
    );
    rowWrap.appendChild(row);

    if (expanded) {
      const { character: liveCharacter, save } = bindCharacter(entry.id);
      const editorBox = el("div", { class: "roster-editor" });
      editorBox.appendChild(renderCharacterSheet(liveCharacter, save));
      rowWrap.appendChild(editorBox);
    }
    wrap.appendChild(rowWrap);
  });
  return wrap;
}

/* =========================================================================
   Boot
   ========================================================================= */
async function boot() {
  if (OBR.isAvailable) {
    backend = "obr";
    await new Promise((resolve) => OBR.onReady(resolve));
    selfId = OBR.player.id;
    selfName = await OBR.player.getName();
    selfRole = await OBR.player.getRole();

    OBR.player.onChange(async () => {
      selfName = await OBR.player.getName();
      selfRole = await OBR.player.getRole();
      renderApp();
    });
    OBR.party.onChange((players) => {
      partyPlayers = players;
      if (activeTab === "roster") refreshTabContent();
    });
    partyPlayers = await OBR.party.getPlayers();

    OBR.room.onMetadataChange((meta) => {
      const changed = !deepEqual(meta, roomMeta);
      if (!changed) return;
      roomMeta = meta;
      if (isEditableFocused()) pendingRenderAfterEdit = true;
      else renderApp();
    });
  } else {
    backend = "standalone";
    selfId = "local";
    selfName = "Local preview";
    selfRole = "PLAYER";
  }

  await loadRoomMeta();
  renderApp();
}

boot();
