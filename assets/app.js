// Dubai & UAE Events: reads data/events.csv and renders a month calendar and a dated list.
// To add a flyer, put the file in /flyers and write its filename in the event's "flyers" column
// (several files: separate with ";"). Full https:// links work too.

const CONFIG = {
  csv: "data/events.csv",
  flyerDir: "flyers/",
  firstMonth: [2026, 10], // November 2026 (month is 0-based)
  monthCount: 12,
  // Dates with the highest hotel demand (shown with a gold tint and ★)
  highDemand: [
    ["2026-11-03", "2026-11-14"],
    ["2026-11-23", "2026-11-26"],
    ["2026-12-07", "2026-12-12"],
    ["2026-12-24", "2026-12-27"],
    ["2026-12-28", "2027-01-01"],
  ],
  types: {
    "Conference":    { cls: "t-conf",  label: "Conferences & trade shows" },
    "Festival":      { cls: "t-fest",  label: "Festivals" },
    "Sports":        { cls: "t-sport", label: "Sports" },
    "Art & Culture": { cls: "t-art",   label: "Art & culture" },
    "Concert":       { cls: "t-music", label: "Concerts & shows" },
    "Holiday":       { cls: "t-hol",   label: "Public holidays" },
  },
  linkLabels: {
    official: "Official website",
    venue: "Venue & tickets",
    guide: "Official tourism listing",
  },
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = MONTHS.map((m) => m.slice(0, 3));
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY = 86400000;

const state = { view: "calendar", month: 0, types: new Set(Object.keys(CONFIG.types)), city: "", q: "" };
let EVENTS = [];
let byId = {};
let current = null;

const $ = (id) => document.getElementById(id);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
  return n;
};

// ---------- data ----------
function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

