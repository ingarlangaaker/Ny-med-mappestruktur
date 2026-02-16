const KEY = "farmapp_data_v1";

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("loadData feil", e);
    return null;
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("saveData feil", e);
    return false;
  }
}

export function resetData() {
  const empty = {
    farm: { name: "", kommune: "", areal: 0 },
    skifter: [],
    plantProtectionLog: [],
    fertilizerLog: [],
    husdyr: [],
    productions: {
      husdyr: { enabled:false, sau:false, geit:false, melkeku:false, ammeku:false, ungdyrStorfe:false, purke:false, slaktegris:false, egg:false, slaktekylling:false, kalkun:false, hest:false },
      grovfor: { enabled:false, eng:false, beite:false, forplan:false, lager:false },
      fruktGront: { enabled:false, rabarbra:false, potet:false, fruktBaer:false, rot:false, kal:false, bladLok:false }
    }
  };
  try { localStorage.setItem(KEY, JSON.stringify(empty)); } catch {}
  return empty;
}

export function exportData() {
  const d = loadData();
  return JSON.stringify(d ?? resetData(), null, 2);
}

export function importData(jsonText) {
  try {
    const obj = JSON.parse(String(jsonText || ""));
    localStorage.setItem(KEY, JSON.stringify(obj));
    return true;
  } catch (e) {
    console.error("importData feil", e);
    return false;
  }
}
