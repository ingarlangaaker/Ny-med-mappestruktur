// modules/router.js
// Minimal hash-router for Farmapp
// Viktig: Router bygger IKKE meny. Menyen styres 100% fra app.js (rebuildNav).

export function createRouter({ navEl, titleEl, subEl, actionsEl, viewEl }) {
  const views = new Map();
  let ctx = null;
  let defaultRoute = "dashboard";

  function clear(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function btn({ label, onClick, primary, danger }) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    if (primary) b.classList.add("primary");
    if (danger) b.classList.add("danger");
    b.textContent = label || "Knapp";
    b.addEventListener("click", () => onClick?.(ctx));
    return b;
  }

  function getRouteFromHash() {
    const h = String(window.location.hash || "").replace(/^#/, "").trim();
    return h || defaultRoute;
  }

  function setTitleAndSub(view, data) {
    const t = view?.title ?? "";
    const s = view?.subtitle ?? "";

    titleEl.textContent = typeof t === "function" ? String(t(data) || "") : String(t || "");
    subEl.textContent = typeof s === "function" ? String(s(data) || "") : String(s || "");
  }

  function renderActions(view, data) {
    clear(actionsEl);

    let acts = [];
    if (typeof view?.actions === "function") acts = view.actions(ctx) || [];
    else if (Array.isArray(view?.actions)) acts = view.actions;

    for (const a of acts) {
      actionsEl.appendChild(
        btn({
          label: a.label,
          primary: !!a.primary,
          danger: !!a.danger,
          onClick: (c) => a.onClick?.({ ...(c || {}), data, setData: c?.setData })
        })
      );
    }
  }

  function renderView(route) {
    const view = views.get(route) || views.get(defaultRoute);

    // Hvis route ikke finnes, hopp til default uten å spamme historikk
    if (!views.get(route) && route !== defaultRoute) {
      window.location.replace(`#${defaultRoute}`);
      return;
    }

    const data = ctx?.data;
    setTitleAndSub(view, data);
    renderActions(view, data);

    clear(viewEl);

    // view.render(container, ctx)
    try {
      view?.render?.(viewEl, ctx);
    } catch (e) {
      console.error(e);
      viewEl.innerHTML = `
        <div class="notice">
          <b>Feil i visning:</b> ${escapeHtml(String(e?.message || e))}
        </div>
      `;
    }
  }

  function onHashChange() {
    renderView(getRouteFromHash());
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  return {
    registerView(route, def) {
      views.set(String(route), def || {});
    },
    setCtx(nextCtx) {
      ctx = nextCtx;
    },
    init(route) {
      defaultRoute = String(route || defaultRoute);
      window.removeEventListener("hashchange", onHashChange);
      window.addEventListener("hashchange", onHashChange);

      // sørg for at vi har en gyldig hash
      const r = getRouteFromHash();
      if (!views.get(r)) {
        window.location.replace(`#${defaultRoute}`);
        return;
      }
      renderView(r);
    },
    rerender() {
      renderView(getRouteFromHash());
    }
  };
} 
