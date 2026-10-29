/* Co-brand Studio: composites a partner lockup and footer onto clean base art (data/designs.json) on <canvas>.
   Header zone: [partner logo on a chip] × [our logo, tinted per design]. Footer zone: partnership line, contacts and
   tagline, laid out as stacked one-liners, two columns (on a panel) or a single line, shrunk to fit. */
const $ = (id) => document.getElementById(id);
const SERIF = '"Playfair Display", Georgia, serif';
const SANS = "Poppins, system-ui, sans-serif";
const BASE_DPI = 150; // base art is drawn at 150 dpi, so PDFs at 2× are 300 dpi
const CHIP = { light: "#FFFFFF", dark: "#0B1A2B" };

const state = { cfg: null, partners: [], design: null, pages: [], partner: null, logo: null, lastName: "" };
const cache = new Map();
const image = (src) => {
  if (!cache.has(src)) cache.set(src, loadImage(src).catch((e) => { cache.delete(src); throw e; }));
  return cache.get(src);
};
const webText = (w) => w.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function options() {
  return {
    plogo: $("o-plogo").checked,
    chip: document.querySelector('input[name="chip"]:checked').value,
    ologo: $("o-ologo").checked,
    line: $("o-line").checked && state.partner ? $("o-line-text").value.trim() : "",
    pcontacts: $("o-pcontacts").checked,
    ocontacts: $("o-ocontacts").checked,
    tagline: $("o-tagline").checked,
  };
}

// A page inherits the design's zones, palette and logo unless it sets its own
function resolve(d, page) {
  const palette = page.palette || d.palette;
  const footer = page.footer || d.footer;
  return {
    base: page.base, label: page.label, logo: page.logo || d.logo,
    header: page.header || d.header,
    footer, palette, footPalette: footer.palette || palette,
  };
}

// ---------- Drawing ----------
function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawLockup(ctx, z, pal, ours, partnerLogo, o) {
  const H = z.h, items = [];
  if (partnerLogo && o.plogo) {
    const chip = o.chip !== "none";
    const ch = H * 0.8, pad = chip ? ch * 0.16 : 0;
    const maxH = chip ? ch - 2 * pad : H * 0.78;
    const maxW = z.w * 0.44 - 2.6 * pad;
    const k = Math.min(maxH / partnerLogo.height, maxW / partnerLogo.width);
    const lw = partnerLogo.width * k, lh = partnerLogo.height * k;
    items.push({ kind: "partner", chip, w: chip ? Math.max(lw + 2.6 * pad, ch) : lw, h: chip ? ch : lh, lw, lh });
  }
  if (ours && o.ologo) {
    const h = H * (items.length ? 0.74 : 0.88);
    items.push({ kind: "ours", w: (h * ours.naturalWidth) / ours.naturalHeight, h });
  }
  if (!items.length) return;
  if (items.length === 2) items.splice(1, 0, { kind: "x", w: H * 0.2, h: H * 0.3 });

  const gap = H * 0.13;
  const natural = items.reduce((s, it) => s + it.w, 0) + gap * (items.length - 1);
  const s = Math.min(1, z.w / natural);
  const total = natural * s;
  let x = z.align === "left" ? z.x : z.align === "right" ? z.x + z.w - total : z.x + (z.w - total) / 2;
  const cy = z.y + z.h / 2;

  if (z.plate) {
    const ph = Math.max(...items.map((it) => it.h)) * s + 36;
    roundRect(ctx, x - 20, cy - ph / 2, total + 40, ph, 16, z.plate);
  }
  for (const it of items) {
    const w = it.w * s, h = it.h * s;
    if (it.kind === "partner") {
      if (it.chip) {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.22)";
        ctx.shadowBlur = 18 * s;
        ctx.shadowOffsetY = 4 * s;
        roundRect(ctx, x, cy - h / 2, w, h, h * 0.16, CHIP[o.chip]);
        ctx.restore();
      }
      ctx.drawImage(partnerLogo, x + (w - it.lw * s) / 2, cy - (it.lh * s) / 2, it.lw * s, it.lh * s);
    } else if (it.kind === "x") {
      ctx.font = `400 ${H * 0.32 * s}px ${SERIF}`;
      ctx.fillStyle = pal.accent;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("×", x + w / 2, cy + H * 0.02 * s);
    } else {
      ctx.drawImage(ours, x, cy - h / 2, w, h);
    }
    x += w + gap * s;
  }
}

const fontOf = (g, k = 1) => `${g.italic ? "italic " : ""}${g.weight || 400} ${g.size * k}px ${g.serif ? SERIF : SANS}`;

