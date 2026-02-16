// modules/ui.js
// Felles UI-hjelpere (ingen business-logikk)
// Proffe dialoger (mobilvennlig)
// PATCH: Dialoger skal være HELT TETTE (ikke gjennomsiktige)

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, String(v));
  }
  (Array.isArray(children) ? children : [children]).forEach(ch => {
    if (ch == null) return;
    node.appendChild(typeof ch === "string" ? document.createTextNode(ch) : ch);
  });
  return node;
}

// ---------- Modal (dialog) ----------
function ensureModalStyles() {
  if (document.getElementById("ui_modal_styles")) return;
  const style = document.createElement("style");
  style.id = "ui_modal_styles";
  style.textContent = `
    .ui-backdrop{
      position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,.65);           /* mørkere, mer proff */
      display:flex; align-items:center; justify-content:center;
      padding:16px;
    }
    .ui-modal{
      width:min(560px, 100%);
      background:#121a22;                   /* HELT TETT */
      border:1px solid rgba(255,255,255,.12);
      border-radius:18px;
      box-shadow:0 18px 50px rgba(0,0,0,.65);
      overflow:hidden;
      color:inherit;
    }
    .ui-modal-head{
      padding:14px 14px 10px;
      border-bottom:1px solid rgba(255,255,255,.08);
      background:#121a22;                   /* tett */
    }
    .ui-modal-title{ font-weight:900; margin:0; font-size:16px; }
    .ui-modal-sub{ margin-top:4px; color:rgba(232,240,247,.78); font-size:13px; line-height:1.35; }
    .ui-modal-body{
      padding:14px;
      background:#121a22;                   /* tett */
    }
    .ui-field{ display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
    .ui-label{ font-size:13px; color:rgba(232,240,247,.78); }
    .ui-input{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:#0f1720;                   /* tett input */
      color:inherit;
      outline:none;
    }
    .ui-input:focus{
      border-color: rgba(24,196,108,.60);
      box-shadow: 0 0 0 4px rgba(24,196,108,.14);
    }
    .ui-actions{
      padding:12px 14px;
      border-top:1px solid rgba(255,255,255,.08);
      background:#121a22;                   /* tett */
      display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;
    }
    .ui-btn{
      border:1px solid rgba(255,255,255,.16);
      background:#18222b;                   /* tett knapp */
      color:inherit;
      padding:10px 12px;
      border-radius:14px;
      cursor:pointer;
    }
    .ui-btn:hover{ background:#1b2732; }
    .ui-btn.primary{
      border-color: rgba(24,196,108,.60);
      background:#0f2a1f;                   /* tett primary */
    }
    .ui-btn.primary:hover{ background:#123325; }
    .ui-btn.danger{
      border-color: rgba(255,92,92,.60);
      background:#3a1a1a;                   /* tett danger */
    }
    .ui-btn.danger:hover{ background:#462020; }
    .ui-small{ font-size:12px; color:rgba(232,240,247,.72); line-height:1.35; }
    .ui-pre{
      white-space:pre-wrap; word-break:break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size:12px;
      background:#0f1720;                   /* tett */
      border:1px solid rgba(255,255,255,.14);
      border-radius:14px;
      padding:12px;
    }
  `;
  document.head.appendChild(style);
}

function closeOnEsc(backdrop, onCancel) {
  const handler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      cleanup();
      onCancel?.();
    }
  };
  function cleanup() {
    window.removeEventListener("keydown", handler, true);
    backdrop.remove();
  }
  window.addEventListener("keydown", handler, true);
  return cleanup;
}

