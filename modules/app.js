// modules/app.js
// Farmapp core
// storage.js (data) + ui.js (dialoger) + router.js (navigasjon)
// Inneholder: Oversikt + Min gård + Skifter (CRUD)
// PATCH:
//  - Knappestil: ikke gjennomsiktig (solid)
//  - Skifte-type velges med dropdown (nedtrekk)

import { loadData, saveData, resetData, exportData, importData } from "./storage.js";
import { toast, confirmDialog, promptDialog, showCodeDialog, escapeHtml, el } from "./ui.js";
import { createRouter } from "./router.js";

export async function boot() {
  // ---- Solid knappestil (override) ----
  ensureSolidButtons();

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
  let data = ensureDataShape(loadData());

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function persist() {
    const ok = saveData(data);
    pill.textContent = ok ? "Klar" : "Kunne ikke lagre";
    return ok;
  }

  // ---- Router ----
  const router = createRouter({ navEl, titleEl, subEl, actionsEl, viewEl });

  function setData(next) {
    data = ensureDataShape(next);
    persist();
    router.setCtx(ctx());
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

  router.setCtx(ctx());

  // ---- Utils ----
  function toNumber(v) {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function sumSkifter(skifter) {
    const out = {
      total: 0,
      fulldyrket: 0,
      overflatedyrket: 0,
      innmarksbeite: 0
    };
    for (const s of skifter || []) {
      const a = Number(s.areal || 0);
      out.total += a;
      if (s.type === "fulldyrket") out.fulldyrket += a;
      else if (s.type === "overflatedyrket") out.overflatedyrket += a;
      else if (s.type === "innmarksbeite") out.innmarksbeite += a;
    }
    return out;
  }

  function typeLabel(t) {
    if (t === "fulldyrket") return "Fulldyrket";
    if (t === "overflatedyrket") return "Overflatedyrket";
    if (t === "innmarksbeite") return "Innmarksbeite";
    return "Ukjent";
  }

  async function askSkifteFields(initial = {}) {
    // 1) navn
    const navn = await promptDialog({
      title: "Skifte",
      subtitle: "Navn / ID",
      label: "Skiftenavn",
      value: initial.navn || "",
      placeholder: "F.eks. Skifte 1",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (navn === null) return null;

    // 2) areal
    const arealTxt = await promptDialog({
      title: "Skifte",
      subtitle: "Areal i dekar",
      label: "Areal (dekar)",
      value: initial.areal != null ? String(initial.areal) : "",
      placeholder: "F.eks. 12,5",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (arealTxt === null) return null;

    const areal = toNumber(arealTxt);
    if (!Number.isFinite(areal) || areal <= 0) {
      toast("Ugyldig areal. Bruk et positivt tall (f.eks. 12 eller 12,5).");
      return null;
    }

    // 3) type – DROPDOWN
    const type = await selectDialog({
      title: "Skifte",
      subtitle: "Velg type areal",
      label: "Type",
      value: initial.type || "fulldyrket",
      options: [
        { value: "fulldyrket", label: "Fulldyrket" },
        { value: "overflatedyrket", label: "Overflatedyrket" },
        { value: "innmarksbeite", label: "Innmarksbeite" }
      ],
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (type === null) return null;

    return {
      id: initial.id || ("s_" + Math.random().toString(16).slice(2) + Date.now().toString(16)),
      navn: String(navn).trim(),
      areal,
      type
    };
  }

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
      const s = sumSkifter(d.skifter);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:800; margin-bottom:6px; color:#e8f0f7;">Status</div>
          <div><b>Gård:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>

          <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:800; margin-bottom:6px; color:#e8f0f7;">Skifter</div>
            <div><b>Antall:</b> ${d.skifter?.length || 0}</div>
            <div><b>Totalt (dekar):</b> ${round1(s.total)}</div>
            <div class="muted" style="margin-top:6px; font-size:12px;">
              Fulldyrket: ${round1(s.fulldyrket)} • Overflatedyrket: ${round1(s.overflatedyrket)} • Innmarksbeite: ${round1(s.innmarksbeite)}
            </div>
          </div>
        </div>
      `;
    }
  });

  // Skifter under Min gård (som instruert)
  router.registerView("minGård", {
    title: "Min gård",
    subtitle: "Grunninfo + Skifter (sjeldne endringer)",
    actions: () => [
      {
        label: "Legg til skifte",
        primary: true,
        onClick: async ({ data, setData }) => {
          const sk = await askSkifteFields({});
          if (!sk) return;
          const next = clone(data);
          next.skifter.push(sk);
          setData(next);
          toast("Skifte lagt til.");
        }
      },
      {
        label: "Lagre gårdsinfo",
        onClick: async ({ data, setData }) => {
          const name = (document.getElementById("farm_name")?.value ?? "").trim();
          const kommune = (document.getElementById("farm_kommune")?.value ?? "").trim();
          const arealRaw = String(document.getElementById("farm_areal")?.value ?? "0").trim().replace(",", ".");
          const areal = Number(arealRaw);

          if (!Number.isFinite(areal) || areal < 0) {
            toast("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
            return;
          }

          const next = clone(data);
          next.farm.name = name;
          next.farm.kommune = kommune;
          next.farm.areal = areal;

          setData(next);
          toast("Gårdsinfo lagret.");
        }
      }
    ],
    render(container, { data: d, setData }) {
      const farm = d.farm || {};
      const skifter = d.skifter || [];
      const s = sumSkifter(skifter);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:800; margin-bottom:10px; color:#e8f0f7;">Grunninfo</div>

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
              Lagre gårdsinfo
            </button>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.06); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:900;">Skifter</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">
                Totalt: ${round1(s.total)} daa • Fulldyrket: ${round1(s.fulldyrket)} • Overflatedyrket: ${round1(s.overflatedyrket)} • Innmarksbeite: ${round1(s.innmarksbeite)}
              </div>
            </div>
            <button id="skifte_add" class="btn primary">Legg til</button>
          </div>

          <div style="padding:14px;">
            ${skifter.length === 0 ? `
              <div class="notice">Ingen skifter ennå. Trykk <b>Legg til</b>.</div>
            ` : `
              <div style="display:grid; gap:10px;">
                ${skifter.map((sk) => `
                  <div style="border:1px solid rgba(255,255,255,.10); border-radius:14px; padding:12px; background:rgba(255,255,255,.03);">
                    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px;">
                      <div>
                        <div style="font-weight:900;">${escapeHtml(sk.navn || "Skifte")}</div>
                        <div class="muted" style="font-size:12px; margin-top:4px;">
                          ${typeLabel(sk.type)} • ${round1(sk.areal)} daa
                        </div>
                      </div>
                      <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn" data-edit="${escapeHtml(sk.id)}">Rediger</button>
                        <button class="btn danger" data-del="${escapeHtml(sk.id)}">Slett</button>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>

        <div class="muted" style="margin-top:10px; font-size:12px; line-height:1.35;">
          Skifter ligger under <b>Min gård</b> fordi dette er “sjeldne endringer”.
        </div>
      `;

      ensureFallbackInputsStyle();

      // Lagre gårdsinfo (knapp i view)
      document.getElementById("farm_save")?.addEventListener("click", async () => {
        const name = (document.getElementById("farm_name")?.value ?? "").trim();
        const kommune = (document.getElementById("farm_kommune")?.value ?? "").trim();
        const arealRaw = String(document.getElementById("farm_areal")?.value ?? "0").trim().replace(",", ".");
        const areal = Number(arealRaw);

        if (!Number.isFinite(areal) || areal < 0) {
          toast("Ugyldig areal. Bruk et tall (f.eks. 15 eller 15,5).");
          return;
        }

        const next = clone(d);
        next.farm.name = name;
        next.farm.kommune = kommune;
        next.farm.areal = areal;

        setData(next);
        toast("Gårdsinfo lagret.");
      });

      // Legg til skifte (knapp i view)
      document.getElementById("skifte_add")?.addEventListener("click", async () => {
        const sk = await askSkifteFields({});
        if (!sk) return;
        const next = clone(d);
        next.skifter.push(sk);
        setData(next);
        toast("Skifte lagt til.");
      });

      // Rediger / slett
      container.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-edit");
          const idx = (d.skifter || []).findIndex(x => x.id === id);
          if (idx < 0) return;

          const current = d.skifter[idx];
          const updated = await askSkifteFields(current);
          if (!updated) return;

          const next = clone(d);
          next.skifter[idx] = updated;
          setData(next);
          toast("Skifte oppdatert.");
        });
      });

      container.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-del");
          const sk = (d.skifter || []).find(x => x.id === id);
          if (!sk) return;

          const ok = await confirmDialog({
            title: "Slett skifte?",
            subtitle: `${sk.navn || "Skifte"} (${round1(sk.areal)} daa) blir slettet.`,
            okText: "Slett",
            cancelText: "Avbryt",
            danger: true
          });
          if (!ok) return;

          const next = clone(d);
          next.skifter = next.skifter.filter(x => x.id !== id);
          setData(next);
          toast("Skifte slettet.");
        });
      });
    }
  });

  // ---- init ----
  router.init("dashboard");
  pill.textContent = "Klar";
}