function setFont(ctx, g, k) {
  ctx.font = fontOf(g, k);
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(g.ls || 0) * k}px`;
}

function segWidth(ctx, segs, k) {
  let w = 0;
  for (const g of segs) { setFont(ctx, g, k); w += ctx.measureText(g.text).width; }
  return w;
}

// Builds the footer's rows from the toggles; each row is {segs:[…]} or {cols:[{name, tagline, lines}]}
function footerRows(z, pal, o, us, partner) {
  const rows = [];
  const title = o.line || (z.layout === "columns" ? z.title : "");
  if (title) rows.push({ segs: [{ text: title, serif: true, italic: !!o.line, weight: 600, size: z.layout === "columns" ? 30 : 28, color: pal.accent }] });

  const parties = [];
  if (partner && o.pcontacts) {
    const lines = [partner.contact_name, partner.phone, partner.email, partner.website && webText(partner.website)].filter(Boolean);
    if (lines.length || z.layout === "columns") parties.push({ name: partner.name, tagline: partner.tagline, lines });
  }
  if (o.ocontacts) parties.push({ name: us.name, lines: [us.email, us.phones.join("  ·  "), us.website] });

  if (z.layout === "columns") {
    if (parties.length) rows.push({ cols: parties });
  } else {
    for (const p of parties) {
      rows.push({ group: "contacts", segs: [
        { text: p.name, weight: 600, size: 20, color: pal.accent },
        { text: "     " + p.lines.join("   ·   "), weight: 400, size: 20, color: pal.text },
      ] });
    }
  }
  if (o.tagline) rows.push({ segs: [{ text: us.tagline.toUpperCase(), weight: 500, size: 14, ls: 3, color: pal.soft }] });
  return z.layout === "line" ? rows.slice(0, 1).map((r) => ({ segs: r.segs.map((g) => ({ ...g, size: Math.min(g.size, 17) })) })) : rows;
}

const colLines = (c) => [
  { text: c.name, weight: 600, size: 22 },
  c.tagline && { text: c.tagline, serif: true, italic: true, weight: 600, size: 17 },
  ...c.lines.map((t) => ({ text: t, weight: 400, size: 18 })),
].filter(Boolean);

function drawFooter(ctx, z, pal, o, us, partner) {
  const rows = footerRows(z, pal, o, us, partner);
  if (!rows.length) return;
  if (z.panel) roundRect(ctx, z.x, z.y, z.w, z.h, z.panel.radius || 0, z.panel.fill);
  const padX = z.panel ? 32 : 0, padY = z.panel ? 22 : 0;
  const inner = { x: z.x + padX, y: z.y + padY, w: z.w - 2 * padX, h: z.h - 2 * padY };
  const LH = 1.45, GAP = 10, GUTTER = 56;

  const rowH = (r, k) => r.cols
    ? Math.max(...r.cols.map((c) => colLines(c).reduce((s, g) => s + g.size * k * LH, 0)))
    : Math.max(...r.segs.map((g) => g.size)) * k * LH;
  const heightAt = (k) => rows.reduce((s, r) => s + rowH(r, k), 0) + GAP * k * (rows.length - 1);
  const k = Math.min(1, inner.h / heightAt(1));

  // Rows that fit by shrinking; contact one-liners share one size so they read as a set
  const fitK = (r) => Math.min(k, (k * inner.w) / segWidth(ctx, r.segs, k));
  const groupK = Math.min(...rows.filter((r) => r.group).map(fitK));

  let y = inner.y + (inner.h - heightAt(k)) / 2;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (const r of rows) {
    const h = rowH(r, k);
    if (r.segs) {
      const kw = r.group ? groupK : fitK(r);
      const w = segWidth(ctx, r.segs, kw);
      let x = z.align === "left" ? inner.x : z.align === "right" ? inner.x + inner.w - w : inner.x + (inner.w - w) / 2;
      for (const g of r.segs) {
        setFont(ctx, g, kw);
        ctx.fillStyle = g.color;
        ctx.fillText(g.text, x, y + h / 2);
        x += ctx.measureText(g.text).width;
      }
    } else {
      const n = r.cols.length, cw = (inner.w - GUTTER * (n - 1)) / n;
      r.cols.forEach((c, i) => {
        const cx = inner.x + i * (cw + GUTTER);
        if (i) {
          ctx.fillStyle = pal.soft;
          ctx.globalAlpha = 0.45;
          ctx.fillRect(cx - GUTTER / 2, y + 4 * k, 1.5, h - 8 * k);
          ctx.globalAlpha = 1;
        }
        let ly = y;
        for (const [j, g] of colLines(c).entries()) {
          const gk = Math.min(k, (k * cw) / segWidth(ctx, [g], k));
          setFont(ctx, g, gk);
          ctx.fillStyle = j === 0 || g.italic ? pal.accent : pal.text;
          const lh = g.size * k * LH;
          ctx.fillText(g.text, z.align === "center" ? cx + (cw - ctx.measureText(g.text).width) / 2 : cx, ly + lh / 2);
          ly += lh;
        }
      });
    }
    y += h + GAP * k;
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
}

async function renderPage(canvas, d, page, scale = 1) {
  const p = resolve(d, page);
  const [base, ours] = await Promise.all([image(p.base), image(`cobrand/logos/${p.logo}.png`)]);
  canvas.width = d.width * scale;
  canvas.height = d.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(base, 0, 0, d.width, d.height);
  const o = options();
  drawLockup(ctx, p.header, p.palette, ours, state.partner ? state.logo : null, o);
  drawFooter(ctx, p.footer, p.footPalette, o, state.cfg.us, state.partner);
  return canvas;
}

// ---------- UI ----------
function selectedPages() {
  const d = state.design;
  return d.pages.map((pg, i) => ({ pg, i })).filter(({ i }) => state.pages.includes(i));
}

let queued = false;
function refresh() {
  syncURL();
  if (queued) return;
  queued = true;
  // Coalesce bursts of changes into one redraw (a timer, unlike rAF, also runs in a background tab)
  setTimeout(async () => {
    queued = false;
    const d = state.design;
    const figs = selectedPages().map(({ pg, i }) => {
      const canvas = el("canvas", { role: "img", "aria-label": `${d.title}, ${pg.label}, co-branded preview` });
      const fig = el("figure", {}, canvas,
        el("figcaption", {}, d.pages.length > 1 ? `Page ${i + 1} · ${pg.label}` : pg.label,
          el("button", { type: "button", class: "btn", onclick: () => exportImages("png", [i]) }, "PNG")));
      return { fig, canvas, pg };
    });
    $("preview").replaceChildren(...figs.map((f) => f.fig));
    try {
      await Promise.all(figs.map((f) => renderPage(f.canvas, d, f.pg)));
    } catch (e) {
      status(e.message);
    }
  });
}

function status(msg) { $("status").textContent = msg || ""; }

function syncURL() {
  const q = new URLSearchParams();
  q.set("design", state.design.id);
  if (state.partner) q.set("partner", state.partner.id);
  history.replaceState(null, "", `?${q}`);
}

function fileBase(i) {
  const d = state.design;
  const who = state.partner ? state.partner.id : "exptales";
  return `${d.id}-x-${who}${d.pages.length > 1 ? `-p${i + 1}` : ""}`;
}

function busy(on, msg) {
  for (const b of document.querySelectorAll(".downloads .btn")) b.disabled = on;
  status(msg);
}

async function exportImages(type, only) {
  const idx = only || state.pages;
  busy(true, `Preparing ${idx.length} ${type.toUpperCase()} file${idx.length > 1 ? "s" : ""}…`);
  try {
    for (const i of idx) {
      const c = await renderPage(document.createElement("canvas"), state.design, state.design.pages[i]);
      const blob = await new Promise((r) => c.toBlob(r, type === "png" ? "image/png" : "image/jpeg", 0.92));
      download(blob, `${fileBase(i)}.${type}`);
      await new Promise((r) => setTimeout(r, 350));
    }
    busy(false, "Downloaded.");
  } catch (e) {
    busy(false, `Couldn't export: ${e.message}`);
  }
}

