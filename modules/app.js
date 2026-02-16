// modules/app.js
// Core boot-fil for Farmapp
// Koblet til storage.js (lokal lagring)
// FIKS: "Min gård" bruker nå skjema + Lagre (ingen prompt/alert for input)

import { loadData, saveData, resetData, exportData, importData } from "./storage.js";

export async function boot() {
  const pill = document.getElementById("pillStatus");
  const nav = document.getElementById("nav");
  const view = document.getElementById("view");
  const title = document.getElementById("viewTitle");
  const sub = document.getElementById("viewSub");
  const actions = document.getElementById("actions");

  if (!pill || !nav || !view || !title || !sub || !actions) {
    console.error("DOM ikke klar");
    return;
  }

  pill.textContent = "Laster data…";

  // ---- Data (foreløpig globalt her) ----
  let data = loadData();

  function persist() {
    const ok = saveData(data);
    pill.textContent = ok ? "Klar" : "Kunne ikke lagre";
  }

  // ---- Enkel view-motor (router kommer senere) ----
  const views = {};
  let currentViewId = "dashboard";

  function registerView(id, config) {
    views[id] = config;
  }

  function setCurrentNav(id) {
    [...nav.querySelectorAll("button")].forEach((btn) => {
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
    sub.textContent =
      typeof v.subtitle === "function" ? v.subtitle(data) || "" : v.subtitle || "";

    actions.innerHTML = "";
    view.innerHTML = "";

    const acts = typeof v.actions === "function" ? v.actions(data) || [] : v.actions || [];
    acts.forEach((a) => {
      const btn = document.createElement("button");
      btn.className =
        "btn" + (a.primary ? " primary" : "") + (a.danger ? " danger" : "");
      btn.textContent = a.label;
      btn.onclick = () => a.onClick({ data, setData, rerender });
      actions.appendChild(btn);
    });

    if (v.render) v.render(view, { data, setData, rerender });
  }

  function rerender() {
    renderView(currentViewId);
  }

  function setData(next) {
    data = next;
    persist();
    rerender();
  }

  function renderNav() {
    nav.innerHTML = "";
    Object.keys(views).forEach((key) => {
      const btn = document.createElement("button");
      btn.dataset.view = key;
      btn.textContent = views[key].title;
      btn.onclick = () => renderView(key);
      nav.appendChild(btn);
    });
  }

  // ---- Helpers ----
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function openExportWindow(text) {
    const w = window.open("", "_blank");
    if (!w) return alert("Popup blokkert. Kopier manuelt fra console.");
    w.document.write(
      `<pre style="white-space:pre-wrap; word-break:break-word; font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(
        text
      )}</pre>`
    );
    w.document.close();
  }

  function clone(obj) {
    // Robust kloning uten å være avhengig av structuredClone
    return JSON.parse(JSON.stringify(obj));
  }

  // =========================
  // VIEWS
  // =========================

  registerView("dashboard", {
    title: "Oversikt",
    subtitle: (d) => (d.farm?.name ? `Gård: ${d.farm.name}` : "Sett opp gårdsnavn under «Min gård»"),
    actions: () => [
      {
        label: "Eksporter data",
        onClick: () => {
          const txt = exportData();
          if (navigator.clipboard?.writeText) {
            navigator.clipboard
              .writeText(txt)
              .then(() => alert("Eksport kopiert til utklippstavle."))
              .catch(() => openExportWindow(txt));
          } else {
            openExportWindow(txt);
          }
        },
      },
      {
        label: "Importer data",
        onClick: ({ setData }) => {
          const json = window.prompt("Lim inn eksportert JSON her:");
          if (!json) return;
          const ok = importData(json);
          if (!ok) return alert("Import feilet. Sjekk at JSON er gyldig.");
          setData(loadData());
          alert("Import ok.");
        },
      },
      {
        label: "Nullstill alt",
        danger: true,
        onClick: ({ setData }) => {
          const ok = window.confirm(
            "Sikker? Dette sletter ALT lagret innhold i appen på denne enheten."
          );
          if (!ok) return;
          setData(resetData());
          alert("Nullstilt.");
        },
      },
    ],
    render(container, { data: d }) {
      const farm = d.farm || {};
      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:700; margin-bottom:6px; color:#e8f0f7;">Status</div>
          <div><b>Gård:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>
          <div style="margin-top:10px;">
            Gå til <b>Min gård</b> for å endre grunninfo.
          </div>
        </div>
      `;
    },
  });

  registerView("minGård", {
    title: "Min gård",
    subtitle: "Grunninfo + sjeldne innstillinger",
    actions: () => [
      {
        label: "Lagre",
        primary: true,
        onClick: ({ data, setData }) => {
          // Lagre-knappen i topp (samme som i skjemaet)
          const nameEl = document.getElementById("farm_name");
          const kommuneEl = document.getElementById("farm_kommune");
          const arealEl = document.getElementById("farm_areal");

          const name = (nameEl?.value ?? "").trim();
          const kommune = (kommuneEl?.value ?? "").trim();
          const arealRaw = String(arealEl?.value ?? "0").trim().replace(",", ".");
          const areal = Number(arealRaw);

          if (!Number.isFinite(areal) || areal < 0) {
            alert("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
            return;
          }

          const next = clone(data);
          next.farm = next.farm || {};
          next.farm.name = name;
          next.farm.kommune = kommune;
          next.farm.areal = areal;

          setData(next);
          alert("Lagret.");
        },
      },
    ],
    render(container, { data: d, setData }) {
      const farm = d.farm || {};
      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:700; margin-bottom:10px; color:#e8f0f7;">Oppsett</div>

          <div style="display:grid; gap:10px;">
            <div>
              <div class="muted" style="font-size:13px; margin-bottom:6px;">Gårdsnavn</div>
              <input id="farm_name" class="ui-input-fallback" value="${escapeHtml(farm.name || "")}" placeholder="F.eks. Drengen gård" />
            </div>

            <div>
              <div class="muted" style="font-size:13px; margin-bottom:6px;">Kommune</div>
              <input id="farm_kommune" class="ui-input-fallback" value="${escapeHtml(farm.kommune || "")}" placeholder="F.eks. Karmøy" />
            </div>

            <div>
              <div class="muted" style="font-size:13px; margin-bottom:6px;">Areal (dekar)</div>
              <input id="farm_areal" class="ui-input-fallback" inputmode="decimal" value="${escapeHtml(String(farm.areal ?? 0))}" placeholder="0" />
            </div>

            <button id="farm_save" class="btn primary" style="width:100%; justify-content:center;">
              Lagre
            </button>

            <div class="muted" style="font-size:12px; line-height:1.35;">
              Dette er området for sjeldne endringer (slik du ønsket). Skifter legges her senere.
            </div>
          </div>
        </div>
      `;

      // liten inline-style for input uten at vi bruker ui.js ennå
      const styleId = "min_gard_input_style";
      if (!document.getElementById(styleId)) {
        const st = document.createElement("style");
        st.id = styleId;
        st.textContent = `
          .ui-input-fallback{
            width:100%;
            padding:12px 12px;
            border-radius:14px;
            border:1px solid rgba(255,255,255,.12);
            background:rgba(0,0,0,.20);
            color:inherit;
            outline:none;
          }
          .ui-input-fallback:focus{
            border-color: rgba(24,196,108,.55);
            box-shadow: 0 0 0 4px rgba(24,196,108,.12);
          }
        `;
        document.head.appendChild(st);
      }

      const btn = document.getElementById("farm_save");
      btn?.addEventListener("click", () => {
        const name = (document.getElementById("farm_name")?.value ?? "").trim();
        const kommune = (document.getElementById("farm_kommune")?.value ?? "").trim();
        const arealRaw = String(document.getElementById("farm_areal")?.value ?? "0")
          .trim()
          .replace(",", ".");
        const areal = Number(arealRaw);

        if (!Number.isFinite(areal) || areal < 0) {
          alert("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
          return;
        }

        const next = clone(d);
        next.farm = next.farm || {};
        next.farm.name = name;
        next.farm.kommune = kommune;
        next.farm.areal = areal;

        setData(next);
        alert("Lagret.");
      });
    },
  });

  // ---- init ----
  renderNav();
  renderView("dashboard");
  pill.textContent = "Klar";
}
