/* Shared by partners.html and studio.html: where partner files live and how to load them.
   Each partner is partners/<id>.json plus partners/<id>-logo.png in the GitHub repo. The list comes from
   GitHub's contents API (so a new upload shows up without editing any index), merged with partners/index.json,
   which is the fallback when the API is unreachable or rate-limited. */
const REPO = { owner: "sharva89", name: "dubai-uae-events", branch: "main" };
const RAW = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}/`;
const GH_UPLOAD = `https://github.com/${REPO.owner}/${REPO.name}/upload/${REPO.branch}/partners`;
const GH_FOLDER = `https://github.com/${REPO.owner}/${REPO.name}/tree/${REPO.branch}/partners`;

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k);
  return n;
};

const slug = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "partner";

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// Partner json files the API knows about, as {name, sha, raw}; null when the API can't be used
async function listFromAPI() {
  try {
    const cached = JSON.parse(sessionStorage.getItem("partners-api") || "null");
    if (cached && Date.now() - cached.t < 60_000) return cached.files;
  } catch {}
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}/contents/partners?ref=${REPO.branch}`,
      { headers: { Accept: "application/vnd.github+json" } });
    if (r.status === 404) return [];
    if (!r.ok) return null;
    const files = (await r.json())
      .filter((f) => f.type === "file" && f.name.endsWith(".json") && f.name !== "index.json")
      .map((f) => ({ name: f.name, sha: f.sha, raw: f.download_url }));
    try { sessionStorage.setItem("partners-api", JSON.stringify({ t: Date.now(), files })); } catch {}
    return files;
  } catch {
    return null;
  }
}

function normalise(p, file) {
  const id = p.id || file.replace(/\.json$/, "");
  return {
    id, name: p.name || id, tagline: p.tagline || "", contact_name: p.contact_name || "",
    phone: p.phone || "", email: p.email || "", website: p.website || "", city: p.city || "",
    logo: p.logo || `${id}-logo.png`, added: p.added || "",
  };
}

async function loadPartners() {
  const [api, index] = await Promise.all([
    listFromAPI(),
    fetchJSON("partners/index.json").catch(() => []),
  ]);
  const files = new Map((api || []).map((f) => [f.name, f]));
  for (const id of index) if (typeof id === "string" && !files.has(`${id}.json`)) files.set(`${id}.json`, { name: `${id}.json` });

  const partners = await Promise.all([...files.values()].map(async (f) => {
    // The Pages copy can lag a minute behind a fresh commit, so fall back to the raw file
    const local = `partners/${f.name}${f.sha ? `?v=${f.sha.slice(0, 8)}` : ""}`;
    const p = await fetchJSON(local).catch(() => fetchJSON(f.raw || RAW + "partners/" + f.name)).catch(() => null);
    return p && normalise(p, f.name);
  }));
  const list = partners.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  return { list, apiOk: api !== null };
}

const logoURL = (p) => `partners/${p.logo}`;

// Loads an image for canvas use; partner logos fall back to raw.githubusercontent.com (CORS-enabled) while Pages catches up
function loadImage(src, fallback) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (!fallback) return reject(new Error(`Could not load ${src}`));
      const alt = new Image();
      alt.crossOrigin = "anonymous";
      alt.onload = () => resolve(alt);
      alt.onerror = () => reject(new Error(`Could not load ${src}`));
      alt.src = fallback;
    };
    img.src = src;
  });
}

// Bounding box of the non-empty pixels: transparent ones, or ones matching an opaque corner colour, count as empty
function trimBox(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const at = (x, y) => (y * w + x) * 4;
  const c = at(0, 0);
  const bg = [d[c], d[c + 1], d[c + 2], d[c + 3]];
  const empty = (i) => d[i + 3] < 12 || (bg[3] > 240 && Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) < 24);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (empty(at(x, y))) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Partner logo as a canvas trimmed to its visible pixels, so logos uploaded with wide margins still sit centred
async function loadPartnerLogo(p) {
  const img = await loadImage(logoURL(p), RAW + logoURL(p));
  const w = img.naturalWidth, h = img.naturalHeight;
  const src = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const sctx = src.getContext("2d", { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const b = trimBox(sctx, w, h);
  const out = Object.assign(document.createElement("canvas"), { width: b.w, height: b.h });
  out.getContext("2d").drawImage(src, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  return out;
}

function download(blob, filename) {
  const a = el("a", { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