async function exportPDF() {
  if (!window.jspdf) return status("The PDF library is still loading. Try again in a moment.");
  const d = state.design, idx = state.pages;
  busy(true, `Building a ${idx.length}-page PDF at 300 dpi…`);
  try {
    const pt = (px) => (px * 72) / BASE_DPI;
    const fmt = [pt(d.width), pt(d.height)];
    const pdf = new window.jspdf.jsPDF({ unit: "pt", format: fmt, orientation: "portrait", compress: true });
    pdf.setProperties({ title: `${d.title} – ${state.partner ? state.partner.name + " × " : ""}Experiential Tales`, creator: "Experiential Tales Co-brand Studio" });
    for (const [n, i] of idx.entries()) {
      const c = await renderPage(document.createElement("canvas"), d, d.pages[i], 2);
      if (n) pdf.addPage(fmt, "portrait");
      pdf.addImage(c.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, fmt[0], fmt[1], undefined, "FAST");
    }
    const name = `${d.id}-x-${state.partner ? state.partner.id : "exptales"}.pdf`;
    download(pdf.output("blob"), name);
    busy(false, "Downloaded.");
  } catch (e) {
    busy(false, `Couldn't build the PDF: ${e.message}`);
  }
}

function buildDesigns(pick) {
  const list = state.cfg.designs.map((d) => el("label", { class: "design-opt" },
    el("input", { type: "radio", name: "design", value: d.id, checked: d.id === pick.id, onchange: () => chooseDesign(d) }),
    el("img", { src: d.pages[0].base, alt: "", loading: "lazy" }),
    el("div", {}, el("b", {}, d.title), el("span", {}, d.subtitle))));
  $("designs").replaceChildren(...list);
}

