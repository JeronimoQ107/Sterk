// DATA-03: copias automáticas de los datos en este dispositivo.
// Se guardan en IndexedDB y no en localStorage para no gastar el espacio de los datos reales
// (unos 5 MB en Safari): si localStorage se llenara, fallaría guardar entrenamientos.
const KEEP = { version: 3, "before-restore": 1 };

// Resumen para mostrar en Ajustes sin volver a leer la copia completa.
function summarize(data) {
  const count = (key) => {
    try {
      const value = JSON.parse(data[key] ?? "[]");
      return Array.isArray(value) ? value.length : 0;
    } catch {
      return 0;
    }
  };
  return {
    sessions: count("sterk:v1:completed-sessions"),
    entries: count("sterk:v1:workout-entries"),
    customExercises: count("sterk:v1:custom-exercises"),
    activeSession: Boolean(data["sterk:v1:active-session"] && data["sterk:v1:active-session"] !== "null"),
  };
}

const newest = (a, b) => b.createdAt.localeCompare(a.createdAt);
const metadata = ({ data, ...rest }) => rest;
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

// `describe` permite a la app contar los entrenamientos con la misma regla que el historial; se llama
// cuando los datos actuales coinciden con los de la copia.
export function createSnapshots({ storage, version, backend = indexedDbBackend(), now = () => new Date(), describe = null }) {
  async function save(reason, data) {
    const record = { id: uid(), reason, appVersion: version, createdAt: now().toISOString(), summary: { ...summarize(data), ...describe?.() }, data };
    await backend.put(record);
    const old = (await backend.getAll()).filter((item) => item.reason === reason).sort(newest).slice(KEEP[reason]);
    for (const item of old) await backend.delete(item.id);
    return metadata(record);
  }

  return {
    // Primera ejecución de una versión: guarda los datos tal como estaban al arrancar.
    // No se crea si algún dato no se pudo leer o si no hay nada que guardar.
    async ensureVersionSnapshot() {
      const data = storage.getStartupData();
      if (!data || storage.checkData().length) return { created: false, reason: "unreadable" };
      if (!Object.keys(data).length) return { created: false, reason: "empty" };
      const existing = await backend.getAll();
      if (existing.some((item) => item.reason === "version" && item.appVersion === version)) return { created: false, reason: "exists" };
      return { created: true, snapshot: await save("version", data) };
    },
    async list() {
      return (await backend.getAll()).sort(newest).map(metadata);
    },
    // Antes de restaurar se guarda una copia de los datos actuales para poder deshacerlo.
    async restore(id) {
      const record = (await backend.getAll()).find((item) => item.id === id);
      if (!record) throw new Error("La copia ya no existe.");
      storage.validateRawData(record.data);
      const current = storage.readRawData();
      await save("before-restore", current);
      storage.restoreRawData(record.data);
    },
  };
}

// Acceso mínimo a IndexedDB. Si no está disponible, las operaciones fallan y la app sigue funcionando.
export function indexedDbBackend(name = "sterk-snapshots") {
  let database;
  const open = () => {
    database ??= new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error("Las copias automáticas no están disponibles en este navegador."));
      const request = globalThis.indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("snapshots", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.catch(() => { database = undefined; });
    return database;
  };
  const run = async (mode, action) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("snapshots", mode);
      const request = action(transaction.objectStore("snapshots"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("No se pudo guardar la copia."));
    });
  };
  return {
    getAll: () => run("readonly", (store) => store.getAll()),
    put: (record) => run("readwrite", (store) => store.put(record)).then(() => undefined),
    delete: (id) => run("readwrite", (store) => store.delete(id)).then(() => undefined),
  };
}
