// modules/app.js
// Farmapp core
// - Produksjoner (Innstillinger): Husdyr / Grovfôr / Frukt og grønt + underproduksjoner
// - Meny filtreres basert på aktive produksjoner (gjemmer irrelevant info)
// - Husdyr er paraply, Sau er egen paraplyside hvor alt sau skal samles videre
// - Eksisterende: Skifter, Sprøyting, Gjødsel, PDF-eksport (proff) beholdes

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
    rebuildNav();          // <-- viktig: meny filtreres basert på produksjoner
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

  // =========================
  // Helpers / utils
  // =========================
  function pad2(n) { return String(n).padStart(2, "0"); }

  function nowStamp() {
    const d = new Date();
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function fmtDate(iso) {
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

  function newId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
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

  function isISODate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()); }

  function inPeriod(dateISO, fromISO, toISO) {
    const d = String(dateISO || "").trim();
    if (!isISODate(d)) return true;
    if (fromISO && isISODate(fromISO) && d < fromISO) return false;
    if (toISO && isISODate(toISO) && d > toISO) return false;
    return true;
  }

  async function askPeriodDialog(title) {
    const from = await promptDialog({
      title,
      subtitle: "Periodefilter (valgfritt)",
      label: "Fra (YYYY-MM-DD) – tomt = alt",
      value: "",
      placeholder: "2026-01-01",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (from === null) return null;

    const to = await promptDialog({
      title,
      subtitle: "Periodefilter (valgfritt)",
      label: "Til (YYYY-MM-DD) – tomt = alt",
      value: "",
      placeholder: "2026-12-31",
      okText: "OK",
      cancelText: "Avbryt"
    });
    if (to === null) return null;

    const f = String(from || "").trim();
    const t = String(to || "").trim();

    if (f && !isISODate(f)) { toast("Fra må være YYYY-MM-DD eller tom."); return null; }
    if (t && !isISODate(t)) { toast("Til må være YYYY-MM-DD eller tom."); return null; }
    if (f && t && f > t) { toast("Fra kan ikke være etter Til."); return null; }
    return { from: f || "", to: t || "" };
  }

  function periodLabel(fromISO, toISO) {
    if (fromISO && toISO) return `Periode: ${fmtDate(fromISO)} – ${fmtDate(toISO)}`;
    if (fromISO) return `Fra: ${fmtDate(fromISO)}`;
    if (toISO) return `Til: ${fmtDate(toISO)}`;
    return "Periode: Alle registreringer";
  }

  async function openPrintPDF({ title, fileName, html }) {
    try {
      const pdf = await import("./pdf.js");
      pdf.openPrintReport({ title, fileName, html });
    } catch (e) {
      console.error(e);
      toast("PDF-modul mangler eller popups er blokkert. Sjekk modules/pdf.js og popup-innstillinger.");
    }
  }

  // =========================
  // PROFF PDF: ekte sider + sidetall
  // =========================
  function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  function buildPagedReportHTML({ title, farm, metaLines = [], columns = [], rows = [], rowsPerPage = 20 }) {
    const pages = chunk(rows, rowsPerPage);
    const totalPages = Math.max(1, pages.length);
    const generated = nowStamp();

    const css = `
      <style>
        @media print {
          html, body { margin:0; padding:0; }
          .page { page-break-after: always; }
          .page:last-child { page-break-after: auto; }
        }
        body{
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
          color:#111;
          background:#fff;
        }
        .page{
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 14mm 12mm 14mm 12mm;
        }
        .hdr{
          display:flex;
          justify-content:space-between;
          gap:10mm;
          border-bottom: 1px solid rgba(0,0,0,.12);
          padding-bottom: 6mm;
          margin-bottom: 6mm;
        }
        .hdr h1{
          font-size: 16pt;
          margin:0 0 1mm 0;
          font-weight: 900;
          line-height: 1.1;
        }
        .hdr .sub{
          font-size: 10pt;
          color:#333;
          line-height:1.35;
        }
        .meta{
          margin-top:2mm;
          font-size: 9pt;
          color:#444;
          line-height:1.35;
        }
        table{
          width:100%;
          border-collapse: collapse;
          font-size: 10pt;
        }
        thead th{
          text-align:left;
          border-bottom: 1px solid rgba(0,0,0,.20);
          padding: 2.2mm 2mm;
          font-weight: 800;
          color:#111;
        }
        tbody td{
          border-bottom: 1px solid rgba(0,0,0,.10);
          padding: 2mm 2mm;
          vertical-align: top;
        }
        .num{ text-align:right; white-space:nowrap; }
        .ftr{
          margin-top: 8mm;
          border-top: 1px solid rgba(0,0,0,.12);
          padding-top: 3mm;
          font-size: 9pt;
          color:#333;
          display:flex;
          justify-content: space-between;
          gap:10mm;
        }
        .mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .muted{ color:#555; }
      </style>
    `;

    const metaHTML = metaLines.length
      ? `<div class="meta">${metaLines.map((x) => escapeHtml(x)).join(" • ")}</div>`
      : "";

    const pagesHTML = pages.length
      ? pages
          .map((pageRows, idx) => {
            const pageNo = idx + 1;

            const thead = `
              <thead>
                <tr>
                  ${columns
                    .map(
                      (c) =>
                        `<th style="${c.width ? `width:${c.width};` : ""}${c.align === "right" ? "text-align:right;" : ""}">${escapeHtml(c.label)}</th>`
                    )
                    .join("")}
                </tr>
              </thead>
            `;

            const tbody = `
              <tbody>
                ${pageRows
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

            return `
              <div class="page">
                <div class="hdr">
                  <div>
                    <h1>${escapeHtml(title)}</h1>
                    <div class="sub">
                      <b>${escapeHtml(farm?.name || "Gård")}</b>${farm?.kommune ? ` • ${escapeHtml(farm.kommune)}` : ""}
                    </div>
                    ${metaHTML}
                  </div>
                  <div class="sub" style="text-align:right; white-space:nowrap;">
                    <div><b>Generert:</b> ${escapeHtml(generated)}</div>
                    <div><b>Antall:</b> ${rows.length}</div>
                  </div>
                </div>

                <table>
                  ${thead}
                  ${tbody}
                </table>

                <div class="ftr">
                  <div class="muted">Farmapp</div>
                  <div class="mono muted">Side ${pageNo} av ${totalPages}</div>
                </div>
              </div>
            `;
          })
          .join("")
      : `
        <div class="page">
          <div class="hdr">
            <div>
              <h1>${escapeHtml(title)}</h1>
              <div class="sub">
                <b>${escapeHtml(farm?.name || "Gård")}</b>${farm?.kommune ? ` • ${escapeHtml(farm.kommune)}` : ""}
              </div>
              ${metaHTML}
            </div>
            <div class="sub" style="text-align:right; white-space:nowrap;">
              <div><b>Generert:</b> ${escapeHtml(generated)}</div>
              <div><b>Antall:</b> 0</div>
            </div>
          </div>
          <div class="muted">Ingen registreringer i valgt periode.</div>
          <div class="ftr">
            <div class="muted">Farmapp</div>
            <div class="mono muted">Side 1 av 1</div>
          </div>
        </div>
      `;

    return `${css}${pagesHTML}`;
  }

  // =========================
  // PRODUKSJONER
  // =========================
  const PROD = () => data.productions;

  function activeSummary(p) {
    const out = [];

    if (p.husdyr.enabled) {
      const a = [];
      if (p.husdyr.sau) a.push("Sau");
      if (p.husdyr.geit) a.push("Geit");
      if (p.husdyr.melkeku) a.push("Melkeku");
      if (p.husdyr.ammeku) a.push("Ammeku/kjøttfe");
      if (p.husdyr.ungdyrStorfe) a.push("Ungdyr storfe");
      if (p.husdyr.purke) a.push("Purke/smågris");
      if (p.husdyr.slaktegris) a.push("Slaktegris");
      if (p.husdyr.egg) a.push("Egg");
      if (p.husdyr.slaktekylling) a.push("Slaktekylling");
      if (p.husdyr.kalkun) a.push("Kalkun");
      if (p.husdyr.hest) a.push("Hest");
      out.push(`Husdyr: ${a.length ? a.join(", ") : "aktiv (ingen valgt under)"}`);
    }

    if (p.grovfor.enabled) {
      const a = [];
      if (p.grovfor.eng) a.push("Eng/slått");
      if (p.grovfor.beite) a.push("Beite");
      if (p.grovfor.forplan) a.push("Fôrplan");
      if (p.grovfor.lager) a.push("Grovfôrlager");
      out.push(`Grovfôr: ${a.length ? a.join(", ") : "aktiv"}`);
    }

    if (p.fruktGront.enabled) {
      const a = [];
      if (p.fruktGront.rabarbra) a.push("Rabarbra");
      if (p.fruktGront.potet) a.push("Potet");
      if (p.fruktGront.rot) a.push("Rotgrønnsaker");
      if (p.fruktGront.kal) a.push("Kålvekster");
      if (p.fruktGront.bladLok) a.push("Løk/bladgrønt");
      if (p.fruktGront.fruktBaer) a.push("Frukt/bær");
      out.push(`Frukt og grønt: ${a.length ? a.join(", ") : "aktiv"}`);
    }

    if (!out.length) return "Ingen produksjoner aktivert ennå.";
    return out.join(" • ");
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
    if (!skOpts.length) { toast("Du må legge inn minst ett skifte først (Innstillinger → Skifter)."); return null; }

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
    if (!Number.isFinite(dose) || dose < 0) { toast("Ugyldig dose."); return null; }

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
    if (!skOpts.length) { toast("Du må legge inn minst ett skifte først (Innstillinger → Skifter)."); return null; }

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
    if (!Number.isFinite(amount) || amount < 0) { toast("Ugyldig mengde."); return null; }

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
  // PDF Exporters
  // =========================
  async function exportSprøytePDF(d) {
    const period = await askPeriodDialog("Sprøytejournal (PDF)");
    if (!period) return;
    const fromISO = period.from;
    const toISO = period.to;

    const filtered = (d.plantProtectionLog || [])
      .filter((r) => inPeriod(r.date, fromISO, toISO))
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

    const html = buildPagedReportHTML({
      title: "Sprøytejournal",
      farm: d.farm || {},
      metaLines: [periodLabel(fromISO, toISO), "Plantevernjournal"],
      columns: [
        { key: "date", label: "Dato", width: "14%" },
        { key: "skifte", label: "Skifte", width: "22%" },
        { key: "middel", label: "Middel", width: "22%" },
        { key: "dose", label: "Dose", width: "14%" },
        { key: "formål", label: "Formål", width: "14%" },
        { key: "notat", label: "Notat", width: "14%" }
      ],
      rows: filtered,
      rowsPerPage: 20
    });

    openPrintPDF({ title: "Sprøytejournal", fileName: "sproytejournal", html });
  }

  async function exportGjødselPDF(d) {
    const period = await askPeriodDialog("Gjødseljournal (PDF)");
    if (!period) return;
    const fromISO = period.from;
    const toISO = period.to;

    const filtered = (d.fertilizerLog || [])
      .filter((r) => inPeriod(r.date, fromISO, toISO))
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

    const html = buildPagedReportHTML({
      title: "Gjødseljournal",
      farm: d.farm || {},
      metaLines: [periodLabel(fromISO, toISO), "Gjødslingsjournal"],
      columns: [
        { key: "date", label: "Dato", width: "14%" },
        { key: "skifte", label: "Skifte", width: "22%" },
        { key: "type", label: "Type", width: "16%" },
        { key: "produkt", label: "Produkt", width: "22%" },
        { key: "mengde", label: "Mengde", width: "14%" },
        { key: "notat", label: "Notat", width: "12%" }
      ],
      rows: filtered,
      rowsPerPage: 20
    });

    openPrintPDF({ title: "Gjødseljournal", fileName: "gjodseljournal", html });
  }

  // =========================
  // Husdyr data (grunnmur, beholdt)
  // =========================
  function ensureHusdyrRows(d) {
    if (!Array.isArray(d.husdyr)) d.husdyr = [];
    if (d.husdyr.length) return;

    // Start med standard rader (kan utvides senere)
    d.husdyr = [
      { id: newId("h"), group: "Sau", category: "Søye", count: 0, note: "" },
      { id: newId("h"), group: "Sau", category: "Vær", count: 0, note: "" },
      { id: newId("h"), group: "Sau", category: "Lam", count: 0, note: "" },
      { id: newId("h"), group: "Geit", category: "Geit", count: 0, note: "" },
      { id: newId("h"), group: "Geit", category: "Bukk", count: 0, note: "" },
      { id: newId("h"), group: "Geit", category: "Kje", count: 0, note: "" }
    ];
  }

  async function editCountDialog(title, subtitle, value) {
    const txt = await promptDialog({
      title,
      subtitle,
      label: "Antall",
      value: String(value ?? 0),
      placeholder: "0",
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (txt === null) return null;
    const n = Math.floor(toNumber(txt));
    if (!Number.isFinite(n) || n < 0) { toast("Ugyldig antall. Bruk heltall 0 eller høyere."); return null; }
    return n;
  }

  // =========================
  // NAV (filter basert på produksjoner)
  // =========================
  function navButton(label, route, indent = 0) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.width = "100%";
    if (indent) b.style.paddingLeft = `${12 + indent}px`;
    b.addEventListener("click", () => { window.location.hash = route; });
    return b;
  }

  function navDivider(label) {
    const d = document.createElement("div");
    d.textContent = label;
    d.style.margin = "14px 0 6px 0";
    d.style.fontWeight = "900";
    d.style.fontSize = "12px";
    d.style.color = "rgba(233,255,245,.85)";
    return d;
  }

  function rebuildNav() {
    navEl.innerHTML = "";

    // Alltid
    navEl.appendChild(navButton("Oversikt", "dashboard"));

    // Innstillinger (NYTT) — Min gård fjernes fra hovedmeny
    navEl.appendChild(navDivider("Innstillinger"));
    navEl.appendChild(navButton("Innstillinger", "settings"));

    navEl.appendChild(navDivider("Skiftearbeid"));
    navEl.appendChild(navButton("Sprøyting", "sprøyting"));
    navEl.appendChild(navButton("Gjødsel", "gjødsel"));

    const p = data.productions;

    if (p.husdyr.enabled) {
      navEl.appendChild(navDivider("Husdyr"));
      navEl.appendChild(navButton("Husdyr", "husdyrHub"));
      if (p.husdyr.sau) navEl.appendChild(navButton("Sau", "sau", 10));
      if (p.husdyr.geit) navEl.appendChild(navButton("Geit", "geit", 10));
      if (p.husdyr.melkeku || p.husdyr.ammeku || p.husdyr.ungdyrStorfe) navEl.appendChild(navButton("Storfe", "storfe", 10));
      if (p.husdyr.purke || p.husdyr.slaktegris) navEl.appendChild(navButton("Gris", "gris", 10));
      if (p.husdyr.egg || p.husdyr.slaktekylling || p.husdyr.kalkun) navEl.appendChild(navButton("Fjørfe", "fjorfe", 10));
      if (p.husdyr.hest) navEl.appendChild(navButton("Hest", "hest", 10));
    }

    if (p.grovfor.enabled) {
      navEl.appendChild(navDivider("Grovfôr"));
      navEl.appendChild(navButton("Grovfôr", "grovforHub"));
      if (p.grovfor.eng) navEl.appendChild(navButton("Eng og slått", "grovforEng", 10));
      if (p.grovfor.beite) navEl.appendChild(navButton("Beite", "grovforBeite", 10));
      if (p.grovfor.forplan) navEl.appendChild(navButton("Fôrplan", "grovforForplan", 10));
      if (p.grovfor.lager) navEl.appendChild(navButton("Grovfôrlager", "grovforLager", 10));
    }

    if (p.fruktGront.enabled) {
      navEl.appendChild(navDivider("Frukt og grønt"));
      navEl.appendChild(navButton("Frukt og grønt", "fgHub"));
      if (p.fruktGront.rabarbra) navEl.appendChild(navButton("Rabarbra", "rabarbra", 10));
      if (p.fruktGront.potet) navEl.appendChild(navButton("Potet", "potet", 10));
      if (p.fruktGront.fruktBaer) navEl.appendChild(navButton("Frukt og bær", "fruktBaer", 10));
      if (p.fruktGront.rot) navEl.appendChild(navButton("Rotgrønnsaker", "rotgront", 10));
      if (p.fruktGront.kal) navEl.appendChild(navButton("Kålvekster", "kalvekster", 10));
      if (p.fruktGront.bladLok) navEl.appendChild(navButton("Løk/bladgrønt", "bladlok", 10));
    }
  }

  // =========================
  // SETTINGS HUB (NYTT)
  // =========================
  router.registerView("settings", {
    title: "Innstillinger",
    subtitle: "Sjeldne endringer (gjemt bort)",
    actions: () => [],
    render(container, { data: d }) {
      const prodText = activeSummary(d.productions);

      container.innerHTML = `
        <div class="notice">
          <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Innstillinger</div>
          <div class="muted" style="font-size:12px; line-height:1.4;">
            Her ligger ting du sjelden endrer: gårdsinfo, produksjoner, skifter og backup.
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Valg</div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="go_farm" class="btn primary" style="justify-content:space-between;">
              <span><b>Gårdsinfo</b></span><span class="muted" style="font-size:12px;">Åpne</span>
            </button>

            <button id="go_prod" class="btn primary" style="justify-content:space-between;">
              <span><b>Produksjoner</b></span><span class="muted" style="font-size:12px;">Åpne</span>
            </button>
            <div class="muted" style="font-size:12px; margin-top:-6px;">${escapeHtml(prodText)}</div>

            <button id="go_fields" class="btn primary" style="justify-content:space-between;">
              <span><b>Skifter</b></span><span class="muted" style="font-size:12px;">Åpne</span>
            </button>

            <button id="go_backup" class="btn" style="justify-content:space-between;">
              <span><b>Backup / Import</b></span><span class="muted" style="font-size:12px;">Åpne</span>
            </button>
          </div>
        </div>
      `;

      document.getElementById("go_farm")?.addEventListener("click", () => { window.location.hash = "settingsFarm"; });
      document.getElementById("go_prod")?.addEventListener("click", () => { window.location.hash = "settingsProductions"; });
      document.getElementById("go_fields")?.addEventListener("click", () => { window.location.hash = "settingsFields"; });
      document.getElementById("go_backup")?.addEventListener("click", () => { window.location.hash = "settingsBackup"; });
    }
  });

  router.registerView("settingsFarm", {
    title: "Gårdsinfo",
    subtitle: "Gårdsnavn, kommune, areal",
    actions: () => [],
    render(container, { data: d, setData }) {
      const farm = d.farm || {};

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
      `;

      document.getElementById("farm_save")?.addEventListener("click", async () => {
        const name = (document.getElementById("farm_name")?.value ?? "").trim();
        const kommune = (document.getElementById("farm_kommune")?.value ?? "").trim();
        const arealRaw = String(document.getElementById("farm_areal")?.value ?? "0").trim().replace(",", ".");
        const areal = Number(arealRaw);

        if (!Number.isFinite(areal) || areal < 0) { toast("Ugyldig areal."); return; }

        const next = clone(d);
        next.farm.name = name;
        next.farm.kommune = kommune;
        next.farm.areal = areal;
        setData(next);
        toast("Gårdsinfo lagret.");
      });
    }
  });

  router.registerView("settingsProductions", {
    title: "Produksjoner",
    subtitle: "Huk av hva som skal være aktivt",
    actions: () => [],
    render(container, { data: d, setData }) {
      const p = d.productions;

      function prodCheckbox(id, label, checked) {
        return `
          <label style="display:flex; gap:10px; align-items:center; cursor:pointer;">
            <input id="${escapeHtml(id)}" type="checkbox" ${checked ? "checked" : ""} />
            ${escapeHtml(label)}
          </label>
        `;
      }

      container.innerHTML = `
        <div class="notice">
          <div class="muted" style="font-size:12px; line-height:1.4;">
            Dette styrer hva som vises i menyen. Bare aktivert innhold vises.
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:900;">Produksjoner</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">Huk av og trykk Lagre.</div>
            </div>
            <button id="prod_save" class="btn primary">Lagre</button>
          </div>

          <div style="padding:14px; display:grid; gap:14px;">
            <div class="notice">
              <div class="muted" style="font-size:12px; line-height:1.4;">${escapeHtml(activeSummary(p))}</div>
            </div>

            <div class="card" style="background:rgba(0,0,0,.12); border:1px solid rgba(255,255,255,.10);">
              <div style="padding:12px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">
                <label style="display:flex; gap:10px; align-items:center; cursor:pointer;">
                  <input id="p_husdyr" type="checkbox" ${p.husdyr.enabled ? "checked" : ""} />
                  Husdyr
                </label>
              </div>
              <div style="padding:12px; display:grid; gap:8px;">
                ${prodCheckbox("p_sau", "Sau", p.husdyr.sau)}
                ${prodCheckbox("p_geit", "Geit", p.husdyr.geit)}
                <div class="muted" style="font-size:12px; margin-top:6px;">Storfe</div>
                ${prodCheckbox("p_melkeku", "Melkeku", p.husdyr.melkeku)}
                ${prodCheckbox("p_ammeku", "Ammeku / kjøttfe", p.husdyr.ammeku)}
                ${prodCheckbox("p_ungdyr", "Ungdyr / framfôring storfe", p.husdyr.ungdyrStorfe)}
                <div class="muted" style="font-size:12px; margin-top:6px;">Gris</div>
                ${prodCheckbox("p_purke", "Purke / smågris", p.husdyr.purke)}
                ${prodCheckbox("p_slaktegris", "Slaktegris", p.husdyr.slaktegris)}
                <div class="muted" style="font-size:12px; margin-top:6px;">Fjørfe</div>
                ${prodCheckbox("p_egg", "Egg (verpehøns)", p.husdyr.egg)}
                ${prodCheckbox("p_slaktekylling", "Slaktekylling", p.husdyr.slaktekylling)}
                ${prodCheckbox("p_kalkun", "Kalkun", p.husdyr.kalkun)}
                <div class="muted" style="font-size:12px; margin-top:6px;">Andre</div>
                ${prodCheckbox("p_hest", "Hest", p.husdyr.hest)}
              </div>
            </div>

            <div class="card" style="background:rgba(0,0,0,.12); border:1px solid rgba(255,255,255,.10);">
              <div style="padding:12px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">
                <label style="display:flex; gap:10px; align-items:center; cursor:pointer;">
                  <input id="p_grovfor" type="checkbox" ${p.grovfor.enabled ? "checked" : ""} />
                  Grovfôr
                </label>
              </div>
              <div style="padding:12px; display:grid; gap:8px;">
                ${prodCheckbox("p_eng", "Eng og slått (høy/rundball/silo)", p.grovfor.eng)}
                ${prodCheckbox("p_beite", "Beite (innmarksbeite/utmark)", p.grovfor.beite)}
                ${prodCheckbox("p_forplan", "Fôrplan / fôrbehov", p.grovfor.forplan)}
                ${prodCheckbox("p_lager", "Grovfôrlager", p.grovfor.lager)}
              </div>
            </div>

            <div class="card" style="background:rgba(0,0,0,.12); border:1px solid rgba(255,255,255,.10);">
              <div style="padding:12px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">
                <label style="display:flex; gap:10px; align-items:center; cursor:pointer;">
                  <input id="p_fg" type="checkbox" ${p.fruktGront.enabled ? "checked" : ""} />
                  Frukt og grønt
                </label>
              </div>
              <div style="padding:12px; display:grid; gap:8px;">
                ${prodCheckbox("p_rabarbra", "Rabarbra", p.fruktGront.rabarbra)}
                ${prodCheckbox("p_potet", "Potet", p.fruktGront.potet)}
                ${prodCheckbox("p_fruktbaer", "Frukt og bær", p.fruktGront.fruktBaer)}
                ${prodCheckbox("p_rot", "Rotgrønnsaker", p.fruktGront.rot)}
                ${prodCheckbox("p_kal", "Kålvekster", p.fruktGront.kal)}
                ${prodCheckbox("p_bladlok", "Løk / bladgrønt", p.fruktGront.bladLok)}
              </div>
            </div>
          </div>
        </div>
      `;

      function getChecked(id) { return !!document.getElementById(id)?.checked; }

      document.getElementById("prod_save")?.addEventListener("click", async () => {
        const next = clone(d);

        // hoved
        next.productions.husdyr.enabled = getChecked("p_husdyr");
        next.productions.grovfor.enabled = getChecked("p_grovfor");
        next.productions.fruktGront.enabled = getChecked("p_fg");

        // husdyr
        next.productions.husdyr.sau = getChecked("p_sau");
        next.productions.husdyr.geit = getChecked("p_geit");
        next.productions.husdyr.melkeku = getChecked("p_melkeku");
        next.productions.husdyr.ammeku = getChecked("p_ammeku");
        next.productions.husdyr.ungdyrStorfe = getChecked("p_ungdyr");
        next.productions.husdyr.purke = getChecked("p_purke");
        next.productions.husdyr.slaktegris = getChecked("p_slaktegris");
        next.productions.husdyr.egg = getChecked("p_egg");
        next.productions.husdyr.slaktekylling = getChecked("p_slaktekylling");
        next.productions.husdyr.kalkun = getChecked("p_kalkun");
        next.productions.husdyr.hest = getChecked("p_hest");

        // grovfôr
        next.productions.grovfor.eng = getChecked("p_eng");
        next.productions.grovfor.beite = getChecked("p_beite");
        next.productions.grovfor.forplan = getChecked("p_forplan");
        next.productions.grovfor.lager = getChecked("p_lager");

        // frukt/grønt
        next.productions.fruktGront.rabarbra = getChecked("p_rabarbra");
        next.productions.fruktGront.potet = getChecked("p_potet");
        next.productions.fruktGront.fruktBaer = getChecked("p_fruktbaer");
        next.productions.fruktGront.rot = getChecked("p_rot");
        next.productions.fruktGront.kal = getChecked("p_kal");
        next.productions.fruktGront.bladLok = getChecked("p_bladlok");

        // sikkerhet: hvis hoved av => under av (ren meny)
        if (!next.productions.husdyr.enabled) next.productions.husdyr = { ...next.productions.husdyr, sau:false, geit:false, melkeku:false, ammeku:false, ungdyrStorfe:false, purke:false, slaktegris:false, egg:false, slaktekylling:false, kalkun:false, hest:false, enabled:false };
        if (!next.productions.grovfor.enabled) next.productions.grovfor = { ...next.productions.grovfor, eng:false, beite:false, forplan:false, lager:false, enabled:false };
        if (!next.productions.fruktGront.enabled) next.productions.fruktGront = { ...next.productions.fruktGront, rabarbra:false, potet:false, fruktBaer:false, rot:false, kal:false, bladLok:false, enabled:false };

        setData(next);
        toast("Produksjoner lagret. Menyen er oppdatert.");
      });
    }
  });

  router.registerView("settingsFields", {
    title: "Skifter",
    subtitle: "Vedlikehold skifter (sjeldne endringer)",
    actions: () => [],
    render(container, { data: d, setData }) {
      const skifter = d.skifter || [];
      const s = sumSkifter(skifter);

      container.innerHTML = `
        <div class="notice">
          Totalt: <b>${round1(s.total)}</b> daa • Fulldyrket: ${round1(s.fulldyrket)} • Overflatedyrket: ${round1(s.overflatedyrket)} • Innmarksbeite: ${round1(s.innmarksbeite)}
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div>
              <div style="font-weight:900;">Skifter</div>
              <div class="muted" style="font-size:12px; margin-top:4px;">Legg til, rediger eller slett.</div>
            </div>
            <button id="skifte_add" class="btn primary">Legg til</button>
          </div>

          <div style="padding:14px;">
            ${skifter.length === 0 ? `
              <div class="notice">Ingen skifter ennå. Trykk <b>Legg til</b>.</div>
            ` : `
              <div style="display:grid; gap:10px;">
                ${skifter.map((sk) => `
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
                `).join("")}
              </div>
            `}
          </div>
        </div>
      `;

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

  router.registerView("settingsBackup", {
    title: "Backup / Import",
    subtitle: "Eksportér eller importer data",
    actions: () => [],
    render(container, { setData }) {
      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Backup</div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="exp" class="btn primary">Eksporter (JSON)</button>
            <button id="imp" class="btn">Importer (JSON)</button>
            <button id="wipe" class="btn danger">Nullstill alt</button>
          </div>
        </div>
      `;

      document.getElementById("exp")?.addEventListener("click", async () => {
        const txt = exportData();
        await showCodeDialog({
          title: "Eksport (JSON)",
          subtitle: "Kopier og lagre denne teksten. Du kan importere den tilbake senere.",
          code: txt,
          copyText: "Kopier",
          okText: "Lukk"
        });
      });

      document.getElementById("imp")?.addEventListener("click", async () => {
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
      });

      document.getElementById("wipe")?.addEventListener("click", async () => {
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
      });
    }
  });

  // Backwards compat: hvis gammel lenke/route finnes
  router.registerView("minGård", {
    title: "Min gård",
    subtitle: "Flyttet til Innstillinger",
    actions: () => [],
    render(container) {
      container.innerHTML = `
        <div class="notice">
          <b>Min gård</b> er flyttet.
          <div class="muted" style="font-size:12px; margin-top:6px;">
            Gå til <b>Innstillinger</b> for gårdsinfo, produksjoner og skifter.
          </div>
          <div style="margin-top:10px;">
            <button id="go" class="btn primary" style="width:100%; justify-content:center;">Åpne Innstillinger</button>
          </div>
        </div>
      `;
      document.getElementById("go")?.addEventListener("click", () => { window.location.hash = "settings"; });
    }
  });

  // =========================
  // Views
  // =========================
  router.registerView("dashboard", {
    title: "Oversikt",
    subtitle: (d) => (d?.farm?.name ? `Gård: ${d.farm.name}` : "Sett opp gårdsnavn under «Innstillinger»"),
    actions: () => [],
    render(container, { data: d }) {
      ensureHusdyrRows(d);

      const farm = d.farm || {};
      const s = sumSkifter(d.skifter);
      const prodText = activeSummary(d.productions);

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
          </div>

          <div style="margin-top:12px; padding-top:10px; border-top:1px solid rgba(255,255,255,.10);">
            <div style="font-weight:900; margin-bottom:6px; color:#e8f0f7;">Produksjoner</div>
            <div class="muted" style="font-size:12px; line-height:1.4;">${escapeHtml(prodText)}</div>
            <div style="margin-top:10px;">
              <button id="go_settings" class="btn" style="width:100%; justify-content:center;">Åpne Innstillinger</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Rapporter (proff PDF)</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">
              Velg periode → åpner utskrift → <b>Skriv ut</b> → <b>Lagre som PDF</b>.
            </div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button id="pdf_sproyte" class="btn primary" style="width:100%; justify-content:center;">Sprøytejournal (PDF)</button>
            <button id="pdf_gjodsel" class="btn primary" style="width:100%; justify-content:center;">Gjødseljournal (PDF)</button>
          </div>
        </div>
      `;

      document.getElementById("pdf_sproyte")?.addEventListener("click", () => exportSprøytePDF(d));
      document.getElementById("pdf_gjodsel")?.addEventListener("click", () => exportGjødselPDF(d));
      document.getElementById("go_settings")?.addEventListener("click", () => { window.location.hash = "settings"; });
    }
  });

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
          const next = JSON.parse(JSON.stringify(d));
          next.plantProtectionLog.push(entry);
          setData(next);
          toast("Lagret i sprøytejournal.");
        }
      },
      {
        label: "Eksporter PDF",
        onClick: async ({ data: d }) => exportSprøytePDF(d)
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
            <button id="pp_pdf" class="btn" style="justify-content:center;">Eksporter PDF (periodefilter)</button>
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
        const next = JSON.parse(JSON.stringify(d));
        next.plantProtectionLog.push(entry);
        setData(next);
        toast("Lagret i sprøytejournal.");
      });

      document.getElementById("pp_pdf")?.addEventListener("click", () => exportSprøytePDF(d));

      container.querySelectorAll("[data-pp-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-pp-edit");
          const idx = (d.plantProtectionLog || []).findIndex((x) => x.id === id);
          if (idx < 0) return;

          const updated = await askSprøytingEntry(d, d.plantProtectionLog[idx]);
          if (!updated) return;

          const next = JSON.parse(JSON.stringify(d));
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

          const next = JSON.parse(JSON.stringify(d));
          next.plantProtectionLog = next.plantProtectionLog.filter((x) => x.id !== id);
          setData(next);
          toast("Slettet.");
        });
      });
    }
  });

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
          const next = JSON.parse(JSON.stringify(d));
          next.fertilizerLog.push(entry);
          setData(next);
          toast("Lagret i gjødseljournal.");
        }
      },
      {
        label: "Eksporter PDF",
        onClick: async ({ data: d }) => exportGjødselPDF(d)
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
            <button id="f_pdf" class="btn" style="justify-content:center;">Eksporter PDF (periodefilter)</button>
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
        const next = JSON.parse(JSON.stringify(d));
        next.fertilizerLog.push(entry);
        setData(next);
        toast("Lagret i gjødseljournal.");
      });

      document.getElementById("f_pdf")?.addEventListener("click", () => exportGjødselPDF(d));

      container.querySelectorAll("[data-f-edit]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-f-edit");
          const idx = (d.fertilizerLog || []).findIndex((x) => x.id === id);
          if (idx < 0) return;

          const updated = await askGjødselEntry(d, d.fertilizerLog[idx]);
          if (!updated) return;

          const next = JSON.parse(JSON.stringify(d));
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

          const next = JSON.parse(JSON.stringify(d));
          next.fertilizerLog = next.fertilizerLog.filter((x) => x.id !== id);
          setData(next);
          toast("Slettet.");
        });
      });
    }
  });

  // =========================
  // Husdyr HUB + Sau (paraply)
  // =========================
  router.registerView("husdyrHub", {
    title: "Husdyr",
    subtitle: "Paraply: alt husdyr samles her",
    actions: () => [],
    render(container, { data: d }) {
      const p = d.productions.husdyr;
      if (!d.productions.husdyr.enabled) {
        container.innerHTML = `<div class="notice">Husdyr er ikke aktivert. Gå til <b>Innstillinger → Produksjoner</b>.</div>`;
        return;
      }

      const cards = [];
      if (p.sau) cards.push({ title: "Sau", route: "sau", desc: "Alt om sau (besetning, grupper, lamming, hold, rapporter)." });
      if (p.geit) cards.push({ title: "Geit", route: "geit", desc: "Geit (kommer mer)." });
      if (p.melkeku || p.ammeku || p.ungdyrStorfe) cards.push({ title: "Storfe", route: "storfe", desc: "Storfe (kommer mer)." });
      if (p.purke || p.slaktegris) cards.push({ title: "Gris", route: "gris", desc: "Gris (kommer mer)." });
      if (p.egg || p.slaktekylling || p.kalkun) cards.push({ title: "Fjørfe", route: "fjorfe", desc: "Fjørfe (kommer mer)." });
      if (p.hest) cards.push({ title: "Hest", route: "hest", desc: "Hest (kommer mer)." });

      container.innerHTML = `
        <div class="notice">
          Velg produksjon. Bare det som er aktivert vises.
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Produksjoner</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">Klikk for å åpne.</div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${cards.length ? cards.map(c => `
              <button class="btn primary" data-go="${escapeHtml(c.route)}" style="justify-content:space-between;">
                <span><b>${escapeHtml(c.title)}</b></span>
                <span class="muted" style="font-size:12px;">Åpne</span>
              </button>
              <div class="muted" style="font-size:12px; margin-top:-6px;">${escapeHtml(c.desc)}</div>
            `).join("") : `<div class="notice">Ingen underproduksjoner valgt under Husdyr.</div>`}
          </div>
        </div>
      `;

      container.querySelectorAll("[data-go]").forEach(btn => {
        btn.addEventListener("click", () => { window.location.hash = btn.getAttribute("data-go"); });
      });
    }
  });

  router.registerView("sau", {
    title: "Sau",
    subtitle: "Hovedparaply: alt som angår sau skal ligge her",
    actions: () => [],
    render(container, { data: d, setData }) {
      if (!d.productions.husdyr.enabled || !d.productions.husdyr.sau) {
        container.innerHTML = `<div class="notice">Sau er ikke aktivert. Gå til <b>Innstillinger → Produksjoner</b>.</div>`;
        return;
      }

      ensureHusdyrRows(d);

      const sauRows = (d.husdyr || []).filter(r => r.group === "Sau");

      container.innerHTML = `
        <div class="notice">
          Dette er <b>Sau-paraplyen</b>. Her bygger vi videre: grupper, lamming, hold/fôring, helse, tilskudd, rapporter.
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Besetning (grunnmur)</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">Trykk for å endre antall.</div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${sauRows.map(r => `
              <button class="btn" data-edit="${escapeHtml(r.id)}" style="justify-content:space-between;">
                <span>${escapeHtml(r.category)}</span>
                <span style="font-weight:900;">${escapeHtml(String(r.count ?? 0))}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08);">
            <div style="font-weight:900;">Neste steg (kommer)</div>
            <div class="muted" style="font-size:12px; margin-top:6px;">
              Grupper (NKS/villsau), lamming, holdscore, fôrbehov, regelvarsler og tilskudd.
            </div>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button class="btn" disabled style="opacity:.7; justify-content:center;">Grupper (kommer)</button>
            <button class="btn" disabled style="opacity:.7; justify-content:center;">Lamming (kommer)</button>
            <button class="btn" disabled style="opacity:.7; justify-content:center;">Hold/Fôr (kommer)</button>
          </div>
        </div>
      `;

      container.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-edit");
          const idx = (d.husdyr || []).findIndex(x => x.id === id);
          if (idx < 0) return;

          const row = d.husdyr[idx];
          const n = await editCountDialog("Sau", row.category, row.count);
          if (n === null) return;

          const next = clone(d);
          next.husdyr[idx].count = n;
          setData(next);
          toast("Lagret.");
        });
      });
    }
  });

  // placeholders (aktivert via meny)
  router.registerView("geit", { title:"Geit", subtitle:"Paraply (kommer mer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Geit-modul kommer. Nå styres synlighet av Produksjoner.</div>`; }});
  router.registerView("storfe", { title:"Storfe", subtitle:"Paraply (kommer mer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Storfe-modul kommer.</div>`; }});
  router.registerView("gris", { title:"Gris", subtitle:"Paraply (kommer mer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Gris-modul kommer.</div>`; }});
  router.registerView("fjorfe", { title:"Fjørfe", subtitle:"Paraply (kommer mer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Fjørfe-modul kommer.</div>`; }});
  router.registerView("hest", { title:"Hest", subtitle:"Paraply (kommer mer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Hest-modul kommer.</div>`; }});

  // =========================
  // Grovfôr HUB + placeholders
  // =========================
  router.registerView("grovforHub", {
    title: "Grovfôr",
    subtitle: "Paraply: eng/slått, beite, fôrplan, lager",
    actions: () => [],
    render(container, { data: d }) {
      if (!d.productions.grovfor.enabled) {
        container.innerHTML = `<div class="notice">Grovfôr er ikke aktivert. Gå til <b>Innstillinger → Produksjoner</b>.</div>`;
        return;
      }
      const p = d.productions.grovfor;
      const items = [];
      if (p.eng) items.push({ t:"Eng og slått", r:"grovforEng" });
      if (p.beite) items.push({ t:"Beite", r:"grovforBeite" });
      if (p.forplan) items.push({ t:"Fôrplan", r:"grovforForplan" });
      if (p.lager) items.push({ t:"Grovfôrlager", r:"grovforLager" });

      container.innerHTML = `
        <div class="notice">Velg funksjon.</div>
        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Grovfôr</div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${items.length ? items.map(x=>`
              <button class="btn primary" data-go="${escapeHtml(x.r)}" style="justify-content:space-between;">
                <span><b>${escapeHtml(x.t)}</b></span><span class="muted" style="font-size:12px;">Åpne</span>
              </button>
            `).join("") : `<div class="notice">Ingen underpunkter valgt.</div>`}
          </div>
        </div>
      `;
      container.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{ window.location.hash=b.getAttribute("data-go"); }));
    }
  });

  router.registerView("grovforEng", { title:"Eng og slått", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Eng/slått kommer. Her blir plan/utført, partier, kvalitet, datoer.</div>`; }});
  router.registerView("grovforBeite", { title:"Beite", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Beite kommer. Kobling mot skifter + beiteperioder.</div>`; }});
  router.registerView("grovforForplan", { title:"Fôrplan", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Fôrplan/fôrbehov kommer.</div>`; }});
  router.registerView("grovforLager", { title:"Grovfôrlager", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Grovfôrlager kommer (ballelager, parti, analyse).</div>`; }});

  // =========================
  // Frukt & grønt HUB + placeholders
  // =========================
  router.registerView("fgHub", {
    title: "Frukt og grønt",
    subtitle: "Paraply: rabarbra, potet, frukt/bær, osv.",
    actions: () => [],
    render(container, { data: d }) {
      if (!d.productions.fruktGront.enabled) {
        container.innerHTML = `<div class="notice">Frukt og grønt er ikke aktivert. Gå til <b>Innstillinger → Produksjoner</b>.</div>`;
        return;
      }
      const p = d.productions.fruktGront;
      const items = [];
      if (p.rabarbra) items.push({ t:"Rabarbra", r:"rabarbra" });
      if (p.potet) items.push({ t:"Potet", r:"potet" });
      if (p.fruktBaer) items.push({ t:"Frukt og bær", r:"fruktBaer" });
      if (p.rot) items.push({ t:"Rotgrønnsaker", r:"rotgront" });
      if (p.kal) items.push({ t:"Kålvekster", r:"kalvekster" });
      if (p.bladLok) items.push({ t:"Løk/bladgrønt", r:"bladlok" });

      container.innerHTML = `
        <div class="notice">Velg kultur. Bare aktivert innhold vises.</div>
        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Frukt og grønt</div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${items.length ? items.map(x=>`
              <button class="btn primary" data-go="${escapeHtml(x.r)}" style="justify-content:space-between;">
                <span><b>${escapeHtml(x.t)}</b></span><span class="muted" style="font-size:12px;">Åpne</span>
              </button>
            `).join("") : `<div class="notice">Ingen underpunkter valgt.</div>`}
          </div>
        </div>
      `;
      container.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>{ window.location.hash=b.getAttribute("data-go"); }));
    }
  });

  router.registerView("rabarbra", { title:"Rabarbra", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Rabarbra-modul kommer. Dette blir en nøkkelmodul for Karmøy Safteri (plan/utført/avling).</div>`; }});
  router.registerView("potet", { title:"Potet", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Potet-modul kommer.</div>`; }});
  router.registerView("fruktBaer", { title:"Frukt og bær", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Frukt/bær-modul kommer.</div>`; }});
  router.registerView("rotgront", { title:"Rotgrønnsaker", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Rotgrønnsaker-modul kommer.</div>`; }});
  router.registerView("kalvekster", { title:"Kålvekster", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Kålvekster-modul kommer.</div>`; }});
  router.registerView("bladlok", { title:"Løk/bladgrønt", subtitle:"(kommer)", actions:()=>[], render(c){ c.innerHTML = `<div class="notice">Løk/bladgrønt-modul kommer.</div>`; }});

  // ---- init ----
  rebuildNav();
  router.init("dashboard");
  pill.textContent = "Klar";
}

// =========================
// Data shape (inkl. produksjoner)
// =========================
function ensureDataShape(d) {
  d = d || {};
  d.farm = d.farm || { name: "", kommune: "", areal: 0 };
  d.skifter = Array.isArray(d.skifter) ? d.skifter : [];
  d.plantProtectionLog = Array.isArray(d.plantProtectionLog) ? d.plantProtectionLog : [];
  d.fertilizerLog = Array.isArray(d.fertilizerLog) ? d.fertilizerLog : [];
  d.husdyr = Array.isArray(d.husdyr) ? d.husdyr : [];

  // Produksjoner
  if (!d.productions) d.productions = {};
  if (!d.productions.husdyr) d.productions.husdyr = {};
  if (!d.productions.grovfor) d.productions.grovfor = {};
  if (!d.productions.fruktGront) d.productions.fruktGront = {};

  d.productions.husdyr = {
    enabled: !!d.productions.husdyr.enabled,
    sau: !!d.productions.husdyr.sau,
    geit: !!d.productions.husdyr.geit,
    melkeku: !!d.productions.husdyr.melkeku,
    ammeku: !!d.productions.husdyr.ammeku,
    ungdyrStorfe: !!d.productions.husdyr.ungdyrStorfe,
    purke: !!d.productions.husdyr.purke,
    slaktegris: !!d.productions.husdyr.slaktegris,
    egg: !!d.productions.husdyr.egg,
    slaktekylling: !!d.productions.husdyr.slaktekylling,
    kalkun: !!d.productions.husdyr.kalkun,
    hest: !!d.productions.husdyr.hest
  };

  d.productions.grovfor = {
    enabled: !!d.productions.grovfor.enabled,
    eng: !!d.productions.grovfor.eng,
    beite: !!d.productions.grovfor.beite,
    forplan: !!d.productions.grovfor.forplan,
    lager: !!d.productions.grovfor.lager
  };

  d.productions.fruktGront = {
    enabled: !!d.productions.fruktGront.enabled,
    rabarbra: !!d.productions.fruktGront.rabarbra,
    potet: !!d.productions.fruktGront.potet,
    fruktBaer: !!d.productions.fruktGront.fruktBaer,
    rot: !!d.productions.fruktGront.rot,
    kal: !!d.productions.fruktGront.kal,
    bladLok: !!d.productions.fruktGront.bladLok
  };

  return d;
}

// =========================
// UI styling helpers
// =========================
function ensureSolidButtons() {
  const id = "farmapp_solid_buttons_prod_v1";
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
  const id = "min_gard_input_style_prod_v1";
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
  const id = "farmapp_select_dialog_styles_prod_v1";
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

// Dropdown-dialog (nedtrekk)
function selectDialog({ title="Velg", subtitle="", label="", value="", options=[], okText="OK", cancelText="Avbryt" }) {
  return new Promise((resolve) => {
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
      if (e.key === "Escape") { e.preventDefault(); cleanup(); resolve(null); }
    }
    function cleanup() {
      window.removeEventListener("keydown", onKey, true);
      backdrop.remove();
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) { cleanup(); resolve(null); }
    });

    window.addEventListener("keydown", onKey, true);
    document.body.appendChild(backdrop);
    setTimeout(() => select.focus(), 0);
  });
}
