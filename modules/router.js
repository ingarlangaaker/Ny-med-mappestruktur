// modules/router.js
// Enkel router for Farmapp (uten frameworks)
// Gir:
// - registerView()
// - go(viewId)
// - rerender()
// - init(defaultView)
// - enkel hash-støtte (#dashboard osv.)

export function createRouter({ navEl, titleEl, subEl, actionsEl, viewEl }) {
  if (!navEl || !titleEl || !subEl || !actionsEl || !viewEl) {
    throw new Error("Router: mangler nødvendige DOM-elementer");
  }

  const views = {};
  let currentViewId = null;
  let ctx = null;

  function setCtx(nextCtx) {
    ctx = nextCtx;
  }

  function registerView(id, config) {
    views[id] = config;
  }

  function setCurrentNav(id) {
    [...navEl.querySelectorAll("button")].forEach((btn) => {
      btn.removeAttribute("aria-current");
      if (btn.dataset.view === id) btn.setAttribute("aria-current", "page");
    });
  }

  function renderNav() {
    navEl.innerHTML = "";
    Object.keys(views).forEach((key) => {
      const v = views[key];
      const btn = document.createElement("button");
      btn.dataset.view = key;
      btn.textContent = v.title || key;
      btn.onclick = () => go(key);
      navEl.appendChild(btn);
    });
  }

  async function renderView(id) {
    const v = views[id];
    if (!v) return;

    currentViewId = id;
    setCurrentNav(id);

    titleEl.textContent = v.title || "";

    const subtitle =
      typeof v.subtitle === "function" ? (v.subtitle(ctx?.data) || "") : (v.subtitle || "");
    subEl.textContent = subtitle;

    actionsEl.innerHTML = "";
    viewEl.innerHTML = "";

    // actions
    const acts = typeof v.actions === "function" ? (v.actions(ctx?.data) || []) : (v.actions || []);
    for (const a of acts) {
      const btn = document.createElement("button");
      btn.className = "btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : "");
      btn.textContent = a.label || "Knapp";
      btn.onclick = async () => {
        try {
          await a.onClick?.(ctx);
        } catch (e) {
          console.error(e);
          ctx?.toast?.("Noe gikk galt. Se console for detaljer.");
        }
      };
      actionsEl.appendChild(btn);
    }

    // render
    try {
      await v.render?.(viewEl, ctx);
    } catch (e) {
      console.error(e);
      viewEl.innerHTML = `
        <div class="notice">
          <b>Feil i visning:</b> ${escapeHtml(e?.message || "Ukjent feil")}
        </div>
      `;
    }
  }

  function rerender() {
    if (!currentViewId) return;
    renderView(currentViewId);
  }

  function go(id, { updateHash = true } = {}) {
    if (!views[id]) return;
    if (updateHash) {
      location.hash = "#" + encodeURIComponent(id);
    }
    renderView(id);
  }

  function parseHash() {
    const h = (location.hash || "").replace(/^#/, "");
    const id = decodeURIComponent(h || "");
    return id || null;
  }

  function init(defaultViewId) {
    renderNav();

    const fromHash = parseHash();
    const start = (fromHash && views[fromHash]) ? fromHash : defaultViewId;

    // hash change
    window.addEventListener("hashchange", () => {
      const id = parseHash();
      if (id && views[id]) renderView(id);
    });

    go(start, { updateHash: true });
  }

  return { setCtx, registerView, init, go, rerender, views };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}
