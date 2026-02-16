export function createRouter({ navEl, titleEl, subEl, actionsEl, viewEl }) {
  const views = new Map();
  let ctx = null;
  let current = null;

  function setCtx(nextCtx) {
    ctx = nextCtx;
  }

  function registerView(route, def) {
    views.set(route, def);
  }

  function setHeader(def) {
    const t = typeof def.title === "function" ? def.title(ctx?.data) : def.title;
    const s = typeof def.subtitle === "function" ? def.subtitle(ctx?.data) : def.subtitle;

    titleEl.textContent = t || "";
    subEl.textContent = s || "";
  }

  function setActions(def) {
    actionsEl.innerHTML = "";
    const acts = typeof def.actions === "function" ? (def.actions(ctx) || []) : (def.actions || []);
    for (const a of acts) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = a.primary ? "btn primary" : "btn";
      b.textContent = a.label || "Handling";
      b.addEventListener("click", () => a.onClick && a.onClick(ctx));
      actionsEl.appendChild(b);
    }
  }

  function renderRoute(route) {
    const def = views.get(route);
    if (!def) {
      viewEl.innerHTML = `<div class="notice">Ukjent side: <b>${route}</b></div>`;
      titleEl.textContent = "Ukjent side";
      subEl.textContent = "";
      actionsEl.innerHTML = "";
      return;
    }
    current = route;
    setHeader(def);
    setActions(def);
    viewEl.innerHTML = "";
    def.render(viewEl, ctx);
  }

  function parseHash() {
    const raw = (window.location.hash || "").replace("#", "").trim();
    return raw || "dashboard";
  }

  function onHashChange() {
    renderRoute(parseHash());
  }

  function init(defaultRoute = "dashboard") {
    if (!window.location.hash) window.location.hash = defaultRoute;
    window.addEventListener("hashchange", onHashChange);
    onHashChange();
  }

  function rerender() {
    if (!current) return;
    renderRoute(current);
  }

  return { registerView, init, rerender, setCtx };
}
