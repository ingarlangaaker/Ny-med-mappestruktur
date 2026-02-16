// modules/app.js
// Stabil meny + Innstillinger + Produksjoner (avhuking) + filtrert hovedmeny
// Viktig: INGEN MutationObserver (den kunne låse appen).
// Meny håndheves via: init + hashchange + setData()

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

  pill.textContent = "Laster…";

  // --------------------
  // Data
  // --------------------
  let data = ensureDataShape(loadData());

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function persist() {
    const ok = saveData(data);
    pill.textContent = ok ? "Klar" : "Kunne ikke lagre";
    return ok;
  }

  // --------------------
  // Router
  // --------------------
  const router = createRouter({ navEl, titleEl, subEl, actionsEl, viewEl });

  function ctx() {
    return {
      data,
      setData,
      rerender: () => router.rerender(),
      toast
    };
  }

  function setData(next) {
    data = ensureDataShape(next);
    persist();
    router.setCtx(ctx());
    enforceNav(); // viktig: oppdater meny
    router.rerender();
  }

  router.setCtx(ctx());

  // --------------------
  // Utils
  // --------------------
  function pad2(n) { return String(n).padStart(2, "0"); }

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

  // --------------------
  // Meny (STABIL)
  // --------------------
  function navDivider(label) {
    const d = document.createElement("div");
    d.textContent = label;
    d.style.margin = "14px 0 6px 0";
    d.style.fontWeight = "900";
    d.style.fontSize = "12px";
    d.style.color = "rgba(233,255,245,.85)";
    return d;
  }

  function navBtn(label, route, indent = 0) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn";
    b.textContent = label;
    b.style.width = "100%";
    b.style.justifyContent = "flex-start";
    if (indent) b.style.paddingLeft = `${12 + indent}px`;
    b.addEventListener("click", () => { window.location.hash = route; });
    return b;
  }

  function enforceNav() {
    // Vi tar kontroll på nav hver gang – men uten observer/loop.
    navEl.innerHTML = "";

    // Alltid synlig
    navEl.appendChild(navBtn("Oversikt", "dashboard"));
    navEl.appendChild(navBtn("Sprøyting", "spraying"));
    navEl.appendChild(navBtn("Gjødsel", "fertilizer"));

    navEl.appendChild(navDivider("Innstillinger"));
    navEl.appendChild(navBtn("Innstillinger", "settings"));

    // Filtrert etter produksjoner
    const p = data.productions;

    if (p.husdyr.enabled) {
      navEl.appendChild(navDivider("Husdyr"));
      navEl.appendChild(navBtn("Husdyr", "husdyr"));
      if (p.husdyr.sau) navEl.appendChild(navBtn("Sau", "sau", 10));
      if (p.husdyr.geit) navEl.appendChild(navBtn("Geit", "geit", 10));
    }

    if (p.grovfor.enabled) {
      navEl.appendChild(navDivider("Grovfôr"));
      navEl.appendChild(navBtn("Grovfôr", "grovfor"));
    }

    if (p.fruktGront.enabled) {
      navEl.appendChild(navDivider("Frukt og grønt"));
      navEl.appendChild(navBtn("Frukt og grønt", "fruktgront"));
      if (p.fruktGront.rabarbra) navEl.appendChild(navBtn("Rabarbra", "rabarbra", 10));
    }
  }

  // Kjør enforceNav ved sidebytte (router kan bygge ting, vi overskriver etterpå)
  window.addEventListener("hashchange", () => {
    // lite delay så vi vinner etter router
    setTimeout(enforceNav, 0);
  });

  // --------------------
  // Dialoger
  // --------------------
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

  async function askSprayingEntry(d, initial = {}) {
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
      subtitle: "Dose",
      label: "Dose (tall)",
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
      subtitle: "Enhet",
      label: "Enhet",
      value: initial.unit || "l/daa",
      options: [
        { value: "l/daa", label: "l/daa" },
        { value: "ml/daa", label: "ml/daa" },
        { value: "g/daa", label: "g/daa" },
        { value: "kg/daa", label: "kg/daa" }
      ],
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (unit === null) return null;

    return {
      id: initial.id || newId("pp"),
      date: String(dato).trim(),
      skifteId,
      product: String(middel).trim(),
      dose,
      unit
    };
  }

  async function askFertilizerEntry(d, initial = {}) {
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

    const produkt = await promptDialog({
      title: "Gjødsel",
      subtitle: "Produkt",
      label: "Produkt / type",
      value: initial.product || "",
      placeholder: "F.eks. 22-3-10",
      okText: "Neste",
      cancelText: "Avbryt"
    });
    if (produkt === null) return null;

    const mengdeTxt = await promptDialog({
      title: "Gjødsel",
      subtitle: "Mengde",
      label: "Mengde (tall)",
      value: initial.amount != null ? String(initial.amount) : "",
      placeholder: "F.eks. 25",
      okText: "Lagre",
      cancelText: "Avbryt"
    });
    if (mengdeTxt === null) return null;

    const amount = toNumber(mengdeTxt);
    if (!Number.isFinite(amount) || amount < 0) { toast("Ugyldig mengde."); return null; }

    return {
      id: initial.id || newId("f"),
      date: String(dato).trim(),
      skifteId,
      product: String(produkt).trim(),
      amount
    };
  }

  // --------------------
  // Views
  // --------------------
  router.registerView("dashboard", {
    title: "Oversikt",
    subtitle: (d) => (d?.farm?.name ? `Gård: ${d.farm.name}` : "Sett gårdsnavn i Innstillinger"),
    actions: () => [],
    render(container, { data: d }) {
      const farm = d.farm || {};
      const s = sumSkifter(d.skifter);

      container.innerHTML = `
        <div class="notice">
          <div><b>Gård:</b> ${escapeHtml(farm.name || "Ikke satt")}</div>
          <div><b>Kommune:</b> ${escapeHtml(farm.kommune || "Ikke satt")}</div>
          <div><b>Areal (dekar):</b> ${Number(farm.areal || 0)}</div>
          <div style="margin-top:10px;"><b>Skifter:</b> ${(d.skifter || []).length} • Totalt ${round1(s.total)} daa</div>
          <div style="margin-top:12px;">
            <button id="go_settings" class="btn primary" style="width:100%; justify-content:center;">Åpne Innstillinger</button>
          </div>
        </div>
      `;
      document.getElementById("go_settings")?.addEventListener("click", () => { window.location.hash = "settings"; });
    }
  });

  router.registerView("spraying", {
    title: "Sprøyting",
    subtitle: "Sprøytejournal",
    actions: () => [
      {
        label: "Ny sprøyting",
        primary: true,
        onClick: async ({ data: d, setData }) => {
          const e = await askSprayingEntry(d, {});
          if (!e) return;
          const next = clone(d);
          next.plantProtectionLog.push(e);
          setData(next);
          toast("Lagret.");
        }
      }
    ],
    render(container, { data: d, setData }) {
      const rows = (d.plantProtectionLog || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900;">Sprøyting</div>
            <button id="add" class="btn primary">Ny</button>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${rows.length ? rows.map(r => `
              <div class="notice">
                <div style="font-weight:900;">${escapeHtml(fmtDate(r.date))} • ${escapeHtml(skifteNameById(d, r.skifteId))}</div>
                <div class="muted" style="font-size:12px; margin-top:4px;">${escapeHtml(r.product || "")} • ${escapeHtml(String(r.dose ?? ""))} ${escapeHtml(r.unit || "")}</div>
              </div>
            `).join("") : `<div class="notice">Ingen registreringer ennå.</div>`}
          </div>
        </div>
      `;
      document.getElementById("add")?.addEventListener("click", async () => {
        const e = await askSprayingEntry(d, {});
        if (!e) return;
        const next = clone(d);
        next.plantProtectionLog.push(e);
        setData(next);
        toast("Lagret.");
      });
    }
  });

  router.registerView("fertilizer", {
    title: "Gjødsel",
    subtitle: "Gjødseljournal",
    actions: () => [
      {
        label: "Ny gjødsling",
        primary: true,
        onClick: async ({ data: d, setData }) => {
          const e = await askFertilizerEntry(d, {});
          if (!e) return;
          const next = clone(d);
          next.fertilizerLog.push(e);
          setData(next);
          toast("Lagret.");
        }
      }
    ],
    render(container, { data: d, setData }) {
      const rows = (d.fertilizerLog || [])
        .slice()
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900;">Gjødsel</div>
            <button id="add" class="btn primary">Ny</button>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${rows.length ? rows.map(r => `
              <div class="notice">
                <div style="font-weight:900;">${escapeHtml(fmtDate(r.date))} • ${escapeHtml(skifteNameById(d, r.skifteId))}</div>
                <div class="muted" style="font-size:12px; margin-top:4px;">${escapeHtml(r.product || "")} • ${escapeHtml(String(r.amount ?? ""))}</div>
              </div>
            `).join("") : `<div class="notice">Ingen registreringer ennå.</div>`}
          </div>
        </div>
      `;
      document.getElementById("add")?.addEventListener("click", async () => {
        const e = await askFertilizerEntry(d, {});
        if (!e) return;
        const next = clone(d);
        next.fertilizerLog.push(e);
        setData(next);
        toast("Lagret.");
      });
    }
  });

  // --------------------
  // Innstillinger (hoved)
  // --------------------
  router.registerView("settings", {
    title: "Innstillinger",
    subtitle: "Sjeldne endringer",
    actions: () => [],
    render(container) {
      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Innstillinger</div>
          <div style="padding:14px; display:grid; gap:10px;">
            <button class="btn primary" id="go_farm">Gårdsinfo</button>
            <button class="btn primary" id="go_fields">Skifter</button>
            <button class="btn primary" id="go_prod">Produksjoner</button>
            <button class="btn" id="go_backup">Backup / Import</button>
          </div>
        </div>
      `;
      document.getElementById("go_farm")?.addEventListener("click", () => (window.location.hash = "settingsFarm"));
      document.getElementById("go_fields")?.addEventListener("click", () => (window.location.hash = "settingsFields"));
      document.getElementById("go_prod")?.addEventListener("click", () => (window.location.hash = "settingsProductions"));
      document.getElementById("go_backup")?.addEventListener("click", () => (window.location.hash = "settingsBackup"));
    }
  });

  router.registerView("settingsFarm", {
    title: "Gårdsinfo",
    subtitle: "Navn, kommune, areal",
    actions: () => [],
    render(container, { data: d, setData }) {
      const farm = d.farm || {};
      container.innerHTML = `
        <div class="card">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); font-weight:900;">Gårdsinfo</div>
          <div style="padding:14px; display:grid; gap:10px;">
            <div>
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Gårdsnavn</div>
              <input id="name" class="ui-input-fallback" value="${escapeHtml(farm.name || "")}" />
            </div>
            <div>
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Kommune</div>
              <input id="kommune" class="ui-input-fallback" value="${escapeHtml(farm.kommune || "")}" />
            </div>
            <div>
              <div class="muted" style="font-size:12px; margin-bottom:6px;">Areal (dekar)</div>
              <input id="areal" class="ui-input-fallback" inputmode="decimal" value="${escapeHtml(String(farm.areal ?? 0))}" />
            </div>
            <button id="save" class="btn primary">Lagre</button>
          </div>
        </div>
      `;
      document.getElementById("save")?.addEventListener("click", () => {
        const name = (document.getElementById("name")?.value ?? "").trim();
        const kommune = (document.getElementById("kommune")?.value ?? "").trim();
        const areal = toNumber(document.getElementById("areal")?.value ?? "0");
        if (!Number.isFinite(areal) || areal < 0) return toast("Ugyldig areal.");

        const next = clone(d);
        next.farm.name = name;
        next.farm.kommune = kommune;
        next.farm.areal = areal;
        setData(next);
        toast("Lagret.");
      });
    }
  });

  router.registerView("settingsFields", {
    title: "Skifter",
    subtitle: "Vedlikehold skifter",
    actions: () => [],
    render(container, { data: d, setData }) {
      const skifter = d.skifter || [];
      const s = sumSkifter(skifter);

      container.innerHTML = `
        <div class="notice">
          Totalt: <b>${round1(s.total)}</b> daa • Fulldyrket ${round1(s.fulldyrket)} • Overflatedyrket ${round1(s.overflatedyrket)} • Innmarksbeite ${round1(s.innmarksbeite)}
        </div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900;">Skifter</div>
            <button id="add" class="btn primary">Legg til</button>
          </div>
          <div style="padding:14px; display:grid; gap:10px;">
            ${skifter.length ? skifter.map(sk => `
              <div class="notice">
                <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                  <div>
                    <div style="font-weight:900;">${escapeHtml(sk.navn || "Skifte")}</div>
                    <div class="muted" style="font-size:12px; margin-top:4px;">${escapeHtml(typeLabel(sk.type))} • ${round1(sk.areal)} daa</div>
                  </div>
                  <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn" data-edit="${escapeHtml(sk.id)}">Rediger</button>
                    <button class="btn danger" data-del="${escapeHtml(sk.id)}">Slett</button>
                  </div>
                </div>
              </div>
            `).join("") : `<div class="notice">Ingen skifter ennå.</div>`}
          </div>
        </div>
      `;

      document.getElementById("add")?.addEventListener("click", async () => {
        const sk = await askSkifteFields({});
        if (!sk) return;
        const next = clone(d);
        next.skifter.push(sk);
        setData(next);
        toast("Skifte lagt til.");
      });

      container.querySelectorAll("[data-edit]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-edit");
          const idx = (d.skifter || []).findIndex(x => x.id === id);
          if (idx < 0) return;
          const upd = await askSkifteFields(d.skifter[idx]);
          if (!upd) return;
          const next = clone(d);
          next.skifter[idx] = upd;
          setData(next);
          toast("Oppdatert.");
        });
      });

      container.querySelectorAll("[data-del]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const id = btn.getAttribute("data-del");
          const sk = (d.skifter || []).find(x => x.id === id);
          if (!sk) return;
          const ok = await confirmDialog({
            title: "Slett skifte?",
            subtitle: `${sk.navn || "Skifte"} blir slettet.`,
            okText: "Slett",
            cancelText: "Avbryt",
            danger: true
          });
          if (!ok) return;
          const next = clone(d);
          next.skifter = next.skifter.filter(x => x.id !== id);
          setData(next);
          toast("Slettet.");
        });
      });
    }
  });

  router.registerView("settingsProductions", {
    title: "Produksjoner",
    subtitle: "Huk av hva som skal være aktivt",
    actions: () => [],
    render(container, { data: d, setData }) {
      const p = d.productions;

      function row(id, label, checked) {
        return `
          <label style="display:flex; gap:10px; align-items:center; cursor:pointer;">
            <input id="${escapeHtml(id)}" type="checkbox" ${checked ? "checked" : ""}/>
            ${escapeHtml(label)}
          </label>
        `;
      }

      container.innerHTML = `
        <div class="notice">Dette styrer hva som vises i hovedmenyen.</div>

        <div class="card" style="margin-top:12px;">
          <div style="padding:14px; border-bottom:1px solid rgba(255,255,255,.08); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:900;">Produksjoner</div>
            <button id="save" class="btn primary">Lagre</button>
          </div>

          <div style="padding:14px; display:grid; gap:14px;">
            <div class="notice">
              <div style="font-weight:900; margin-bottom:8px;">Husdyr</div>
              ${row("husdyr_on", "Aktiver Husdyr", p.husdyr.enabled)}
              <div style="height:8px;"></div>
              ${row("sau_on", "Sau", p.husdyr.sau)}
              ${row("geit_on", "Geit", p.husdyr.geit)}
            </div>

            <div class="notice">
              <div style="font-weight:900; margin-bottom:8px;">Grovfôr</div>
              ${row("grov_on", "Aktiver Grovfôr", p.grovfor.enabled)}
            </div>

            <div class="notice">
              <div style="font-weight:900; margin-bottom:8px;">Frukt og grønt</div>
              ${row("fg_on", "Aktiver Frukt og grønt", p.fruktGront.enabled)}
              <div style="height:8px;"></div>
              ${row("rabarbra_on", "Rabarbra", p.fruktGront.rabarbra)}
            </div>
          </div>
        </div>
      `;

      function chk(id) { return !!document.getElementById(id)?.checked; }

      document.getElementById("save")?.addEventListener("click", () => {
        const next = clone(d);

        next.productions.husdyr.enabled = chk("husdyr_on");
        next.productions.husdyr.sau = chk("sau_on");
        next.productions.husdyr.geit = chk("geit_on");

        next.productions.grovfor.enabled = chk("grov_on");

        next.productions.fruktGront.enabled = chk("fg_on");
        next.productions.fruktGront.rabarbra = chk("rabarbra_on");

        // hvis hoved AV -> slå av under for ren meny
        if (!next.productions.husdyr.enabled) next.productions.husdyr = { enabled:false, sau:false, geit:false };
        if (!next.productions.fruktGront.enabled) next.productions.fruktGront = { enabled:false, rabarbra:false };

        setData(next);
        toast("Lagret. Meny oppdatert.");
      });
    }
  });

  router.registerView("settingsBackup", {
    title: "Backup / Import",
    subtitle: "Kopier data som tekst",
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
          subtitle: "Kopier og lagre denne teksten.",
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
        if (!ok) return toast("Import feilet.");
        setData(loadData());
        toast("Import ok.");
      });

      document.getElementById("wipe")?.addEventListener("click", async () => {
        const ok = await confirmDialog({
          title: "Nullstill alt?",
          subtitle: "Dette sletter alle data på denne enheten.",
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

  // Produksjonssider (stub for nå)
  router.registerView("husdyr", { title:"Husdyr", subtitle:"Paraply", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.husdyr.enabled) return c.innerHTML = `<div class="notice">Aktiver i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Husdyr-paraply. Sau skal bli hovedparaply for alt som angår sau.</div>`;
  }});

  router.registerView("sau", { title:"Sau", subtitle:"Paraply", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.husdyr.enabled || !d.productions.husdyr.sau) return c.innerHTML = `<div class="notice">Aktiver Sau i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Sau-paraply (neste steg: grupper, lamming, hold/fôr, helse, tilskudd, rapporter).</div>`;
  }});

  router.registerView("geit", { title:"Geit", subtitle:"Paraply", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.husdyr.enabled || !d.productions.husdyr.geit) return c.innerHTML = `<div class="notice">Aktiver Geit i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Geit-paraply (kommer).</div>`;
  }});

  router.registerView("grovfor", { title:"Grovfôr", subtitle:"Paraply", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.grovfor.enabled) return c.innerHTML = `<div class="notice">Aktiver Grovfôr i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Grovfôr-paraply (kommer).</div>`;
  }});

  router.registerView("fruktgront", { title:"Frukt og grønt", subtitle:"Paraply", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.fruktGront.enabled) return c.innerHTML = `<div class="notice">Aktiver Frukt og grønt i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Frukt og grønt-paraply (kommer). Rabarbra kan ligge her.</div>`;
  }});

  router.registerView("rabarbra", { title:"Rabarbra", subtitle:"(kommer)", actions:()=>[], render(c,{data:d}) {
    if (!d.productions.fruktGront.enabled || !d.productions.fruktGront.rabarbra) return c.innerHTML = `<div class="notice">Aktiver Rabarbra i Innstillinger → Produksjoner.</div>`;
    c.innerHTML = `<div class="notice">Rabarbra-modul (kommer) – blir stor for Karmøy Safteri.</div>`;
  }});

  // --------------------
  // Init
  // --------------------
  enforceNav();
  router.init("dashboard");
  // sikre at vi vinner over router etter init
  setTimeout(enforceNav, 0);
  pill.textContent = "Klar";
}

// --------------------
// Data shape
// --------------------
function ensureDataShape(d) {
  d = d || {};
  d.farm = d.farm || { name: "", kommune: "", areal: 0 };
  d.skifter = Array.isArray(d.skifter) ? d.skifter : [];
  d.plantProtectionLog = Array.isArray(d.plantProtectionLog) ? d.plantProtectionLog : [];
  d.fertilizerLog = Array.isArray(d.fertilizerLog) ? d.fertilizerLog : [];

  if (!d.productions) d.productions = {};
  if (!d.productions.husdyr) d.productions.husdyr = {};
  if (!d.productions.grovfor) d.productions.grovfor = {};
  if (!d.productions.fruktGront) d.productions.fruktGront = {};

  d.productions.husdyr = {
    enabled: !!d.productions.husdyr.enabled,
    sau: !!d.productions.husdyr.sau,
    geit: !!d.productions.husdyr.geit
  };

  d.productions.grovfor = {
    enabled: !!d.productions.grovfor.enabled
  };

  d.productions.fruktGront = {
    enabled: !!d.productions.fruktGront.enabled,
    rabarbra: !!d.productions.fruktGront.rabarbra
  };

  return d;
}

// --------------------
// Styles
// --------------------
function ensureSolidButtons() {
  const id = "farmapp_solid_buttons_safe_v1";
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
  const id = "farmapp_input_style_safe_v1";
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
  const id = "farmapp_select_dialog_styles_safe_v1";
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