function showModal({ title, subtitle, bodyNode, buttons, onCancel }) {
  ensureModalStyles();

  const backdrop = el("div", { class: "ui-backdrop" });
  const modal = el("div", { class: "ui-modal", role: "dialog", "aria-modal": "true" });

  const head = el("div", { class: "ui-modal-head" }, [
    el("div", { class: "ui-modal-title" }, title || ""),
    subtitle ? el("div", { class: "ui-modal-sub" }, subtitle) : null
  ]);

  const body = el("div", { class: "ui-modal-body" }, bodyNode || "");
  const acts = el("div", { class: "ui-actions" });

  const cleanup = closeOnEsc(backdrop, () => {
    onCancel?.();
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      cleanup();
      onCancel?.();
    }
  });

  (buttons || []).forEach(b => {
    const btn = el("button", {
      class: "ui-btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : ""),
      onclick: () => {
        if (b.onClick) b.onClick({ close: () => cleanup() });
        else cleanup();
      }
    }, b.label || "OK");
    acts.appendChild(btn);
  });

  modal.appendChild(head);
  modal.appendChild(body);
  modal.appendChild(acts);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const firstBtn = acts.querySelector("button");
  if (firstBtn) setTimeout(() => firstBtn.focus(), 0);

  return { close: () => cleanup() };
}

// ---------- Public dialogs ----------
export function toast(message) {
  showModal({
    title: "Info",
    subtitle: String(message || ""),
    bodyNode: el("div", { class: "ui-small" }, ""),
    buttons: [{ label: "OK", primary: true }]
  });
}

export function confirmDialog({ title = "Bekreft", subtitle = "", okText = "OK", cancelText = "Avbryt", danger = false }) {
  return new Promise((resolve) => {
    showModal({
      title,
      subtitle,
      bodyNode: el("div", { class: "ui-small" }, ""),
      onCancel: () => resolve(false),
      buttons: [
        { label: cancelText, onClick: ({ close }) => { close(); resolve(false); } },
        { label: okText, primary: !danger, danger, onClick: ({ close }) => { close(); resolve(true); } }
      ]
    });
  });
}

export function promptDialog({ title = "Skriv inn", subtitle = "", label = "", value = "", placeholder = "", okText = "Lagre", cancelText = "Avbryt" }) {
  return new Promise((resolve) => {
    const input = el("input", {
      class: "ui-input",
      value: value ?? "",
      placeholder: placeholder ?? ""
    });

    const bodyNode = el("div", {}, [
      el("div", { class: "ui-field" }, [
        label ? el("div", { class: "ui-label" }, label) : null,
        input
      ]),
      el("div", { class: "ui-small" }, "Tips: ESC eller trykk utenfor for å avbryte.")
    ]);

    showModal({
      title,
      subtitle,
      bodyNode,
      onCancel: () => resolve(null),
      buttons: [
        { label: cancelText, onClick: ({ close }) => { close(); resolve(null); } },
        {
          label: okText,
          primary: true,
          onClick: ({ close }) => {
            const v = String(input.value ?? "").trim();
            close();
            resolve(v);
          }
        }
      ]
    });

    setTimeout(() => input.focus(), 0);
  });
}

export function showCodeDialog({ title = "Eksport", subtitle = "", code = "", okText = "Lukk", copyText = "Kopier" }) {
  return new Promise((resolve) => {
    const pre = el("div", { class: "ui-pre" }, String(code ?? ""));

    const bodyNode = el("div", {}, [
      pre,
      el("div", { class: "ui-small", style: "margin-top:10px;" }, "Dette er JSON som kan importeres tilbake senere.")
    ]);

    showModal({
      title,
      subtitle,
      bodyNode,
      onCancel: () => resolve(false),
      buttons: [
        {
          label: copyText,
          primary: true,
          onClick: async ({ close }) => {
            try {
              if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(String(code ?? ""));
              close();
              resolve(true);
            } catch (e) {
              // fallback hvis clipboard ikke funker
              alert("Kunne ikke kopiere automatisk. Marker og kopier manuelt.");
            }
          }
        },
        { label: okText, onClick: ({ close }) => { close(); resolve(false); } }
      ]
    });
  });
}
