// modules/app.js
// Core boot-fil for Farmapp
// storage.js (data) + ui.js (dialoger) + router.js (navigasjon)

import { loadData, saveData, resetData, exportData, importData } from "./storage.js";
import { toast, confirmDialog, promptDialog, showCodeDialog, escapeHtml } from "./ui.js";
import { createRouter } from "./router.js";

export async function boot() {
  const pill = document.getElementById("pillStatus");
  const navEl = document.getElementById("nav");
  const viewEl = document.getElementById("view");
  const titleEl = document.getElementById("viewTitle");
  const subEl = document.getElementById("viewSub");
  const actionsEl = document.getElementById("actions");

  if (!pill || !navEl || !viewEl || !titleEl || !subEl || !actionsEl) {
    console.error("DOM ikke klar");
    return;
  }

  pill.textContent = "Laster data…";

  // ---- Data ----
  let data = loadData();

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function persist() {
    const ok = saveData(data);
    pill.textContent = ok ? "Klar" : "Kunne ikke lagre";
    return ok;
  }

  function setData(next) {
    data = next;
    persist();
    router.setCtx(ctx());  // oppdater kontekst
    router.rerender();
  }

  function ctx() {
    return {
      data,
      setData,
      rerender: () => router.rerender(),
      toast
    };
  }

  // ---- Router ----
  const router = createRouter({
    navEl,
    titleEl,
    subEl,
    actionsEl,
    viewEl
  });

  router.setCtx(ctx());

  // =========================
  // VIEWS
  // =========================

  router.registerView("dashboard", {
    title: "Oversikt",
    subtitle: (d) => (d?.farm?.name ? `Gård: ${d.farm.name}` : "Sett opp gårdsnavn under «Min gård»"),
    actions: () => [
      {
        label: "Eksporter data",
        onClick: async () => {
          const txt = exportData();
          await showCodeDialog({
            title: "Eksport (JSON)",
            subtitle: "Kopier og lagre denne teksten. Du kan importere den tilbake senere.",
            code: txt,
            copyText: "Kopier",
            okText: "Lukk"
          });
        }
      },
      {
        label: "Importer data",
        onClick: async ({ setData }) => {
          const json = await promptDialog({
            title: "Importer (JSON)",
            subtitle: "Lim inn eksportert JSON her.",
            label: "JSON",
            value: "",
            placeholder: "{ ... }",
            okText: "Importer",
            cancelText: "Avbryt"
          });
          if (json === null) return;

          const ok = importData(json);
          if (!ok) return toast("Import feilet. Sjekk at teksten er gyldig JSON.");

          setData(loadData());
          toast("Import ok.");
        }
      },
      {
        label: "Nullstill alt",
        danger: true,
        onClick: async ({ setData }) => {
          const ok = await confirmDialog({
            title: "Nullstill alt?",
            subtitle: "Dette sletter ALT lagret innhold i appen på denne enheten.",
            okText: "Slett alt",
            cancelText: "Avbryt",
            danger: true
          });
          if (!ok) return;

          setData(resetData());
          toast("Nullstilt.");
        }
      }
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
            Bruk menyen til venstre. URL støtter direkte lenker, f.eks. <b>#dashboard</b>.
          </div>
        </div>
      `;
    }
  });

  router.registerView("minGård", {
    title: "Min gård",
    subtitle: "Grunninfo + sjeldne innstillinger",
    actions: () => [
      {
        label: "Lagre",
        primary: true,
        onClick: async ({ data, setData }) => {
          const nameEl = document.getElementById("farm_name");
          const kommuneEl = document.getElementById("farm_kommune");
          const arealEl = document.getElementById("farm_areal");

          const name = (nameEl?.value ?? "").trim();
          const kommune = (kommuneEl?.value ?? "").trim();
          const arealRaw = String(arealEl?.value ?? "0").trim().replace(",", ".");
          const areal = Number(arealRaw);

          if (!Number.isFinite(areal) || areal < 0) {
            toast("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
            return;
          }

          const next = clone(data);
          next.farm = next.farm || {};
          next.farm.name = name;
          next.farm.kommune = kommune;
          next.farm.areal = areal;

          setData(next);
          toast("Lagret.");
        }
      }
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

      // input-style (enkelt)
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

      document.getElementById("farm_save")?.addEventListener("click", async () => {
        const name = (document.getElementById("farm_name")?.value ?? "").trim();
        const kommune = (document.getElementById("farm_kommune")?.value ?? "").trim();
        const arealRaw = String(document.getElementById("farm_areal")?.value ?? "0")
          .trim()
          .replace(",", ".");
        const areal = Number(arealRaw);

        if (!Number.isFinite(areal) || areal < 0) {
          toast("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
          return;
        }

        const next = clone(d);
        next.farm = next.farm || {};
        next.farm.name = name;
        next.farm.kommune = kommune;
        next.farm.areal = areal;

        setData(next);
        toast("Lagret.");
      });
    }
  });

  // ---- init ----
  router.init("dashboard");
  pill.textContent = "Klar";
}