// ---------- Helpers ----------

function ensureDataShape(d) {
  d = d || {};
  d.farm = d.farm || { name: "", kommune: "", areal: 0 };
  d.skifter = Array.isArray(d.skifter) ? d.skifter : [];
  d.husdyr = Array.isArray(d.husdyr) ? d.husdyr : [];
  d.fertilizerLog = Array.isArray(d.fertilizerLog) ? d.fertilizerLog : [];
  d.plantProtectionLog = Array.isArray(d.plantProtectionLog) ? d.plantProtectionLog : [];
  return d;
}

function round1(n) {
  const x = Number(n || 0);
  return Math.round(x * 10) / 10;
}

// Solid buttons override (fjerner "gjennomsiktig" look)
function ensureSolidButtons() {
  const id = "farmapp_solid_buttons_v1";
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    /* Main buttons */
    .btn{
      background: rgba(255,255,255,.10) !important;
      border: 1px solid rgba(255,255,255,.18) !important;
    }
    .btn:hover{ background: rgba(255,255,255,.14) !important; }
    .btn.primary{
      background: linear-gradient(180deg, rgba(24,196,108,.38), rgba(24,196,108,.18)) !important;
      border-color: rgba(24,196,108,.60) !important;
    }
    .btn.danger{
      background: rgba(255,92,92,.18) !important;
      border-color: rgba(255,92,92,.60) !important;
    }

    /* Nav buttons */
    .nav button{
      background: rgba(255,255,255,.08) !important;
      border-color: rgba(255,255,255,.14) !important;
    }
    .nav button[aria-current="page"]{
      background: rgba(24,196,108,.18) !important;
      border-color: rgba(24,196,108,.55) !important;
    }
  `;
  document.head.appendChild(st);
}

// Input-stil for Min gård
function ensureFallbackInputsStyle() {
  const styleId = "min_gard_input_style";
  if (document.getElementById(styleId)) return;
  const st = document.createElement("style");
  st.id = styleId;
  st.textContent = `
    .ui-input-fallback{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.24);
      color:inherit;
      outline:none;
    }
    .ui-input-fallback:focus{
      border-color: rgba(24,196,108,.60);
      box-shadow: 0 0 0 4px rgba(24,196,108,.14);
    }
  `;
  document.head.appendChild(st);
}

// Dropdown-dialog (nedtrekk) – uten å endre ui.js
function selectDialog({ title = "Velg", subtitle = "", label = "", value = "", options = [], okText = "OK", cancelText = "Avbryt" }) {
  return new Promise((resolve) => {
    ensureSelectDialogStyles();

    const select = el("select", { class: "ui-select" }, []);
    for (const opt of options) {
      const o = el("option", { value: opt.value }, opt.label);
      if (String(opt.value) === String(value)) o.selected = true;
      select.appendChild(o);
    }

    const bodyNode = el("div", {}, [
      el("div", { class: "ui-field" }, [
        label ? el("div", { class: "ui-label" }, label) : null,
        select
      ]),
      el("div", { class: "ui-small" }, "Tips: ESC eller trykk utenfor for å avbryte.")
    ]);

    // Bygg modal med samme klasse-navn som ui.js bruker
    const backdrop = el("div", { class: "ui-backdrop" });
    const modal = el("div", { class: "ui-modal", role: "dialog", "aria-modal": "true" });
    const head = el("div", { class: "ui-modal-head" }, [
      el("div", { class: "ui-modal-title" }, title),
      subtitle ? el("div", { class: "ui-modal-sub" }, subtitle) : null
    ]);
    const body = el("div", { class: "ui-modal-body" }, bodyNode);
    const acts = el("div", { class: "ui-actions" }, [
      el("button", {
        class: "ui-btn",
        onclick: () => { cleanup(); resolve(null); }
      }, cancelText),
      el("button", {
        class: "ui-btn primary",
        onclick: () => { const v = String(select.value); cleanup(); resolve(v); }
      }, okText)
    ]);

    modal.appendChild(head);
    modal.appendChild(body);
    modal.appendChild(acts);
    backdrop.appendChild(modal);

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cleanup();
        resolve(null);
      }
    }
    function cleanup() {
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        cleanup();
        resolve(null);
      }
    });

    window.addEventListener("keydown", onKey, true);
    document.body.appendChild(backdrop);
    setTimeout(() => select.focus(), 0);
  });
}

function ensureSelectDialogStyles() {
  const id = "farmapp_select_dialog_styles_v1";
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .ui-select{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:rgba(0,0,0,.24);
      color:inherit;
      outline:none;
      appearance:auto;
    }
    .ui-select:focus{
      border-color: rgba(24,196,108,.60);
      box-shadow: 0 0 0 4px rgba(24,196,108,.14);
    }
  `;
  document.head.appendChild(st);
}