function chooseDesign(d) {
  state.design = d;
  state.pages = d.pages.map((_, i) => i);
  $("pages").replaceChildren(...(d.pages.length > 1 ? d.pages.map((pg, i) => el("label", { title: pg.label },
    el("input", { type: "checkbox", checked: true, onchange: (e) => {
      state.pages = e.target.checked ? [...state.pages, i].sort() : state.pages.filter((x) => x !== i);
      if (!state.pages.length) { e.target.checked = true; state.pages = [i]; }
      refresh();
    } }), `Page ${i + 1}`)) : []));
  refresh();
}

const defaultLine = (p) => (p ? `${p.name} in partnership with Experiential Tales` : "");

async function choosePartner(id) {
  const p = state.partners.find((x) => x.id === id) || null;
  const input = $("o-line-text");
  // Keep the team's own wording when switching partners; just swap the name in it
  if (!input.value || input.value === defaultLine(state.partner)) input.value = defaultLine(p);
  else if (state.lastName && p) input.value = input.value.split(state.lastName).join(p.name);
  state.partner = p;
  state.lastName = p ? p.name : state.lastName;
  state.logo = null;
  for (const c of ["o-plogo", "o-line", "o-pcontacts"]) $(c).disabled = !p;
  if (p) {
    try { state.logo = await loadPartnerLogo(p); status(""); }
    catch { status(`Couldn't load ${p.name}'s logo.`); }
  }
  refresh();
}

function fillPartners(want) {
  const sel = $("partner");
  const opts = [el("option", { value: "" }, state.partners.length ? "No partner (our branding only)" : "No partners yet")];
  for (const p of state.partners) opts.push(el("option", { value: p.id, selected: p.id === want }, p.city ? `${p.name} · ${p.city}` : p.name));
  sel.replaceChildren(...opts);
  $("partner-hint").replaceChildren(
    state.partners.length ? "" : "Add your first partner to co-brand. ",
    el("a", { href: "partners.html#add" }, state.partners.length ? "Add a new partner" : "Add a partner"));
}

async function init() {
  const q = new URLSearchParams(location.search);
  try {
    state.cfg = await fetchJSON("data/designs.json");
  } catch {
    $("preview").replaceChildren(el("p", { class: "empty" }, "Couldn't load the design list (data/designs.json)."));
    return;
  }
  const designs = state.cfg.designs;
  const pick = designs.find((d) => d.id === q.get("design")) || designs.find((d) => d.event === q.get("event")) || designs[0];
  buildDesigns(pick);
  await Promise.all(["600 28px", "italic 600 28px", "700 28px"].map((f) => document.fonts.load(`${f} "Playfair Display"`))
    .concat(["400 20px", "500 20px", "600 20px"].map((f) => document.fonts.load(`${f} Poppins`)))).catch(() => {});

  for (const id of ["o-plogo", "o-ologo", "o-line", "o-pcontacts", "o-ocontacts", "o-tagline"]) $(id).addEventListener("change", refresh);
  for (const r of document.querySelectorAll('input[name="chip"]')) r.addEventListener("change", refresh);
  $("o-line-text").addEventListener("input", refresh);
  $("partner").addEventListener("change", (e) => choosePartner(e.target.value));
  $("dl-png").addEventListener("click", () => exportImages("png"));
  $("dl-jpg").addEventListener("click", () => exportImages("jpg"));
  $("dl-pdf").addEventListener("click", exportPDF);

  state.design = pick;
  const { list } = await loadPartners();
  state.partners = list;
  fillPartners(q.get("partner"));
  chooseDesign(pick);
  await choosePartner(q.get("partner") && list.some((p) => p.id === q.get("partner")) ? q.get("partner") : "");
}

init();
