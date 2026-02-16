// modules/router.js
// Robust router for hash-routes (støtter æøå via encode/decode)

export function createRouter({ navEl, titleEl, subEl, actionsEl, viewEl }) {
  const views = new Map();
  let currentRoute = "";
  let ctx = {};

  function setCtx(nextCtx) {
    ctx = nextCtx || {};
  }

  function normalizeHash(hash) {
    // hash kan være "#spr%C3%B8yting" eller "#sprøyting" eller ""
    const raw = String(hash || "").replace(/^#/, "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch {
      // hvis noen har en "ødelagt" encoding, fall tilbake til raw
      return raw;
    }
  }

  function setHash(route) {
    const r = String(route || "").trim();
    if (!r) return;
    // unngå æøå-trøbbel ved å encode når vi setter
    window.location.hash = encodeURIComponent(r);
  }

  function renderRoute(route) {
    currentRoute = route;

    const def = views.get(route);

    // Title/subtitle
    if (titleEl) titleEl.textContent = def?.title || "Ukjent side";
    if (subEl) {
      const sub = def?.subtitle;
      subEl.textContent = typeof sub === "function" ? (sub(ctx.data) || "") : (sub || "");
    }

    // Actions
    if (actionsEl) {
      actionsEl.innerHTML = "";
      const acts = def?.actions ? def.actions(ctx) : [];
      for (const a of acts || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = a.primary
