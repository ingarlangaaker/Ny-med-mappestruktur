// modules/app.js
// Core boot-fil for Farmapp
// Denne filen skal ALDRI inneholde forretningslogikk.
// Kun oppstart og registrering av moduler.

export async function boot() {

  const pill = document.getElementById('pillStatus');
  const nav = document.getElementById('nav');
  const view = document.getElementById('view');
  const title = document.getElementById('viewTitle');
  const sub = document.getElementById('viewSub');
  const actions = document.getElementById('actions');

  if (!pill || !nav || !view) {
    console.error("DOM ikke klar");
    return;
  }

  pill.textContent = "Starter kjerne…";

  // Midlertidig enkel view-motor (erstattes senere av router.js)
  const views = {};

  function registerView(id, config) {
    views[id] = config;
  }

  function renderView(id) {
    const v = views[id];
    if (!v) return;

    title.textContent = v.title || "";
    sub.textContent = v.subtitle || "";
    actions.innerHTML = "";
    view.innerHTML = "";

    if (v.actions) {
      v.actions.forEach(a => {
        const btn = document.createElement("button");
        btn.className = "btn " + (a.primary ? "primary" : "");
        btn.textContent = a.label;
        btn.onclick = a.onClick;
        actions.appendChild(btn);
      });
    }

    if (v.render) {
      v.render(view);
    }
  }

  function renderNav() {
    nav.innerHTML = "";
    Object.keys(views).forEach(key => {
      const btn = document.createElement("button");
      btn.textContent = views[key].title;
      btn.onclick = () => renderView(key);
      nav.appendChild(btn);
    });
  }

  // =========================
  // STANDARD START-VIEWS
  // =========================

  registerView("dashboard", {
    title: "Oversikt",
    subtitle: "Grunnmur er aktiv",
    render(container) {
      container.innerHTML = `
        <div class="notice">
          <strong>Kjernen er oppe.</strong><br><br>
          Appen kjører nå modulbasert struktur.<br>
          Neste steg blir å legge til lagring (storage.js).
        </div>
      `;
    }
  });

  registerView("minGård", {
    title: "Min gård",
    subtitle: "Konfigurasjon kommer senere",
    render(container) {
      container.innerHTML = `
        <div class="notice">
          Denne modulen er ikke koblet til ennå.<br>
          Den blir aktiv når vi legger inn storage og data-modell.
        </div>
      `;
    }
  });

  renderNav();
  renderView("dashboard");

  pill.textContent = "Klar";
}
