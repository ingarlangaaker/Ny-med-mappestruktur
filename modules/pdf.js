// modules/pdf.js
// Profesjonell rapportgenerator for "Print til PDF" (A4)
// Ingen eksterne biblioteker. Fungerer i nettleser (inkl. mobil/Chrome).

export function openPrintReport({ title, html, fileName = "rapport" }) {
  const w = window.open("", "_blank");
  if (!w) throw new Error("Popup blokkert. Tillat popups for å eksportere rapport.");

  const doc = w.document;
  doc.open();
  doc.write(`<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(title || "Rapport")}</title>
<style>
  /* ---- PRINT BASE ---- */
  @page {
    size: A4;
    margin: 14mm 12mm 14mm 12mm;
  }
  html, body { height:100%; }
  body{
    margin:0;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
    color:#111;
    background:#fff;
  }

  /* Skjermvisning av sider */
  .sheet{
    width: 210mm;
    margin: 10mm auto;
    background:#fff;
    box-shadow: 0 10px 30px rgba(0,0,0,.15);
    border: 1px solid rgba(0,0,0,.08);
  }

  /* Print: ingen skygge, full bredde */
  @media print{
    .sheet{ box-shadow:none; border:none; margin:0; width:auto; }
    .no-print{ display:none !important; }
  }

  /* Header / footer */
  .r-head{
    display:flex;
    gap:10mm;
    align-items:flex-start;
    justify-content:space-between;
    border-bottom: 1px solid rgba(0,0,0,.12);
    padding: 10mm 12mm 6mm 12mm;
  }
  .r-title{
    font-size: 16pt;
    font-weight: 800;
    margin:0 0 2mm 0;
    line-height:1.1;
  }
  .r-sub{
    font-size: 10pt;
    color:#333;
    margin:0;
    line-height:1.35;
  }
  .r-meta{
    text-align:right;
    font-size: 9pt;
    color:#333;
    line-height:1.35;
    white-space:nowrap;
  }

  .r-body{
    padding: 6mm 12mm 10mm 12mm;
  }

  .r-foot{
    border-top: 1px solid rgba(0,0,0,.12);
    padding: 4mm 12mm 8mm 12mm;
    font-size: 9pt;
    color:#333;
    display:flex;
    justify-content:space-between;
    gap:8mm;
  }
  .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

  /* Table */
  table{
    width:100%;
    border-collapse:collapse;
    font-size: 10pt;
  }
  thead th{
    text-align:left;
    font-weight:800;
    border-bottom: 1px solid rgba(0,0,0,.25);
    padding: 2.5mm 2mm;
    vertical-align:bottom;
  }
  tbody td{
    border-bottom: 1px solid rgba(0,0,0,.10);
    padding: 2.5mm 2mm;
    vertical-align:top;
  }
  .num{ text-align:right; white-space:nowrap; }
  .muted{ color:#444; }
  .small{ font-size: 9pt; }
  .section-title{
    margin: 0 0 3mm 0;
    font-size: 11pt;
    font-weight: 800;
  }

  /* Page break helpers */
  .break-before{ page-break-before: always; break-before: page; }
  .avoid-break{ page-break-inside: avoid; break-inside: avoid; }

  /* Print button */
  .toolbar{
    position: sticky;
    top: 0;
    z-index: 10;
    background: #fff;
    border-bottom: 1px solid rgba(0,0,0,.08);
    padding: 10px 12px;
    display:flex;
    gap:10px;
    align-items:center;
    justify-content:space-between;
  }
  .btn{
    border:1px solid rgba(0,0,0,.18);
    background:#f3f5f7;
    padding:10px 12px;
    border-radius:12px;
    cursor:pointer;
    font-weight:700;
  }
  .btn.primary{
    background:#e7fff2;
    border-color:#47c77d;
  }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <div class="small muted">
      Tips: Velg <b>Skriv ut</b> → <b>Lagre som PDF</b>.
    </div>
    <div style="display:flex; gap:10px;">
      <button class="btn" onclick="window.close()">Lukk</button>
      <button class="btn primary" onclick="window.print()">Skriv ut / PDF</button>
    </div>
  </div>

  ${html}

<script>
  // Sett dokumenttittel for filnavn-hint i noen nettlesere
  document.title = ${JSON.stringify((fileName || "rapport").replace(/[^a-z0-9_-]+/gi, "_"))};
</script>
</body>
</html>`);
  doc.close();
  w.focus();
}

