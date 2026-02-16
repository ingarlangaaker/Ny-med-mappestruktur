import { boot } from "./app.js";

(function(){
  try {
    console.log("boot() kjørt...");
    boot();
  } catch (e) {
    console.error(e);
    document.body.innerHTML = `
      <div style="padding:16px; font-family:system-ui; color:#111; background:#fff;">
        <h2>Farmapp – feilsøk</h2>
        <p>Hvis appen krasjer, vises feilen under.</p>
        <pre style="white-space:pre-wrap; background:#f2f2f2; padding:12px; border-radius:8px;">${String(e?.stack || e)}</pre>
        <p>boot() kjørt. Hvis du fortsatt ser bare denne siden, feiler UI/DOM-id’er.</p>
      </div>
    `;
  }
})();
