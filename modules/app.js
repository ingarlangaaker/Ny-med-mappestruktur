// modules/app.js
// Core boot-fil for Farmapp
// Nå koblet til storage.js (lokal lagring)

import { loadData, saveData, resetData, exportData, importData } from "./storage.js";

export async function boot() {

  const pill = document.getElementById('pillStatus');
  const nav = document.getElementById('nav');
  const view = document.getElementById('view');
  const title = document.getElementById('viewTitle');
  const sub = document.getElementById('viewSub');
  const actions = document.getElementById('actions');

  if (!pill || !nav || !view || !title || !sub || !actions) {
    console.error("DOM ikke klar");
    return;
  }

  pill.textContent = "Laster data…";

  // ---- Data (global i app.js foreløpig) ----
  let data = loadData();

  function persist() {
    const ok = saveData(data);
    pill.textContent = ok ? "Klar" : "Kunne ikke lagre";
  }

  // ---- Enkel view-motor (router kommer senere) ----
  const views = {};
  let currentViewId = "dashboard";

  function registerView(id, config) { views[id] = config; }

  function setCurrentNav(id) {
    [...nav.querySelectorAll("button")].forEach(btn => {
      btn.removeAttribute("aria-current");
      if (btn.dataset.view === id) btn.setAttribute("aria-current", "page");
    });
  }

  function renderView(id) {
    const v = views[id];
    if (!v) return;

    currentViewId = id;
    setCurrentNav(id);

    title.textContent = v.title || "";
    sub.textContent = (typeof v.subtitle === "function") ? (v.subtitle(data) || "") : (v.subtitle || "");

    actions.innerHTML = "";
    view.innerHTML = "";

    const acts = (typeof v.actions === "function") ? (v.actions(data) || []) : (v.actions || []);
    acts.forEach(a => {
      const btn = document.createElement("button");
      btn.className = "btn " + (a.primary ? "primary" : "") + (a.danger ? " danger" : "");
      btn.textContent = a.label;
      btn.onclick = () => a.onClick({ data, setData, rerender });
      actions.appendChild(btn);
    });

    if (v.render) v.render(view, { data, setData, rerender });
  }

  function rerender() { renderView(currentViewId); }

  function setData(next) {
    data = next;
    persist();
    rerender();
  }

  function renderNav() {
    nav.innerHTML = "";
    Object.keys(views).forEach(key => {
      const btn = document.createElement("button");
      btn.dataset.view = key;
      btn.textContent = views[key].title;
      btn.onclick = () => renderView(key);
      nav.appendChild(btn);
    });
  }

  // ---- Små UI-hjelpere (inntil ui.js kommer) ----
  function promptText(label, current = "") {
    const v = window.prompt(label, current ?? "");
    if (v === null) return null;
    return String(v).trim();
  }

  function confirmBox(msg) { return window.confirm(msg); }

  // =========================
  // VIEWS
  // =========================

  registerView("dashboard", {
    title: "Oversikt",
    subtitle: (d) => d.farm?.name ? `Gård: ${d.farm.name}` : "Sett opp gårdsnavn under «Min gård»",
    actions: () => ([
      {
        label: "Eksporter data",
        onClick: () => {
          const txt = exportData();
          // enkel måte: kopier til utklippstavle hvis mulig
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(txt).then(() => {
              alert("Eksport kopiert til utklippstavle.");
            }).catch(() => {
              alert("Kunne ikke kopiere. Åpner eksport i et vindu.");
              openExportWindow(txt);
            });
          } else {
            openExportWindow(txt);
          }
        }
      },
      {
        label: "Importer data",
        onClick: ({ setData }) => {
          const json = promptText("Lim inn eksportert JSON her:");
          if (!json) return;
          const ok = importData(json);
          if (!ok) return alert("Import feilet. Sjekk at JSON er gyldig.");
          // reload fra storage for å være sikker
          setData(loadData());
          alert("Import ok.");
        }
      },
      {
        label: "Nullstill alt",
        danger: true,
        onClick: ({ setData }) => {
          const ok = confirmBox("Sikker? Dette sletter ALT lagret innhold i appen på denne enheten.");
          if (!ok) return;
          setData(resetData());
          alert("Nullstilt.");
        }
      }
    ]),
    render(container, { data: d }) {
      const farm = d.farm || {};
      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:700; margin-bottom:6px; color:#e8f0f7;">Status</div>
          <div><b>Gård:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>
          <div style="margin-top:10px;">
            Neste: Vi bygger «Min gård» som ekte innstillinger + senere Skifter/Husdyr/PDF.
          </div>
        </div>
      `;
    }
  });

  registerView("minGård", {
    title: "Min gård",
    subtitle: "Grunninfo + sjeldne innstillinger",
    actions: (d) => ([
      {
        label: d.farm?.name ? "Endre gårdsnavn" : "Sett gårdsnavn",
        primary: true,
        onClick: ({ data, setData }) => {
          const name = promptText("Gårdsnavn:", data.farm?.name || "");
          if (name === null) return;
          const next = structuredClone(data);
          next.farm = next.farm || {};
          next.farm.name = name;
          setData(next);
        }
      },
      {
        label: "Endre kommune",
        onClick: ({ data, setData }) => {
          const kommune = promptText("Kommune:", data.farm?.kommune || "");
          if (kommune === null) return;
          const next = structuredClone(data);
          next.farm = next.farm || {};
          next.farm.kommune = kommune;
          setData(next);
        }
      },
      {
        label: "Endre areal (dekar)",
        onClick: ({ data, setData }) => {
          const v = promptText("Areal i dekar (tall):", String(data.farm?.areal ?? 0));
          if (v === null) return;
          const num = Number(String(v).replace(",", "."));
          if (!Number.isFinite(num) || num < 0) return alert("Ugyldig tall.");
          const next = structuredClone(data);
          next.farm = next.farm || {};
          next.farm.areal = num;
          setData(next);
        }
      }
    ]),
    render(container, { data: d }) {
      const farm = d.farm || {};
      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:700; margin-bottom:6px; color:#e8f0f7;">Oppsett</div>
          <div><b>Gårdsnavn:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>
          <div style="margin-top:10px;">
            Dette er «sjeldne endringer»-området (slik du ønsket). Skifter legges her senere.
          </div>
        </div>
      `;
    }
  });

  // ---- init ----
  renderNav();
  renderView("dashboard");
  pill.textContent = "Klar";

  // ---- helpers ----
  function openExportWindow(text) {
    const w = window.open("", "_blank");
    if (!w) return alert("Popup blokkert. Kopier manuelt fra console.");
    w.document.write(`<pre style="white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(text)}</pre>`);
    w.document.close();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[m]));
  }
}
