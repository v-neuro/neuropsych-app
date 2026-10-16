const listeners = new Set();
let registration;
let pendingRegistration;
let verificationSequence = 0;
let lastVerification = 0;
let lifecycleInstalled = false;
let persistenceRequested = false;
let status = {
  ready: false, checkingOffline: true, updateAvailable: false, error: false,
  checkingUpdate: false, updateMessage: "", persistence: "checking", missingCount: 0,
};
function publish(patch) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}
export const getPwaStatus = () => status;
export function subscribePwa(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function requestPersistence() {
  try {
    if (!navigator.storage?.persisted || !navigator.storage?.persist) {
      publish({ persistence: "unsupported" }); return;
    }
    const granted = await navigator.storage.persisted() || await navigator.storage.persist();
    publish({ persistence: granted ? "persistent" : "managed" });
  } catch { publish({ persistence: "managed" }); }
}

export async function verifyOffline({ repair = false } = {}) {
  const sequence = ++verificationSequence;
  const worker = navigator.serviceWorker.controller || registration?.active;
  publish({ ready: false, checkingOffline: true });
  if (!worker) { publish({ checkingOffline: false, error: true }); return false; }
  try {
    const result = await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      const finish = (callback, value) => {
        clearTimeout(timeout); channel.port1.close(); callback(value);
      };
      const timeout = setTimeout(() => finish(reject, new Error("Offline verification timed out")), 15_000);
      channel.port1.onmessage = ({ data }) => finish(resolve, data);
      worker.postMessage({ type: "VERIFY_OFFLINE", repair }, [channel.port2]);
    });
    if (sequence !== verificationSequence) return false;
    lastVerification = Date.now();
    publish({ ready: result.ready === true, checkingOffline: false, error: !result.ready, missingCount: result.missing?.length || 0 });
    return result.ready === true;
  } catch {
    if (sequence === verificationSequence) publish({ ready: false, checkingOffline: false, error: true });
    return false;
  }
}

function installLifecycleChecks() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && registration?.active && Date.now() - lastVerification > 60_000) void verifyOffline();
  });
  window.addEventListener("online", () => { if (registration?.active) void verifyOffline({ repair: true }); });
}

export function registerPwa() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    publish({ error: true, checkingOffline: false, persistence: "unsupported" });
    return Promise.resolve();
  }
  if (pendingRegistration) return pendingRegistration;
  if (!persistenceRequested) { persistenceRequested = true; void requestPersistence(); }
  installLifecycleChecks();
  pendingRegistration = navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
    .then((registered) => {
      registration = registered;
      const refresh = () => {
        if (registration !== registered) return;
        publish({ updateAvailable: !!registered.waiting && !!registered.active });
        if (registered.active?.state === "activated") void verifyOffline();
      };
      const observeInstalling = () => {
        const worker = registered.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant" && !registered.active) publish({ error: true, checkingOffline: false });
          else refresh();
        });
      };
      registered.addEventListener("updatefound", observeInstalling);
      navigator.serviceWorker.addEventListener("controllerchange", refresh);
      observeInstalling(); refresh();
      void navigator.serviceWorker.ready.then(refresh);
      return registered;
    }).catch((error) => {
      pendingRegistration = undefined;
      publish({ error: true, checkingOffline: false });
      console.error("Offline-Version konnte nicht vorbereitet werden", error);
    });
  return pendingRegistration;
}

function waitForInstallation(worker) {
  if (!worker || ["installed", "activated", "redundant"].includes(worker.state)) return Promise.resolve(worker?.state);
  return new Promise((resolve, reject) => {
    const changed = () => {
      if (!["installed", "activated", "redundant"].includes(worker.state)) return;
      clearTimeout(timeout); worker.removeEventListener("statechange", changed); resolve(worker.state);
    };
    const timeout = setTimeout(() => {
      worker.removeEventListener("statechange", changed); reject(new Error("Update download timed out"));
    }, 20_000);
    worker.addEventListener("statechange", changed);
    changed();
  });
}

export async function checkForUpdates() {
  if (status.checkingUpdate) return;
  publish({ checkingUpdate: true, updateMessage: "" });
  try {
    if (!registration) await registerPwa();
    if (!registration) throw new Error("No registration");
    await registration.update();
    const state = await waitForInstallation(registration.installing);
    if (state === "redundant") throw new Error("Update download failed");
    const available = !!registration.waiting && !!registration.active;
    publish({ updateAvailable: available, updateMessage: available ? "Eine neue Version ist bereit." : "Die App ist auf dem neuesten Stand." });
  } catch {
    publish({ updateMessage: "Updates konnten nicht geprüft oder heruntergeladen werden. Bitte mit Internetverbindung erneut versuchen." });
  } finally {
    publish({ checkingUpdate: false });
    if (registration?.active) await verifyOffline();
  }
}

export async function retryPwa() {
  if (!registration?.active && !registration?.waiting) {
    registration = undefined; pendingRegistration = undefined;
    publish({ error: false, checkingOffline: true });
    return registerPwa();
  }
  await verifyOffline({ repair: true });
}
