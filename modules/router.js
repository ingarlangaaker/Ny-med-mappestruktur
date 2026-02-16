// modules/router.js
// Robust router for hash-routes
// - Støtter æøå via decodeURIComponent
// - Støtter dynamiske ruter via "route:param" (f.eks. sauIndivid:sheep_123)
// - Støtter også "route?x=1" i samme streng

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
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  function parseRoute(routeStr) {
    // routeStr kan være:
    // "sprøyting"
    // "sauIndivid:sheep_abc123"
    // "sauIndivid:sheep_abc123?tab=events"
    // "sprøyting?from=2026-01-01"
    const raw = String(routeStr || "").trim();
    if (!raw) return { name: "", param: "", query: {}, raw: "" };

    const [left, qs] = raw.split("?");
    const query = {};
    if (qs) {
      try {
        const sp = new URLSearchParams(qs);
        for (const [k, v] of sp.entries()) query[k] = v;
      } catch {
        // ignore
      }
    }

    // param via "route:param"
    const colonIdx = left.indexOf(":");
    if (colonIdx >= 0) {
      const name = left.slice(0, colonIdx).trim();
      const param = left.slice(colonIdx + 1).trim();
      return { name, param, query, raw };
    }

    return { name: left.trim(), param: "", query, raw };
  }

  function setHash(route) {
    const r = String(route || "").trim();
    if (!r) return;
    window.location.hash = encodeURIComponent(r);
  }

  function renderUnknown(routeInfo) {
    currentRoute = routeInfo.raw || "";
    if (titleEl) titleEl.textContent = "Ukjent side";
    if (subEl) subEl.textContent = routeInfo.raw || "";
    if (actionsEl) actionsEl.innerHTML = "";
    if (viewEl) {
      viewEl.innerHTML = `
        <div class="notice">
          <b>Ukjent side:</b> ${escapeHtml(routeInfo.raw || "")}<br/>
          <span class="muted" style="font-size:12px;">
            Tips: prøv å åpne siden fra menyen igjen.
          </span>
        </div>
      `;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderRoute(routeStr) {
    const info = parseRoute(routeStr);
    currentRoute = info.raw;

    // 1) Finn view: eksakt match først
    let def = views.get(info.name);

    // 2) Hvis ikke funnet: prøv hele strengen som nøkkel (bakoverkomp)
    if (!def) def = views.get(info.raw);

    if (!def) {
      renderUnknown(info);
      return;
    }

    // gi param/query til ctx uten å ødelegge resten
    const ctxWithRoute = { ...ctx, route: { ...info }, routeParam: info.param, routeQuery: info.query };

    // Title/subtitle
    if (titleEl) titleEl.textContent = def?.title || "Ukjent side";
    if (subEl) {
      const sub = def?.subtitle;
      subEl.textContent = typeof sub === "function" ? (sub(ctxWithRoute.data) || "") : (sub || "");
    }

    // Actions
    if (actionsEl) {
      actionsEl.innerHTML = "";
      const acts = def?.actions ? def.actions(ctxWithRoute) : [];
      for (const a of acts || []) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = a.primary ? "btn primary" : "btn";
        btn.textContent = a.label || "OK";
        btn.addEventListener("click", () => {
          try {
            a.onClick?.(ctxWithRoute);
          } catch (e) {
            console.error(e);
          }
        });
        actionsEl.appendChild(btn);
      }
    }

    // View
    if (viewEl) {
      try {
        viewEl.innerHTML = "";
        def.render(viewEl, ctxWithRoute);
      } catch (e) {
        console.error(e);
        viewEl.innerHTML = `
          <div class="notice">
            <b>Feil i siden:</b> ${escapeHtml(info.name)}<br/>
            <div class="muted" style="font-size:12px; margin-top:6px;">
              Se console (F12) for detaljer.
            </div>
          </div>
        `;
      }
    }
  }

  function onHashChange() {
    const route = normalizeHash(window.location.hash);
    if (!route) return;
    renderRoute(route);
  }

  function registerView(route, def) {
    views.set(String(route || "").trim(), def);
  }

  function init(defaultRoute) {
    window.addEventListener("hashchange", onHashChange);
    const initial = normalizeHash(window.location.hash);
    if (initial) renderRoute(initial);
    else setHash(defaultRoute || "dashboard");
  }

  function rerender() {
    const route = normalizeHash(window.location.hash);
    if (!route) return;
    renderRoute(route);
  }

  return {
    registerView,
    init,
    rerender,
    setCtx,
    setHash,
    get currentRoute() {
      return currentRoute;
    }
  };
}