const toDate = (s) => {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function prepare(r) {
  const start = toDate(r.start);
  const end = toDate(r.end) || start;
  if (!start) return null;
  const type = CONFIG.types[r.type] ? r.type : "Festival";
  const flyers = (r.flyers || "").split(/[;\n|]/).map((s) => s.trim()).filter(Boolean)
    .map((f) => (/^https?:\/\//.test(f) ? f : CONFIG.flyerDir + f.replace(/^\/?flyers\//, "")));
  const tbc = /^dates tbc/i.test(r.status || "");
  const days = Math.round((end - start) / DAY) + 1;
  return { ...r, start, end, type, flyers, tbc, days, ongoing: tbc || days > 20, cls: CONFIG.types[type].cls };
}

const peakSet = new Set();
for (const [a, b] of CONFIG.highDemand) for (let d = toDate(a); d <= toDate(b); d = addDays(d, 1)) peakSet.add(key(d));
const isPeakEvent = (e) => { for (let d = e.start; d <= e.end; d = addDays(d, 1)) if (peakSet.has(key(d))) return true; return false; };

function monthRange(i) {
  const [y, m] = CONFIG.firstMonth;
  const first = new Date(y, m + i, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { first, last, name: MONTHS[first.getMonth()], year: first.getFullYear() };
}

const overlaps = (e, a, b) => e.start <= b && e.end >= a;

function matches(e) {
  if (!state.types.has(e.type)) return false;
  if (state.city && !e.city.includes(state.city)) return false;
  if (state.q) {
    const hay = `${e.event} ${e.venue} ${e.city} ${e.about} ${e.details} ${e.type}`.toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

// ---------- formatting ----------
function fmtRange(e) {
  const s = e.start, t = e.end;
  if (e.tbc) {
    const inMonth = s.getMonth() === t.getMonth() && s.getFullYear() === t.getFullYear();
    return inMonth ? `${MONTHS[s.getMonth()]} ${s.getFullYear()} (dates TBC)` : `${MON[s.getMonth()]} – ${MON[t.getMonth()]} ${t.getFullYear()} (dates TBC)`;
  }
  if (+s === +t) return `${DOW[s.getDay()]} ${s.getDate()} ${MON[s.getMonth()]} ${s.getFullYear()}`;
  if (s.getFullYear() !== t.getFullYear()) return `${s.getDate()} ${MON[s.getMonth()]} ${s.getFullYear()} – ${t.getDate()} ${MON[t.getMonth()]} ${t.getFullYear()}`;
  if (s.getMonth() !== t.getMonth()) return `${s.getDate()} ${MON[s.getMonth()]} – ${t.getDate()} ${MON[t.getMonth()]} ${t.getFullYear()}`;
  return `${s.getDate()}–${t.getDate()} ${MON[s.getMonth()]} ${s.getFullYear()}`;
}
const where = (e) => [e.venue, e.city].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
const warnStatus = (s) => /tbc|expected|unverified|conflict|single|one source|reported|not announced/i.test(s);
const isImage = (f) => /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i.test(f);

// ---------- filters UI ----------
function buildFilters() {
  const counts = {};
  EVENTS.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
  $("type-filters").replaceChildren(...Object.entries(CONFIG.types).map(([t, cfg]) =>
    el("button", { type: "button", class: `chip ${cfg.cls}`, "aria-pressed": "true", "data-type": t, onclick: (ev) => toggleType(t, ev) },
      el("span", { class: "sw" }), cfg.label, el("span", { class: "n" }, String(counts[t] || 0)))));

  const cities = new Set();
  EVENTS.forEach((e) => e.city.split(/\s*[·\/]\s*/).forEach((c) => c && cities.add(c)));
  const sel = $("city");
  [...cities].sort().forEach((c) => sel.append(el("option", { value: c }, c)));

  $("legend").replaceChildren(
    ...Object.values(CONFIG.types).map((cfg) => el("span", { class: cfg.cls }, el("span", { class: "sw" }), cfg.label)),
    el("span", {}, el("span", { class: "sw peak" }), "★ Peak hotel-demand dates"));
}

function toggleType(t, ev) {
  // With every type showing, a click shows only that type; after that, clicks add or remove types.
  const all = state.types.size === Object.keys(CONFIG.types).length;
  if (all && !ev.altKey) state.types = new Set([t]);
  else if (state.types.has(t)) { state.types.delete(t); if (!state.types.size) state.types = new Set(Object.keys(CONFIG.types)); }
  else state.types.add(t);
  document.querySelectorAll("#type-filters .chip").forEach((c) => c.setAttribute("aria-pressed", String(state.types.has(c.dataset.type))));
  render();
}

function buildMonths() {
  const nav = $("months");
  nav.replaceChildren(...Array.from({ length: CONFIG.monthCount }, (_, i) => {
    const r = monthRange(i);
    const label = r.first.getMonth() === 0 || i === 0 ? `${MON[r.first.getMonth()]} ${r.year}` : MON[r.first.getMonth()];
    return el("button", { type: "button", "data-i": i, onclick: () => goMonth(i, true) }, label, el("span", { class: "n" }));
  }));
}

function updateMonthCounts() {
  document.querySelectorAll("#months button").forEach((b) => {
    const r = monthRange(+b.dataset.i);
    b.querySelector(".n").textContent = EVENTS.filter((e) => matches(e) && overlaps(e, r.first, r.last)).length;
    b.setAttribute("aria-current", String(+b.dataset.i === state.month));
  });
}

function goMonth(i, scroll) {
  state.month = Math.max(0, Math.min(CONFIG.monthCount - 1, i));
  if (state.view === "list" && scroll) {
    const t = document.getElementById(`m-${state.month}`);
    if (t) t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    updateMonthCounts();
    return;
  }
  render();
}

// ---------- calendar ----------
function renderCalendar() {
  const r = monthRange(state.month);
  const evs = EVENTS.filter((e) => matches(e) && overlaps(e, r.first, r.last));
  const ongoing = evs.filter((e) => e.ongoing);
  const dated = evs.filter((e) => !e.ongoing).sort((a, b) => a.start - b.start || b.days - a.days);

  const head = el("div", { class: "cal-head" },
    el("h2", { class: "cal-title" }, `${r.name} `, el("em", {}, String(r.year))),
    el("div", { class: "cal-nav" },
      el("button", { type: "button", onclick: () => goMonth(state.month - 1), disabled: state.month === 0 }, "← Prev"),
      el("button", { type: "button", onclick: () => goMonth(state.month + 1), disabled: state.month === CONFIG.monthCount - 1 }, "Next →")));

  const strip = ongoing.length ? el("div", { class: "ongoing" }, el("span", { class: "label" }, "Running this month"),
    ongoing.map((e) => el("button", { type: "button", class: `pill ${e.cls}`, title: `${e.event} · ${fmtRange(e)}`, onclick: () => openEvent(e) }, e.event))) : null;

  const grid = el("div", { class: "grid" }, el("div", { class: "dow", "aria-hidden": "true" }, DOW.map((d) => el("span", {}, d))));
  const todayKey = key(new Date());
  let ws = addDays(r.first, -r.first.getDay());
  while (ws <= r.last) {
    const we = addDays(ws, 6);
    const a = ws < r.first ? r.first : ws, b = we > r.last ? r.last : we;
    const lanes = [];
    const segs = [];
    for (const e of dated) {
      if (!overlaps(e, a, b)) continue;
      const s = e.start < a ? a : e.start, t = e.end > b ? b : e.end;
      const c1 = Math.round((s - ws) / DAY), c2 = Math.round((t - ws) / DAY);
      let lane = lanes.findIndex((end) => end < c1);
      if (lane === -1) { lane = lanes.length; lanes.push(c2); } else lanes[lane] = c2;
      segs.push({ e, c1, c2, lane, cutL: e.start < s, cutR: e.end > t });
    }
    const week = el("div", { class: "week", style: `grid-template-rows: 26px repeat(${lanes.length}, auto) minmax(10px, 1fr)` });
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const out = d < r.first || d > r.last;
      const k = key(d);
      week.append(el("div", { class: `day${out ? " out" : ""}${!out && peakSet.has(k) ? " peak" : ""}${k === todayKey ? " today" : ""}`, style: `grid-column:${i + 1}` },
        el("span", { class: "num", title: !out && peakSet.has(k) ? "Peak hotel-demand date" : null }, String(d.getDate()))));
    }
    for (const g of segs) {
      week.append(el("button", {
        type: "button",
        class: `bar ${g.e.cls}${g.cutL ? " cut-l" : ""}${g.cutR ? " cut-r" : ""}${g.e.flyers.length ? " has-flyer" : ""}`,
        style: `grid-column:${g.c1 + 1} / ${g.c2 + 2}; grid-row:${g.lane + 2}`,
        title: `${g.e.event} · ${fmtRange(g.e)} · ${g.e.city}`,
        onclick: () => openEvent(g.e),
      }, g.e.event));
    }
    grid.append(week);
    ws = addDays(ws, 7);
  }
  $("calendar").replaceChildren(head, strip || "", grid);
  return evs.length;
}

// ---------- list ----------
function card(e) {
  const r0 = monthRange(0).first;
  const s = e.start < r0 ? r0 : e.start;
  const thumb = e.flyers.find(isImage);
  return el("button", { type: "button", class: `card ${e.cls}`, onclick: () => openEvent(e) },
    el("div", { class: "when" },
      el("div", { class: "d" }, e.tbc ? "TBC" : e.start < r0 ? "Now" : String(s.getDate())),
      el("div", { class: "m" }, e.days > 1 && !e.tbc ? `to ${e.end.getDate()} ${MON[e.end.getMonth()]}` : MON[s.getMonth()])),
    el("div", {},
      el("h3", {}, e.event),
      el("p", { class: "sub" }, `${fmtRange(e)} · ${where(e)}`),
      el("p", { class: "about" }, e.about),
      el("div", { class: "tags" },
        el("span", { class: "tag" }, CONFIG.types[e.type].label),
        e.part_of && byId[e.part_of] ? el("span", { class: "tag parent" }, `Part of ${byId[e.part_of].event}`) : null,
        e.status ? el("span", { class: `tag status${warnStatus(e.status) ? " warn" : ""}` }, e.status) : null,
        isPeakEvent(e) && !e.ongoing ? el("span", { class: "tag peak" }, "★ Peak hotel dates") : null)),
    el("div", { class: "side" },
      thumb ? el("img", { class: "thumb", src: thumb, alt: `Flyer: ${e.event}`, loading: "lazy" })
            : el("span", { class: "thumb none" }, "Flyer coming soon")));
}

function renderList() {
  const r0 = monthRange(0).first;
  const groups = Array.from({ length: CONFIG.monthCount }, () => []);
  let n = 0;
  for (const e of EVENTS) {
    if (!matches(e)) continue;
    const s = e.start < r0 ? r0 : e.start;
    const i = (s.getFullYear() - r0.getFullYear()) * 12 + s.getMonth() - r0.getMonth();
    if (i >= 0 && i < CONFIG.monthCount) { groups[i].push(e); n++; }
  }
  $("list").replaceChildren(...groups.map((g, i) => {
    if (!g.length) return "";
    const r = monthRange(i);
    g.sort((a, b) => a.start - b.start || a.event.localeCompare(b.event));
    return el("section", { class: "month-block", id: `m-${i}` },
      el("h2", {}, `${r.name} `, el("em", {}, String(r.year))),
      el("div", { class: "cards" }, g.map(card)));
  }));
  return n;
}

// ---------- detail ----------
function openEvent(e) {
  current = e;
  const d = $("detail");
  d.querySelector(".detail").className = `detail ${e.cls}`;
  $("d-type").replaceChildren(el("span", { class: "sw" }), CONFIG.types[e.type].label);
  $("d-title").textContent = e.event;
  $("d-dates").textContent = fmtRange(e) + (isPeakEvent(e) && !e.ongoing ? " · ★ peak hotel dates" : "");
  $("d-where").textContent = where(e);
  $("d-status").textContent = e.status || "Listed";
  $("d-about").textContent = e.about;

  const parent = e.part_of && byId[e.part_of];
  $("d-parent").hidden = !parent;
  if (parent) $("d-parent").replaceChildren("Part of ", el("button", { type: "button", onclick: () => openEvent(parent) }, parent.event));

  $("d-details").hidden = !e.details;
  $("d-details-text").textContent = e.details || "";

  // Children of this event, or the other events that share its parent
  const kids = EVENTS.filter((x) => x.part_of === e.id);
  const sibs = parent ? EVENTS.filter((x) => x.part_of === parent.id && x !== e) : [];
  const related = kids.length ? kids : sibs;
  $("d-related").hidden = !related.length;
  $("d-related-title").textContent = kids.length ? "Events within this" : `Also part of ${parent ? parent.event : ""}`;
  $("d-related-list").replaceChildren(...related.sort((a, b) => a.start - b.start).map((x) =>
    el("li", { class: x.cls }, el("span", { class: "sw" }),
      el("button", { type: "button", onclick: () => openEvent(x) }, x.event),
      el("span", { class: "when" }, fmtRange(x)))));

  const link = $("d-link");
  link.hidden = !e.link;
  if (e.link) {
    link.href = e.link;
    let host = "";
    try { host = new URL(e.link).hostname.replace(/^www\./, ""); } catch (_) {}
    link.textContent = `${CONFIG.linkLabels[e.link_kind] || "Website"} ↗`;
    link.title = host;
  }
  $("d-copy").textContent = "Copy link to this event";
  const box = $("d-flyers");
  box.replaceChildren(e.flyers.length
    ? el("div", { class: "flyer-grid" }, e.flyers.map((f, i) => isImage(f)
        ? el("a", { href: f, target: "_blank", rel: "noopener" }, el("img", { src: f, alt: `${e.event} flyer ${i + 1}`, loading: "lazy" }))
        : el("a", { class: "doc", href: f, target: "_blank", rel: "noopener" }, `Open flyer ${i + 1} ↗`)))
    : el("p", { class: "no-flyer" }, "Flyers for this event are coming soon."));
  if (location.hash !== `#${e.id}`) history.replaceState(null, "", `#${e.id}`);
  if (!d.open) d.showModal();
}

function closeEvent() {
  current = null;
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

async function copyLink() {
  if (!current) return;
  const url = `${location.origin}${location.pathname}#${current.id}`;
  const btn = $("d-copy");
  try { await navigator.clipboard.writeText(url); btn.textContent = "Link copied"; }
  catch (_) { window.prompt && window.prompt("Copy this link", url); }
}

// ---------- main ----------
function render() {
  const n = state.view === "calendar" ? renderCalendar() : renderList();
  $("calendar").hidden = state.view !== "calendar";
  $("list").hidden = state.view !== "list";
  $("empty").hidden = n > 0;
  document.querySelectorAll(".view-toggle button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === state.view)));
  updateMonthCounts();
  try { localStorage.setItem("uae-events-view", state.view); } catch (_) {}
}

function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const e = id && EVENTS.find((x) => x.id === id);
  if (e) {
    const r0 = monthRange(0).first;
    const s = e.start < r0 ? r0 : e.start;
    state.month = Math.max(0, Math.min(CONFIG.monthCount - 1, (s.getFullYear() - r0.getFullYear()) * 12 + s.getMonth() - r0.getMonth()));
    render();
    openEvent(e);
  }
}

async function init() {
  let saved = null;
  try { saved = localStorage.getItem("uae-events-view"); } catch (_) {}
  state.view = saved || (matchMedia("(max-width: 760px)").matches ? "list" : "calendar");

  // Open on the current month when it falls inside the calendar window.
  const now = new Date(), r0 = monthRange(0).first;
  const cur = (now.getFullYear() - r0.getFullYear()) * 12 + now.getMonth() - r0.getMonth();
  if (cur > 0 && cur < CONFIG.monthCount) state.month = cur;

  try {
    const res = await fetch(CONFIG.csv, { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    EVENTS = parseCSV(await res.text()).map(prepare).filter(Boolean);
    byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
  } catch (err) {
    $("summary").textContent = "The event list could not be loaded. Refresh the page to try again.";
    return;
  }

  const byType = {};
  EVENTS.forEach((e) => (byType[e.type] = (byType[e.type] || 0) + 1));
  $("summary").textContent = `${EVENTS.length} events · ${byType.Conference || 0} conferences · ${byType.Festival || 0} festivals · ${byType.Sports || 0} sports · ${(byType["Art & Culture"] || 0)} art & culture · ${byType.Concert || 0} concerts · Updated 28 Oct 2026`;

  buildFilters();
  buildMonths();
  document.querySelectorAll(".view-toggle button").forEach((b) => b.addEventListener("click", () => { state.view = b.dataset.view; render(); if (state.view === "list") goMonth(state.month, true); }));
  $("city").addEventListener("change", (ev) => { state.city = ev.target.value; render(); });
  let t;
  $("search").addEventListener("input", (ev) => { clearTimeout(t); t = setTimeout(() => { state.q = ev.target.value.trim(); render(); }, 150); });
  $("reset").addEventListener("click", () => {
    state.types = new Set(Object.keys(CONFIG.types)); state.city = ""; state.q = "";
    $("city").value = ""; $("search").value = "";
    document.querySelectorAll("#type-filters .chip").forEach((c) => c.setAttribute("aria-pressed", "true"));
    render();
  });
  $("d-close").addEventListener("click", () => $("detail").close());
  $("d-copy").addEventListener("click", copyLink);
  $("detail").addEventListener("close", closeEvent);
  $("detail").addEventListener("click", (ev) => { if (ev.target === $("detail")) $("detail").close(); });
  window.addEventListener("hashchange", openFromHash);

  render();
  openFromHash();
}

init();
