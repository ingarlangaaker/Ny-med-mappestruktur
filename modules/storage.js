
// modules/storage.js
// Ansvar: All lagring og henting av data
// Ingen UI. Ingen DOM-manipulering.
// Kun data.

const APP_KEY = "farmapp_v1";

// Standard datastruktur (kan utvides senere)
const defaultData = {
  version: 1,
  created: new Date().toISOString(),
  farm: {
    name: "",
    kommune: "",
    areal: 0
  },
  skifter: [],
  husdyr: [],
  fertilizerLog: [],
  plantProtectionLog: []
};

// =======================
// HENT DATA
// =======================

export function loadData() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) {
      return structuredClone(defaultData);
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error("Feil ved lasting av data:", err);
    return structuredClone(defaultData);
  }
}

// =======================
// LAGRE DATA
// =======================

export function saveData(data) {
  try {
    localStorage.setItem(APP_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Feil ved lagring:", err);
    return false;
  }
}

// =======================
// RESET DATA
// =======================

export function resetData() {
  localStorage.removeItem(APP_KEY);
  return structuredClone(defaultData);
}

// =======================
// EKSPORT / IMPORT
// =======================

export function exportData() {
  return JSON.stringify(loadData(), null, 2);
}

export function importData(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    saveData(parsed);
    return true;
  } catch (err) {
    console.error("Import feilet:", err);
    return false;
  }
}
