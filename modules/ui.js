export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, String(v));
  }
  if (!Array.isArray(children)) children = [children];
  for (const c of children) {
    if (c == null) continue;
    if (c instanceof Node) node.appendChild(c);
    else node.appendChild(document.createTextNode(String(c)));
  }
  return node;
}

export function toast(msg, ms = 2200) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = String(msg || "");
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

function baseModal({ title, subtitle, bodyNode, okText="OK", cancelText="Avbryt", danger=false, onOk }) {
  return new Promise((resolve) => {
    const backdrop = el("div", { class: "ui-backdrop" });
    const modal = el("div", { class: "ui-modal", role: "dialog", "aria-modal": "true" });

    const head = el("div", { class: "ui-modal-head" }, [
      el("div", { class: "ui-modal-title" }, title || "Dialog"),
      subtitle ? el("div", { class: "ui-modal-sub" }, subtitle) : null
    ]);

    const body = el("div", { class: "ui-modal-body" }, bodyNode);

    const cancelBtn = el("button", { class: "ui-btn" }, cancelText);
    const okBtn = el("button", { class: danger ? "ui-btn" : "ui-btn primary" }, okText);

    const acts = el("div", { class: "ui-actions" }, [cancelBtn, okBtn]);

    modal.appendChild(head);
    modal.appendChild(body);
    modal.appendChild(acts);
    backdrop.appendChild(modal);

    function cleanup() {
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); cleanup(); resolve(null); }
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) { cleanup(); resolve(null); }
    });

    cancelBtn.addEventListener("click", () => { cleanup(); resolve(null); });

    okBtn.addEventListener("click", async () => {
      try {
        const v = onOk ? await onOk() : true;
        cleanup();
        resolve(v);
      } catch (e) {
        console.error(e);
        // hold dialog open if onOk fails
      }
    });

    window.addEventListener("keydown", onKey, true);
    document.body.appendChild(backdrop);

    // Focus
    setTimeout(() => okBtn.focus(), 0);
  });
}

export function confirmDialog({ title="Bekreft", subtitle="", okText="OK", cancelText="Avbryt", danger=false }) {
  const bodyNode = el("div", {}, [
    subtitle ? el("div", { class: "ui-small" }, subtitle) : null
  ]);
  return baseModal({
    title, subtitle: "",
    bodyNode,
    okText, cancelText, danger,
    onOk: async () => true
  }).then(v => v === true);
}

export function promptDialog({ title="Skriv inn", subtitle="", label="", value="", placeholder="", okText="OK", cancelText="Avbryt", multiline=false }) {
  const input = multiline
    ? el("textarea", { class: "ui-textarea", placeholder }, value || "")
    : el("input", { class: "ui-input", value: value || "", placeholder });

  const bodyNode = el("div", {}, [
    el("div", { class: "ui-field" }, [
      label ? el("div", { class: "ui-label" }, label) : null,
      input
    ]),
    el("div", { class: "ui-small" }, "Tips: ESC eller trykk utenfor for å avbryte.")
  ]);

  return baseModal({
    title,
    subtitle,
    bodyNode,
    okText,
    cancelText,
    onOk: async () => (multiline ? input.value : input.value)
  });
}

export function showCodeDialog({ title="Tekst", subtitle="", code="", copyText="Kopier", okText="Lukk" }) {
  const pre = el("textarea", { class: "ui-textarea", readonly: "readonly" }, String(code || ""));
  const copyBtn = el("button", { class: "btn" }, copyText);

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(String(code || ""));
      toast("Kopiert!");
    } catch {
      pre.select();
      document.execCommand("copy");
      toast("Kopiert!");
    }
  });

  const bodyNode = el("div", {}, [
    subtitle ? el("div", { class: "ui-small" }, subtitle) : null,
    copyBtn,
    pre
  ]);

  return baseModal({
    title,
    subtitle: "",
    bodyNode,
    okText,
    cancelText: "",
    onOk: async () => true
  }).then(() => true);
}
