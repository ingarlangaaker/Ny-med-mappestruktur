// modules/router.js
// Robust router for hash-routes (tåler æøå og URL-encoding)

export function createRouter({ navEl, titleEl, subEl, actionsEl, viewEl }) {
  const views = new Map();
  let currentRoute = "";
  let ctx = {};

  function setCtx(nextCtx) {
    ctx = nextCtx || {};
  }

  function normalizeHash(hash) {
    const raw = String(hash || "").replace(/^#/, "").trim();
    if (!raw) return "";
    try { return decodeURIComponent(raw); } catch { return raw; }
  }

  function safeDecode(s) {
    try { return decodeURIComponent(String(s || "")); } catch { return String(s || ""); }
  }

  function setHash(route) {
    const r = String(route || "").trim();
    if (!r) return;
    window.location.hash = encodeURIComponent(r);
  }

  function renderRoute(routeRaw) {
    // routeRaw kan være "sprøyting" eller "spr%C3%B8yting"
    const decoded = safeDecode(routeRaw).trim();
    const raw = String(routeRaw || "").trim();

    // prøv decoded først, ellers raw
    const def = views.get(decoded) || views.get(raw);

    currentRoute = def ? (views.get(decoded) ? decoded : raw) : decoded || raw;

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
        btn.className = a.primary ? "btn primary" : "btn";
        btn.textContent = a.label || "Knapp";
        btn.addEventListener("click", () => {
          try { a.onClick?.(ctx); }
          catch (e) { console.error(e); ctx.toast?.("Noe gikk galt."); }
        });
        actionsEl.appendChild(btn);
      }
    }

    // View
    if (viewEl) {
      viewEl.innerHTML = "";
      if (!def) {
        viewEl.innerHTML = `
          <div class="notice">
            <b>Ukjent side:</b> ${escapeHtml(raw || decoded)}
            <div class="muted" style="margin-top:6px; font-size:12px;">
              Tips: prøv å åpne siden fra menyen igjen.
            </div>
          </div>
        `;
        return;
      }

      try {
        def.render(viewEl, { ...ctx });
      } catch (e) {
        console.error(e);
        viewEl.innerHTML = `
          <div class="notice">
            <b>Feil i view:</b> ${escapeHtml(def.title || decoded || raw)}
            <div class="muted" style="margin-top:6px; font-size:12px;">Sjekk konsollen for detaljer.</div>
          </div>
        `;
      }
    }
  }

  function onHashChange() {
    // her får vi alltid decoded route fra hash
    const decodedRoute = normalizeHash(window.location.hash) || "dashboard";

    // MEN: hvis browser/server har lagt inn encoded i hash, vil normalizeHash decode det.
    // renderRoute tåler uansett begge varianter.
    renderRoute(decodedRoute);
  }

  function registerView(route, def) {
    const r = String(route || "").trim();
    if (!r) return;
    views.set(r, def);

    // ekstra robust: registrer også encoded-varianten (spr%C3%B8yting)
    try {
      const enc = encodeURIComponent(r);
      if (enc && enc !== r) views.set(enc, def);
    } catch {}
  }

  function init(defaultRoute = "dashboard") {
    const route = normalizeHash(window.location.hash);
    if (!route) setHash(defaultRoute);

    window.addEventListener("hashchange", onHashChange);
    onHashChange();
  }

  function rerender() {
    const route = normalizeHash(window.location.hash) || "dashboard";
    renderRoute(route);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return { registerView, init, setCtx, rerender, setHash };
}
