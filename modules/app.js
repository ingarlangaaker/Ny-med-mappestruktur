// modules/app.js
// Farmapp core (robust)
// Oversikt + Min gård + Skifter (CRUD)
// + Sprøytejournal + Gjødseljournal + Husdyr (grunnmur)
// + PDF-eksport via dynamisk import av modules/pdf.js (bruker openPrintReport)
// Proff UI: solide knapper + dropdown i dialoger + tette dialoger (ui.js)

import { loadData, saveData, resetData, exportData, importData } from "./storage.js";
import { toast, confirmDialog, promptDialog, showCodeDialog, escapeHtml, el } from "./ui.js";
import { createRouter } from "./router.js";

export async function boot() {
  ensureSolidButtons();
  ensureFallbackInputsStyle();
  ensureSelectDialogStyles();

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
    return { data, setData, rerender: () => router.rerender(), toast };
  }
  router.setCtx(ctx());

  // =========================
  // Helpers / utils
  // =========================

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function fmtDate(iso) {
    // iso: YYYY-MM-DD
    const s = String(iso || "").trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `${m[3]}.${m[2]}.${m[1]}`;
  }

  function toNumber(v) {
    const s = String(v ?? "").trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function round1(n) {
    const x = Number(n || 0);
    return Math.round(x * 10) / 10;
  }

  function typeLabel(t) {
    if (t === "fulldyrket") return "Fulldyrket";
    if (t === "overflatedyrket") return "Overflatedyrket";
    if (t === "innmarksbeite") return "Innmarksbeite";
    return "Ukjent";
  }

  function sumSkifter(skifter) {
    const out = { total: 0, fulldyrket: 0, overflatedyrket: 0, innmarksbeite: 0 };
    for (const s of skifter || []) {
      const a = Number(s?.areal || 0);
      out.total += a;
      if (s?.type === "fulldyrket") out.fulldyrket += a;
      else if (s?.type === "overflatedyrket") out.overflatedyrket += a;
      else if (s?.type === "innmarksbeite") out.innmarksbeite += a;
    }
    return out;
  }

  function skifteOptions(d) {
    const skifter = Array.isArray(d?.skifter) ? d.skifter : [];
    return skifter
      .slice()
      .sort((a, b) => (a?.navn || "").localeCompare(b?.navn || "", "nb"))
      .map((s) => ({
        value: s.id,
        label: `${s.navn || "Skifte"} (${typeLabel(s.type)}, ${round1(s.areal)} daa)`
      }));
  }

  function skifteNameById(d, id) {
    const s = (d?.skifter || []).find((x) => x.id === id);
    return s ? (s.navn || "Skifte") : "Ukjent skifte";
  }

  function newId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  }

  async function openPrintPDF({ title, fileName, html }) {
    try {
      const pdf = await import("./pdf.js");
      pdf.openPrintReport({ title, fileName, html });
    } catch (e) {
      console.error(e);
      toast("PDF-modul mangler eller popups er blokkert. Sjekk at modules/pdf.js finnes, og at popups er tillatt.");
    }
  }

  function buildJournalHTML({ title, farm, subtitleLines = [], columns = [], rows = [], footerLeft = "Farmapp" }) {
    const gen = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const generated = `${pad(gen.getDate())}.${pad(gen.getMonth() + 1)}.${gen.getFullYear()} ${pad(gen.getHours())}:${pad(gen.getMinutes())}`;

    const headLeft = `
      <div>
        <div style="font-size:16pt;font-weight:900;margin:0 0 2mm 0;line-height:1.1;">${escapeHtml(title)}</div>
        <div style="font-size:10pt;color:#333;line-height:1.35;">
          <b>${escapeHtml(farm?.name || "Gård")}</b>${farm?.kommune ? ` • ${escapeHtml(farm.kommune)}` : ""}
        </div>
        ${subtitleLines.length ? `<div style="margin-top:2mm;font-size:9pt;color:#444;">${subtitleLines.map(escapeHtml).join(" • ")}</div>` : ""}
      </div>
    `;
    const headRight = `
      <div style="text-align:right;font-size:9pt;color:#333;line-height:1.35;white-space:nowrap;">
        <div><b>Generert:</b> ${escapeHtml(generated)}</div>
        <div><b>Antall:</b> ${rows.length}</div>
      </div>
    `;

    const thead = `
      <thead>
        <tr>
          ${columns.map((c) => `<th style="${c.width ? `width:${c.width};` : ""}${c.align === "right" ? "text-align:right;" : ""}">${escapeHtml(c.label)}</th>`).join("")}
        </tr>
      </thead>
    `;
    const tbody = `
      <tbody>
        ${rows
          .map(
            (r) => `
          <tr>
            ${columns
              .map((c) => {
                const v = r[c.key];
                const txt = v == null ? "" : String(v);
                const cls = c.align === "right" ? "num" : "";
                return `<td class="${cls}">${escapeHtml(txt)}</td>`;
              })
              .join("")}
          </tr>
        `
          )
          .join("")}
      </tbody>
    `;

    // Samme A4-stil som pdf.js (men selvstendig HTML-innhold)
    return `
      <div class="sheet">
        <div class="r-head" style="display:flex;gap:10mm;align-items:flex-start;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,.12);padding:10mm 12mm 6mm 12mm;">
          ${headLeft}
          ${headRight}
        </div>
        <div class="r-body" style="padding:6mm 12mm 10mm 12mm;">
          <div style="font-size:11pt;font-weight:900;margin:0 0 3mm 0;">${escapeHtml(title)}</div>
          <table style="width:100%;border-collapse:collapse;font-size:10pt;">
            ${thead}
            ${tbody}
          </table>
        </div>
        <div class="r-foot" style="border-top:1px solid rgba(0,0,0,.12);padding:4mm 12mm 8mm 12mm;font-size:9pt;color:#333;display:flex;justify-content:space-between;gap:8mm;">
          <div style="color:#444;">${escapeHtml(footerLeft)}</div>
          <div style="color:#444;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace;">
            ${escapeHtml((farm?.name || "").slice(0, 40))}
          </div>
        </div>
      </div>
    `;
  }

  // =========================
  // Dialogs for Skifter
  // =========================

  async function askSkifteFields(initial = {}) {
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
      id: initial.id || newId("s"),
      navn: String(navn).trim(),
      areal,
      type
    };
  }

  // =========================
  // Dialogs for Journals
  // =========================

  async function askSprøytingEntry(d, initial = {}) {
    const skOpts = skifteOptions(d);
    if (!skOpts.length) {
      toast("Du må legge inn minst ett skifte først (Min gård → Skifter).");
      return null;
    }

    const dato = await promptDialog({
      title: "Sprøyting",
      subtitle: "Dato (YYYY-MM-DD)",
      label: "Dato",
      value: initial.date || todayISO(),
      placeholder: "YYYY-MM-DD",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (dato === null) return null;

    const skifteId = await selectDialog({
      title: "Sprøyting",
      subtitle: "Velg skifte",
      label: "Skifte",
      value: initial.skifteId || skOpts[0].value,
      options: skOpts,
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (skifteId === null) return null;

    const middel = await promptDialog({
      title: "Sprøyting",
      subtitle: "Middel / produkt",
      label: "Middel",
      value: initial.product || "",
      placeholder: "F.eks. navn på middel",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (middel === null) return null;

    const doseTxt = await promptDialog({
      title: "Sprøyting",
      subtitle: "Dose (tall)",
      label: "Dose",
      value: initial.dose != null ? String(initial.dose) : "",
      placeholder: "F.eks. 0,5",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (doseTxt === null) return null;

    const dose = toNumber(doseTxt);
    if (!Number.isFinite(dose) || dose < 0) {
      toast("Ugyldig dose. Bruk et tall (f.eks. 0,5).");
      return null;
    }

    const unit = await selectDialog({
      title: "Sprøyting",
      subtitle: "Enhet for dose",
      label: "Enhet",
      value: initial.unit || "l/daa",
      options: [
        { value: "l/daa", label: "l/daa" },
        { value: "ml/daa", label: "ml/daa" },
        { value: "g/daa", label: "g/daa" },
        { value: "kg/daa", label: "kg/daa" },
        { value: "annet", label: "Annet" }
      ],
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (unit === null) return null;

    const formål = await promptDialog({
      title: "Sprøyting",
      subtitle: "Formål / målorganisme (valgfritt)",
      label: "Formål",
      value: initial.purpose || "",
      placeholder: "F.eks. ugras / sopp",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (formål === null) return null;

    const notat = await promptDialog({
      title: "Sprøyting",
      subtitle: "Notat (valgfritt)",
      label: "Notat",
      value: initial.note || "",
      placeholder: "",
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (notat === null) return null;

    return {
      id: initial.id || newId("pp"),
      date: String(dato).trim(),
      skifteId,
      product: String(middel).trim(),
      dose,
      unit,
      purpose: String(formål || "").trim(),
      note: String(notat || "").trim()
    };
  }

  async function askGjødselEntry(d, initial = {}) {
    const skOpts = skifteOptions(d);
    if (!skOpts.length) {
      toast("Du må legge inn minst ett skifte først (Min gård → Skifter).");
      return null;
    }

    const dato = await promptDialog({
      title: "Gjødsel",
      subtitle: "Dato (YYYY-MM-DD)",
      label: "Dato",
      value: initial.date || todayISO(),
      placeholder: "YYYY-MM-DD",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (dato === null) return null;

    const skifteId = await selectDialog({
      title: "Gjødsel",
      subtitle: "Velg skifte",
      label: "Skifte",
      value: initial.skifteId || skOpts[0].value,
      options: skOpts,
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (skifteId === null) return null;

    const type = await selectDialog({
      title: "Gjødsel",
      subtitle: "Type",
      label: "Type",
      value: initial.type || "Mineralgjødsel",
      options: [
        { value: "Mineralgjødsel", label: "Mineralgjødsel" },
        { value: "Husdyrgjødsel", label: "Husdyrgjødsel" },
        { value: "Kalk", label: "Kalk" },
        { value: "Annet", label: "Annet" }
      ],
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (type === null) return null;

    const produkt = await promptDialog({
      title: "Gjødsel",
      subtitle: "Produkt / blanding",
      label: "Produkt",
      value: initial.product || "",
      placeholder: "F.eks. 22-3-10 / kugjødsel",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (produkt === null) return null;

    const mengdeTxt = await promptDialog({
      title: "Gjødsel",
      subtitle: "Mengde (tall)",
      label: "Mengde",
      value: initial.amount != null ? String(initial.amount) : "",
      placeholder: "F.eks. 25",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (mengdeTxt === null) return null;

    const amount = toNumber(mengdeTxt);
    if (!Number.isFinite(amount) || amount < 0) {
      toast("Ugyldig mengde. Bruk et tall (f.eks. 25).");
      return null;
    }

    const unit = await selectDialog({
      title: "Gjødsel",
      subtitle: "Enhet",
      label: "Enhet",
      value: initial.unit || "kg/daa",
      options: [
        { value: "kg/daa", label: "kg/daa" },
        { value: "l/daa", label: "l/daa" },
        { value: "tonn/ha", label: "tonn/ha" },
        { value: "kg", label: "kg (totalt)" },
        { value: "l", label: "l (totalt)" }
      ],
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (unit === null) return null;

    const notat = await promptDialog({
      title: "Gjødsel",
      subtitle: "Notat (valgfritt)",
      label: "Notat",
      value: initial.note || "",
      placeholder: "",
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (notat === null) return null;

    return {
      id: initial.id || newId("f"),
      date: String(dato).trim(),
      skifteId,
      type: String(type),
      product: String(produkt).trim(),
      amount,
      unit,
      note: String(notat || "").trim()
    };
  }

  // =========================
  // Husdyr (grunnmur)
  // =========================

  const HUSDYR_PRESETS = [
    // Sau
    { species: "Sau", category: "Søye" },
    { species: "Sau", category: "Vær" },
    { species: "Sau", category: "Lam" },
    // Geit
    { species: "Geit", category: "Geit" },
    { species: "Geit", category: "Bukk" },
    { species: "Geit", category: "Kje" }
  ];

  function ensureHusdyrRows(d) {
    const arr = Array.isArray(d.husdyr) ? d.husdyr : [];
    // Hvis tomt: legg inn presets med 0
    if (!arr.length) {
      d.husdyr = HUSDYR_PRESETS.map((p) => ({ id: newId("h"), species: p.species, category: p.category, count: 0, note: "" }));
    }
  }

  function husdyrSum(d) {
    const arr = Array.isArray(d.husdyr) ? d.husdyr : [];
    const out = {};
    for (const r of arr) {
      const k = r.species || "Ukjent";
      out[k] = (out[k] || 0) + Number(r.count || 0);
    }
    return out;
  }

  async function editHusdyrCount(row) {
    const txt = await promptDialog({
      title: "Husdyr",
      subtitle: `${row.species} – ${row.category}`,
      label: "Antall",
      value: String(row.count ?? 0),
      placeholder: "0",
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (txt === null) return null;
    const n = Math.floor(toNumber(txt));
    if (!Number.isFinite(n) || n < 0) {
      toast("Ugyldig antall. Bruk et heltall (0 eller høyere).");
      return null;
    }
    return n;
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
      ensureHusdyrRows(d);
      const farm = d.farm || {};
      const s = sumSkifter(d.skifter);
      const hus = husdyrSum(d);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Status</div>
          <div><b>Gård:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>

          <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Skifter</div>
            <div><b>Antall:</b> ${(d.skifter || []).length}</div>
            <div><b>Totalt (dekar):</b> ${round1(s.total)}</div>
            <div class="muted" style="margin-top:6px; font-size:12px;">
              Fulldyrket: ${round1(s.fulldyrket)} • Overflatedyrket: ${round1(s.overflatedyrket)} • Innmarksbeite: ${round1(s.innmarksbeite)}
            </div>
          </div>

          <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Husdyr</div>
            <div class="muted" style="font-size:12px;">
              ${Object.keys(hus).length ? Object.entries(hus).map(([k,v]) => `${escapeHtml(k)}: <b>${v}</b>`).join(" • ") : "Ingen registreringer"}
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Rapporter</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">Åpner utskrift → velg <b>Skriv ut</b> → <b>Lagre som PDF</b>.</div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="pdf_skifter" class="btn primary" style="width:100%; justify-content:center;">Skifterapport (PDF)</button>
            <button id="pdf_sproyte" class="btn primary" style="width:100%; justify-content:center;">Sprøytejournal (PDF)</button>
            <button id="pdf_gjodsel" class="btn primary" style="width:100%; justify-content:center;">Gjødseljournal (PDF)</button>
          </div>
        </div>
      `;

      document.getElementById("pdf_skifter")?.addEventListener("click", async () => {
        try {
          const pdf = await import("./pdf.js");
          const html = pdf.buildSkifteReportHTML({
            data: d,
            farmName: d?.farm?.name || "",
            kommune: d?.farm?.kommune || ""
          });
          pdf.openPrintReport({ title: "Skifterapport", html, fileName: "skifterapport" });
        } catch (e) {
          console.error(e);
          toast("PDF fungerer ikke ennå. Sjekk at modules/pdf.js finnes og popups er tillatt.");
        }
      });

      document.getElementById("pdf_sproyte")?.addEventListener("click", () => {
        const rows = (d.plantProtectionLog || [])
          .slice()
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
          .map((r) => ({
            date: fmtDate(r.date),
            skifte: skifteNameById(d, r.skifteId),
            middel: r.product || "",
            dose: `${r.dose ?? ""} ${r.unit || ""}`.trim(),
            formål: r.purpose || "",
            notat: r.note || ""
          }));

        const html = buildJournalHTML({
          title: "Sprøytejournal",
          farm: d.farm || {},
          subtitleLines: ["Plantevernjournal"],
          columns: [
            { key: "date", label: "Dato", width: "14%" },
            { key: "skifte", label: "Skifte", width: "22%" },
            { key: "middel", label: "Middel", width: "22%" },
            { key: "dose", label: "Dose", width: "14%" },
            { key: "formål", label: "Formål", width: "14%" },
            { key: "notat", label: "Notat", width: "14%" }
          ],
          rows
        });

        openPrintPDF({ title: "Sprøytejournal", fileName: "sproytejournal", html });
      });

      document.getElementById("pdf_gjodsel")?.addEventListener("click", () => {
        const rows = (d.fertilizerLog || [])
          .slice()
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
          .map((r) => ({
            date: fmtDate(r.date),
            skifte: skifteNameById(d, r.skifteId),
            type: r.type || "",
            produkt: r.product || "",
            mengde: `${r.amount ?? ""} ${r.unit || ""}`.trim(),
            notat: r.note || ""
          }));

        const html = buildJournalHTML({
          title: "Gjødseljournal",
          farm: d.farm || {},
          subtitleLines: ["Gjødslingsjournal"],
          columns: [
            { key: "date", label: "Dato", width: "14%" },
            { key: "skifte", label: "Skifte", width: "22%" },
            { key: "type", label: "Type", width: "16%" },
            { key: "produkt", label: "Produkt", width: "22%" },
            { key: "mengde", label: "Mengde", width: "14%" },
            { key: "notat", label: "Notat", width: "12%" }
          ],
          rows
        });

        openPrintPDF({ title: "Gjødseljournal", fileName: "gjodseljournal", html });
      });
    }
  });

  // Min gård (sjeldne endringer)
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
      }
    ],
    render(container, { data: d, setData }) {
      const farm = d.farm || {};
      const skifter = d.skifter || [];
      const s = sumSkifter(skifter);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:900; margin-bottom:10px; color:#e8f0f7;">Grunninfo</div>

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
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
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
                ${skifter
                  .map(
                    (sk) => `
                  <div style="border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:12px; background:rgba(0,0,0,.18);">
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
                `
                  )
                  .join("")}
              </div>
            `}
          </div>
        </div>
      `;

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

      document.getElementById("skifte_add")?.addEventListener("click", async () => {
        const sk = await askSkifteFields({});
        if (!sk) return;
        const next = clone(d);
        next.skifter.push(sk);
        setData(next);
        toast("Skifte lagt til.");
      });

      container.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-edit");
          const idx = (d.skifter || []).findIndex((x) => x.id === id);
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
          const sk = (d.skifter || []).find((x) => x.id === id);
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
          next.skifter = next.skifter.filter((x) => x.id !== id);
          setData(next);
          toast("Skifte slettet.");
        });
      });
    }
  });

  // Sprøytejournal
  router.registerView("sprøyting", {
    title: "Sprøyting",
    subtitle: "Sprøytejournal / plantevernjournal",
    actions: () => [
      {
        label: "Ny sprøyting",
        primary: true,
        onClick: async ({ data: d, setData }) => {
          const entry = await askSprøytingEntry(d, {});
          if (!entry) return;
          const next = clone(d);
          next.plantProtectionLog.push(entry);
          setData(next);
          toast("Lagret i sprøytejournal.");
        }
      }
    ],
    render(container, { data: d, setData }) {
      const rows = (d.plantProtectionLog || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:900;">Sprøytejournal</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">Registrer dato, skifte, middel, dose.</div>
            </div>
            <button id="pp_add" class="btn primary">Ny</button>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="pp_pdf" class="btn" style="justify-content:center;">Eksporter PDF</button>

            ${rows.length === 0 ? `<div class="notice">Ingen registreringer ennå.</div>` : `
              <div style="display:grid; gap:10px;">
                ${rows.map(r => `
                  <div style="border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:12px; background:rgba(0,0,0,.18);">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:900;">${escapeHtml(fmtDate(r.date))} • ${escapeHtml(skifteNameById(d, r.skifteId))}</div>
                        <div class="muted" style="font-size:12px; margin-top:4px;">
                          ${escapeHtml(r.product || "")} • ${escapeHtml(String(r.dose ?? ""))} ${escapeHtml(r.unit || "")}
                          ${r.purpose ? ` • ${escapeHtml(r.purpose)}` : ""}
                        </div>
                        ${r.note ? `<div class="muted" style="font-size:12px; margin-top:6px;">${escapeHtml(r.note)}</div>` : ""}
                      </div>
                      <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn" data-pp-edit="${escapeHtml(r.id)}">Rediger</button>
                        <button class="btn danger" data-pp-del="${escapeHtml(r.id)}">Slett</button>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>
      `;

      document.getElementById("pp_add")?.addEventListener("click", async () => {
        const entry = await askSprøytingEntry(d, {});
        if (!entry) return;
        const next = clone(d);
        next.plantProtectionLog.push(entry);
        setData(next);
        toast("Lagret i sprøytejournal.");
      });

      document.getElementById("pp_pdf")?.addEventListener("click", () => {
        const pdfRows = rows.map((r) => ({
          date: fmtDate(r.date),
          skifte: skifteNameById(d, r.skifteId),
          middel: r.product || "",
          dose: `${r.dose ?? ""} ${r.unit || ""}`.trim(),
          formål: r.purpose || "",
          notat: r.note || ""
        }));

        const html = buildJournalHTML({
          title: "Sprøytejournal",
          farm: d.farm || {},
          subtitleLines: ["Plantevernjournal"],
          columns: [
            { key: "date", label: "Dato", width: "14%" },
            { key: "skifte", label: "Skifte", width: "22%" },
            { key: "middel", label: "Middel", width: "22%" },
            { key: "dose", label: "Dose", width: "14%" },
            { key: "formål", label: "Formål", width: "14%" },
            { key: "notat", label: "Notat", width: "14%" }
          ],
          rows: pdfRows
        });

        openPrintPDF({ title: "Sprøytejournal", fileName: "sproytejournal", html });
      });

      container.querySelectorAll("[data-pp-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-pp-edit");
          const idx = (d.plantProtectionLog || []).findIndex((x) => x.id === id);
          if (idx < 0) return;

          const updated = await askSprøytingEntry(d, d.plantProtectionLog[idx]);
          if (!updated) return;

          const next = clone(d);
          next.plantProtectionLog[idx] = updated;
          setData(next);
          toast("Oppdatert.");
        });
      });

      container.querySelectorAll("[data-pp-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-pp-del");
          const r = (d.plantProtectionLog || []).find((x) => x.id === id);
          if (!r) return;

          const ok = await confirmDialog({
            title: "Slett registrering?",
            subtitle: `${fmtDate(r.date)} • ${skifteNameById(d, r.skifteId)}`,
            okText: "Slett",
            cancelText: "Avbryt",
            danger: true
          });
          if (!ok) return;

          const next = clone(d);
          next.plantProtectionLog = next.plantProtectionLog.filter((x) => x.id !== id);
          setData(next);
          toast("Slettet.");
        });
      });
    }
  });

  // Gjødseljournal
  router.registerView("gjødsel", {
    title: "Gjødsel",
    subtitle: "Gjødseljournal",
    actions: () => [
      {
        label: "Ny gjødsling",
        primary: true,
        onClick: async ({ data: d, setData }) => {
          const entry = await askGjødselEntry(d, {});
          if (!entry) return;
          const next = clone(d);
          next.fertilizerLog.push(entry);
          setData(next);
          toast("Lagret i gjødseljournal.");
        }
      }
    ],
    render(container, { data: d, setData }) {
      const rows = (d.fertilizerLog || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:900;">Gjødseljournal</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">Registrer dato, skifte, type, mengde.</div>
            </div>
            <button id="f_add" class="btn primary">Ny</button>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="f_pdf" class="btn" style="justify-content:center;">Eksporter PDF</button>

            ${rows.length === 0 ? `<div class="notice">Ingen registreringer ennå.</div>` : `
              <div style="display:grid; gap:10px;">
                ${rows.map(r => `
                  <div style="border:1px solid rgba(255,255,255,.12); border-radius:14px; padding:12px; background:rgba(0,0,0,.18);">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:900;">${escapeHtml(fmtDate(r.date))} • ${escapeHtml(skifteNameById(d, r.skifteId))}</div>
                        <div class="muted" style="font-size:12px; margin-top:4px;">
                          ${escapeHtml(r.type || "")} • ${escapeHtml(r.product || "")} • ${escapeHtml(String(r.amount ?? ""))} ${escapeHtml(r.unit || "")}
                        </div>
                        ${r.note ? `<div class="muted" style="font-size:12px; margin-top:6px;">${escapeHtml(r.note)}</div>` : ""}
                      </div>
                      <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        <button class="btn" data-f-edit="${escapeHtml(r.id)}">Rediger</button>
                        <button class="btn danger" data-f-del="${escapeHtml(r.id)}">Slett</button>
                      </div>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>
      `;

      document.getElementById("f_add")?.addEventListener("click", async () => {
        const entry = await askGjødselEntry(d, {});
        if (!entry) return;
        const next = clone(d);
        next.fertilizerLog.push(entry);
        setData(next);
        toast("Lagret i gjødseljournal.");
      });

      document.getElementById("f_pdf")?.addEventListener("click", () => {
        const pdfRows = rows.map((r) => ({
          date: fmtDate(r.date),
          skifte: skifteNameById(d, r.skifteId),
          type: r.type || "",
          produkt: r.product || "",
          mengde: `${r.amount ?? ""} ${r.unit || ""}`.trim(),
          notat: r.note || ""
        }));

        const html = buildJournalHTML({
          title: "Gjødseljournal",
          farm: d.farm || {},
          subtitleLines: ["Gjødslingsjournal"],
          columns: [
            { key: "date", label: "Dato", width: "14%" },
            { key: "skifte", label: "Skifte", width: "22%" },
            { key: "type", label: "Type", width: "16%" },
            { key: "produkt", label: "Produkt", width: "22%" },
            { key: "mengde", label: "Mengde", width: "14%" },
            { key: "notat", label: "Notat", width: "12%" }
          ],
          rows: pdfRows
        });

        openPrintPDF({ title: "Gjødseljournal", fileName: "gjodseljournal", html });
      });

      container.querySelectorAll("[data-f-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-f-edit");
          const idx = (d.fertilizerLog || []).findIndex((x) => x.id === id);
          if (idx < 0) return;

          const updated = await askGjødselEntry(d, d.fertilizerLog[idx]);
          if (!updated) return;

          const next = clone(d);
          next.fertilizerLog[idx] = updated;
          setData(next);
          toast("Oppdatert.");
        });
      });

      container.querySelectorAll("[data-f-del]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-f-del");
          const r = (d.fertilizerLog || []).find((x) => x.id === id);
          if (!r) return;

          const ok = await confirmDialog({
            title: "Slett registrering?",
            subtitle: `${fmtDate(r.date)} • ${skifteNameById(d, r.skifteId)}`,
            okText: "Slett",
            cancelText: "Avbryt",
            danger: true
          });
          if (!ok) return;

          const next = clone(d);
          next.fertilizerLog = next.fertilizerLog.filter((x) => x.id !== id);
          setData(next);
          toast("Slettet.");
        });
      });
    }
  });

  // Husdyr
  router.registerView("husdyr", {
    title: "Husdyr",
    subtitle: "Grunnmur: registrer antall per kategori",
    actions: () => [],
    render(container, { data: d, setData }) {
      ensureHusdyrRows(d);

      const rows = (d.husdyr || []).slice().sort((a, b) => {
        const A = `${a.species}-${a.category}`.toLowerCase();
        const B = `${b.species}-${b.category}`.toLowerCase();
        return A.localeCompare(B, "nb");
      });

      const sums = husdyrSum(d);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Oppsummering</div>
          <div class="muted" style="font-size:12px;">
            ${Object.keys(sums).length ? Object.entries(sums).map(([k,v]) => `${escapeHtml(k)}: <b>${v}</b>`).join(" • ") : "Ingen registreringer"}
          </div>
          <div class="muted" style="margin-top:8px; font-size:12px;">
            Dette er grunnmuren. Neste steg blir regler (f.eks. hindring av ulovlige scenario) og beregninger.
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Antall</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">Trykk på en rad for å endre antall.</div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${rows.map(r => `
              <button class="btn" data-h-edit="${escapeHtml(r.id)}" style="justify-content:space-between;">
                <span><b>${escapeHtml(r.species)}</b> • ${escapeHtml(r.category)}</span>
                <span style="font-weight:900;">${escapeHtml(String(r.count ?? 0))}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Husdyr (PDF)</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">Utskrift av oversikt.</div>
          </div>
          <div style="padding:14px;">
            <button id="husdyr_pdf" class="btn primary" style="width:100%; justify-content:center;">Eksporter PDF</button>
          </div>
        </div>
      `;

      container.querySelectorAll("[data-h-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-h-edit");
          const idx = (d.husdyr || []).findIndex((x) => x.id === id);
          if (idx < 0) return;

          const row = d.husdyr[idx];
          const newCount = await editHusdyrCount(row);
          if (newCount === null) return;

          const next = clone(d);
          next.husdyr[idx].count = newCount;
          setData(next);
          toast("Lagret.");
        });
      });

      document.getElementById("husdyr_pdf")?.addEventListener("click", () => {
        const pdfRows = rows.map((r) => ({
          art: r.species || "",
          kategori: r.category || "",
          antall: String(r.count ?? 0),
          notat: r.note || ""
        }));

        const html = buildJournalHTML({
          title: "Husdyr – oversikt",
          farm: d.farm || {},
          subtitleLines: ["Grunnregistrering"],
          columns: [
            { key: "art", label: "Dyreslag", width: "30%" },
            { key: "kategori", label: "Kategori", width: "40%" },
            { key: "antall", label: "Antall", width: "15%", align: "right" },
            { key: "notat", label: "Notat", width: "15%" }
          ],
          rows: pdfRows
        });

        openPrintPDF({ title: "Husdyr – oversikt", fileName: "husdyr", html });
      });
    }
  });

  // ---- init ----
  router.init("dashboard");
  pill.textContent = "Klar";
}

// =========================
// Data shape
// =========================
function ensureDataShape(d) {
  d = d || {};
  d.farm = d.farm || { name: "", kommune: "", areal: 0 };
  d.skifter = Array.isArray(d.skifter) ? d.skifter : [];

  // Nye moduler
  d.plantProtectionLog = Array.isArray(d.plantProtectionLog) ? d.plantProtectionLog : [];
  d.fertilizerLog = Array.isArray(d.fertilizerLog) ? d.fertilizerLog : [];
  d.husdyr = Array.isArray(d.husdyr) ? d.husdyr : [];

  return d;
}

// =========================
// UI styling helpers
// =========================
function ensureSolidButtons() {
  const id = "farmapp_solid_buttons_v5";
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .btn{
      background: rgba(255,255,255,.12) !important;
      border: 1px solid rgba(255,255,255,.18) !important;
    }
    .btn:hover{ background: rgba(255,255,255,.16) !important; }
    .btn.primary{
      background:#0f2a1f !important;
      border-color: rgba(24,196,108,.65) !important;
    }
    .btn.danger{
      background:#3a1a1a !important;
      border-color: rgba(255,92,92,.65) !important;
    }
  `;
  document.head.appendChild(st);
}

function ensureFallbackInputsStyle() {
  const id = "min_gard_input_style_v5";
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .ui-input-fallback{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:#0f1720;
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

function ensureSelectDialogStyles() {
  const id = "farmapp_select_dialog_styles_v5";
  if (document.getElementById(id)) return;
  const st = document.createElement("style");
  st.id = id;
  st.textContent = `
    .ui-select{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid rgba(255,255,255,.16);
      background:#0f1720;
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

// Dropdown-dialog (nedtrekk) – matcher ui.js sine klasser
function selectDialog({ title = "Velg", subtitle = "", label = "", value = "", options = [], okText = "OK", cancelText = "Avbryt" }) {
  return new Promise((resolve) => {
    const select = el("select", { class: "ui-select" }, []);
    for (const opt of options) {
      const o = el("option", { value: opt.value }, opt.label);
      if (String(opt.value) === String(value)) o.selected = true;
      select.appendChild(o);
    }

    const bodyNode = el("div", {}, [
      el("div", { class: "ui-field" }, [label ? el("div", { class: "ui-label" }, label) : null, select]),
      el("div", { class: "ui-small" }, "Tips: ESC eller trykk utenfor for å avbryte.")
    ]);

    const backdrop = el("div", { class: "ui-backdrop" });
    const modal = el("div", { class: "ui-modal", role: "dialog", "aria-modal": "true" });
    const head = el("div", { class: "ui-modal-head" }, [
      el("div", { class: "ui-modal-title" }, title),
      subtitle ? el("div", { class: "ui-modal-sub" }, subtitle) : null
    ]);
    const body = el("div", { class: "ui-modal-body" }, bodyNode);
    const acts = el("div", { class: "ui-actions" }, [
      el("button", { class: "ui-btn", onclick: () => { cleanup(); resolve(null); } }, cancelText),
      el("button", { class: "ui-btn primary", onclick: () => { const v = String(select.value); cleanup(); resolve(v); } }, okText)
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
