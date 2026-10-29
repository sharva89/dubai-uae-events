/* Partners page: searchable list of agent partners, and a form that prepares a new or edited partner's
   two files (<id>.json and <id>-logo.png) for upload to the repo's partners/ folder. */
const $ = (id) => document.getElementById(id);
const FIELDS = ["name", "tagline", "contact_name", "city", "phone", "email", "website"];
const LOGO_MAX = { w: 600, h: 300 };

const state = { partners: [], editing: null, logo: null, files: null };

const webHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);
const webText = (w) => w.replace(/^https?:\/\//i, "").replace(/\/$/, "");

function card(p) {
  const logo = el("img", { alt: `${p.name} logo`, loading: "lazy" });
  logo.onerror = () => { if (!logo.dataset.raw) { logo.dataset.raw = 1; logo.src = RAW + logoURL(p); } };
  logo.src = logoURL(p);
  const contacts = [
    p.contact_name && el("li", {}, p.contact_name),
    p.phone && el("li", {}, el("a", { href: `tel:${p.phone.replace(/[^\d+]/g, "")}` }, p.phone)),
    p.email && el("li", {}, el("a", { href: `mailto:${p.email}` }, p.email)),
    p.website && el("li", {}, el("a", { href: webHref(p.website), target: "_blank", rel: "noopener" }, webText(p.website))),
  ];
  return el("article", { class: "partner-card", id: `p-${p.id}` },
    el("div", { class: "pc-logo" }, logo),
    el("div", { class: "pc-body" },
      el("h2", {}, p.name),
      p.tagline && el("p", { class: "pc-tagline" }, p.tagline),
      p.city && el("p", { class: "pc-city" }, p.city),
      contacts.some(Boolean) && el("ul", { class: "pc-contacts" }, contacts)),
    el("div", { class: "pc-actions" },
      el("a", { class: "btn primary", href: `studio.html?partner=${encodeURIComponent(p.id)}` }, "Make co-branded version"),
      el("button", { type: "button", class: "btn", onclick: () => openEditor(p) }, "Edit")));
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const shown = state.partners.filter((p) => !q || [p.name, p.tagline, p.city, p.contact_name].join(" ").toLowerCase().includes(q));
  $("grid").replaceChildren(...shown.map(card));
  const n = state.partners.length;
  $("count").textContent = n ? `${q ? `${shown.length} of ` : ""}${n} partner${n === 1 ? "" : "s"}` : "";
  $("empty").hidden = n > 0;
  $("nomatch").hidden = !(n && !shown.length);
  $("nomatch-q").textContent = q;
}

// ---- Logo: trim empty margins (trimBox in cobrand.js) and fit within 600×300 ----
async function processLogo(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    // SVGs can report 0×0; give them a working size
    let w = img.naturalWidth || 1200, h = img.naturalHeight || 600;
    const up = Math.min(4, 1600 / Math.max(w, h));
    if (/svg/.test(file.type) || up > 1) { w = Math.round(w * Math.max(up, 1)); h = Math.round(h * Math.max(up, 1)); }
    const src = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const sctx = src.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, w, h);
    const b = trimBox(sctx, w, h);
    const pad = Math.round(Math.max(b.w, b.h) * 0.02);
    const k = Math.min(1, LOGO_MAX.w / (b.w + 2 * pad), LOGO_MAX.h / (b.h + 2 * pad));
    const out = $("logo-preview");
    out.width = Math.round((b.w + 2 * pad) * k);
    out.height = Math.round((b.h + 2 * pad) * k);
    const octx = out.getContext("2d");
    octx.imageSmoothingQuality = "high";
    octx.drawImage(src, b.x, b.y, b.w, b.h, pad * k, pad * k, b.w * k, b.h * k);
    return new Promise((r) => out.toBlob(r, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function showLogo(blobOrURL) {
  const url = typeof blobOrURL === "string" ? blobOrURL : URL.createObjectURL(blobOrURL);
  $("sample-light").src = $("sample-dark").src = url;
  $("chip-check").hidden = false;
  $("drop").classList.add("has-logo");
  $("drop-hint").hidden = true;
  $("logo-preview").hidden = typeof blobOrURL === "string";
  // Existing logo: show it in the drop area too (absolute URL, since a relative one would resolve against the stylesheet)
  $("drop").style.backgroundImage = typeof blobOrURL === "string" ? `url("${new URL(url, location.href).href}")` : "";
}

function resetLogo() {
  state.logo = null;
  $("logo").value = "";
  $("chip-check").hidden = true;
  $("drop").classList.remove("has-logo");
  $("drop").style.backgroundImage = "";
  $("drop-hint").hidden = false;
  $("logo-preview").hidden = true;
}

// ---- Editor ----
function openEditor(p = null) {
  state.editing = p;
  $("form").reset();
  resetLogo();
  $("form-error").hidden = true;
  $("step-form").hidden = false;
  $("step-upload").hidden = true;
  $("ed-kind").textContent = p ? "Edit partner" : "New partner";
  $("ed-title").textContent = p ? p.name : "Add an agent partner";
  $("save").textContent = p ? "Save changes" : "Save partner files";
  if (p) {
    for (const f of FIELDS) $("form").elements[f].value = p[f] || "";
    showLogo(logoURL(p));
  }
  $("editor").showModal();
}

function readForm() {
  const data = {};
  for (const f of FIELDS) data[f] = $("form").elements[f].value.trim();
  return data;
}

function uniqueId(name) {
  const base = slug(name);
  const taken = new Set(state.partners.map((p) => p.id));
  let id = base, n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  return id;
}

async function save(ev) {
  ev.preventDefault();
  const data = readForm();
  const err = (msg) => { $("form-error").textContent = msg; $("form-error").hidden = false; };
  if (!data.name) return err("Add the partner's name.");
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) return err("That email address doesn't look right.");
  if (!state.logo && !state.editing) return err("Choose the partner's logo.");

  const id = state.editing ? state.editing.id : uniqueId(data.name);
  const logoName = `${id}-logo.png`;
  let logoBlob = state.logo;
  if (!logoBlob) {
    // Editing without a new logo: re-save the current one so both files go up together
    logoBlob = await fetch(logoURL(state.editing)).then((r) => (r.ok ? r.blob() : fetch(RAW + logoURL(state.editing)).then((x) => x.blob())));
  }
  const json = { id, ...data, logo: logoName, added: state.editing?.added || new Date().toISOString().slice(0, 10) };
  const jsonBlob = new Blob([JSON.stringify(json, null, 2) + "\n"], { type: "application/json" });
  state.files = { json: [jsonBlob, `${id}.json`], logo: [logoBlob, logoName], data: json };

  downloadFiles();
  $("f-json").textContent = `${id}.json`;
  $("f-logo").textContent = logoName;
  $("gh-upload").href = GH_UPLOAD;
  $("step-form").hidden = true;
  $("step-upload").hidden = false;
  $("ed-kind").textContent = "Almost done";
  $("ed-title").textContent = `Upload ${data.name} to GitHub`;
}

function downloadFiles() {
  download(...state.files.json);
  // Some browsers drop a second download fired in the same tick
  setTimeout(() => download(...state.files.logo), 400);
}

function detailsText(p) {
  return [
    `Partner: ${p.name}`, p.tagline && `Tagline: ${p.tagline}`, p.contact_name && `Contact: ${p.contact_name}`,
    p.phone && `Phone: ${p.phone}`, p.email && `Email: ${p.email}`, p.website && `Website: ${p.website}`, p.city && `City: ${p.city}`,
  ].filter(Boolean).join("\n");
}

// ---- Wiring ----
$("q").addEventListener("input", render);
$("add").addEventListener("click", () => openEditor());
document.querySelector("[data-add]").addEventListener("click", () => openEditor());
$("ed-close").addEventListener("click", () => $("editor").close());
$("cancel").addEventListener("click", () => $("editor").close());
$("done").addEventListener("click", () => $("editor").close());
$("logo-change").addEventListener("click", () => $("logo").click());
$("redownload").addEventListener("click", downloadFiles);
$("form").addEventListener("submit", save);
$("copy-details").addEventListener("click", async (e) => {
  try {
    await navigator.clipboard.writeText(detailsText(state.files.data));
    e.target.textContent = "Copied";
  } catch {
    e.target.textContent = "Couldn't copy";
  }
  setTimeout(() => (e.target.textContent = "Copy details as text"), 1600);
});
$("logo").addEventListener("change", async () => {
  const f = $("logo").files[0];
  if (!f) return;
  try {
    state.logo = await processLogo(f);
    showLogo(state.logo);
    $("form-error").hidden = true;
  } catch {
    resetLogo();
    $("form-error").textContent = "That file couldn't be read as an image. Try a PNG or JPG.";
    $("form-error").hidden = false;
  }
});
for (const t of ["dragenter", "dragover"]) $("drop").addEventListener(t, (e) => { e.preventDefault(); $("drop").classList.add("over"); });
for (const t of ["dragleave", "drop"]) $("drop").addEventListener(t, () => $("drop").classList.remove("over"));
$("drop").addEventListener("drop", (e) => {
  e.preventDefault();
  if (!e.dataTransfer.files.length) return;
  $("logo").files = e.dataTransfer.files;
  $("logo").dispatchEvent(new Event("change"));
});

loadPartners().then(({ list, apiOk }) => {
  state.partners = list;
  $("api-note").hidden = apiOk;
  render();
  const want = location.hash.slice(1);
  if (want === "add") openEditor();
  else if (want) document.getElementById(`p-${want}`)?.scrollIntoView({ block: "center" });
});