export function buildSkifteReportHTML({ data, farmName = "", kommune = "" }) {
  const now = new Date();
  const generated = formatDateTime(now);

  const skifter = Array.isArray(data?.skifter) ? data.skifter : [];
  const sums = sumSkifter(skifter);

  // Sort: navn asc
  const rows = [...skifter].sort((a,b) => (a?.navn || "").localeCompare(b?.navn || "", "nb"));

  const table = `
    <table>
      <thead>
        <tr>
          <th style="width:40%;">Skifte</th>
          <th style="width:22%;">Type</th>
          <th class="num" style="width:18%;">Areal (daa)</th>
          <th style="width:20%;">Notat</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr class="avoid-break">
            <td><b>${escapeHtml(r?.navn || "")}</b></td>
            <td>${escapeHtml(typeLabel(r?.type))}</td>
            <td class="num">${fmt1(r?.areal)}</td>
            <td class="muted">${escapeHtml(r?.note || "")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  const summary = `
    <div class="avoid-break" style="margin-top:6mm;">
      <div class="section-title">Oppsummering</div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th class="num">Areal (daa)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Fulldyrket</td><td class="num">${fmt1(sums.fulldyrket)}</td></tr>
          <tr><td>Overflatedyrket</td><td class="num">${fmt1(sums.overflatedyrket)}</td></tr>
          <tr><td>Innmarksbeite</td><td class="num">${fmt1(sums.innmarksbeite)}</td></tr>
          <tr><td><b>Totalt</b></td><td class="num"><b>${fmt1(sums.total)}</b></td></tr>
        </tbody>
      </table>
    </div>
  `;

  const headerMeta = `
    <div class="r-meta">
      <div><b>Generert:</b> ${escapeHtml(generated)}</div>
      <div><b>Antall skifter:</b> ${rows.length}</div>
    </div>
  `;

  const headerLeft = `
    <div>
      <h1 class="r-title">Skifterapport</h1>
      <p class="r-sub">
        <b>${escapeHtml(farmName || data?.farm?.name || "Gård")}</b>
        ${kommune || data?.farm?.kommune ? ` • ${escapeHtml(kommune || data?.farm?.kommune || "")}` : ""}
      </p>
      <p class="r-sub small muted">Internt dokument – utskrift til PDF ved behov.</p>
    </div>
  `;

  const footer = `
    <div class="r-foot">
      <div class="muted">Farmapp</div>
      <div class="muted mono">${escapeHtml((farmName || data?.farm?.name || "").slice(0,40))}</div>
    </div>
  `;

  return `
    <div class="sheet">
      <div class="r-head">
        ${headerLeft}
        ${headerMeta}
      </div>
      <div class="r-body">
        <div class="section-title">Skifter</div>
        ${table}
        ${summary}
      </div>
      ${footer}
    </div>
  `;
}

// ---- helpers ----
function typeLabel(t) {
  if (t === "fulldyrket") return "Fulldyrket";
  if (t === "overflatedyrket") return "Overflatedyrket";
  if (t === "innmarksbeite") return "Innmarksbeite";
  return "Ukjent";
}
function sumSkifter(skifter) {
  const out = { total:0, fulldyrket:0, overflatedyrket:0, innmarksbeite:0 };
  for (const s of skifter || []) {
    const a = Number(s?.areal || 0);
    out.total += a;
    if (s?.type === "fulldyrket") out.fulldyrket += a;
    else if (s?.type === "overflatedyrket") out.overflatedyrket += a;
    else if (s?.type === "innmarksbeite") out.innmarksbeite += a;
  }
  return out;
}
function fmt1(n) {
  const x = Number(n || 0);
  const r = Math.round(x * 10) / 10;
  // bruk komma i norsk visning
  return String(r).replace(".", ",");
}
function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2,"0");
  return `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}
