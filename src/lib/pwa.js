const listeners = new Set();
let registration;
let pendingRegistration;
let status = { ready: false, updateAvailable: false, error: false };

function publish(patch) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener();
}

export const getPwaStatus = () => status;
export function subscribePwa(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function registerPwa() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    publish({ error: true });
    return Promise.resolve();
  }
  if (pendingRegistration) return pendingRegistration;
  pendingRegistration = navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
    .then((registered) => {
      registration = registered;
      const refresh = () => {
        if (registration !== registered) return;
        publish({
          ready: !!registered.active,
          updateAvailable: !!registered.waiting && !!registered.active,
          error: false,
        });
      };
      const observeInstalling = () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "redundant" && !registration.active) publish({ error: true });
          else refresh();
        });
      };
      registration.addEventListener("updatefound", observeInstalling);
      navigator.serviceWorker.addEventListener("controllerchange", refresh);
      observeInstalling();
      refresh();
      void navigator.serviceWorker.ready.then(refresh);
      return registration;
    })
    .catch((error) => {
      pendingRegistration = undefined;
      publish({ error: true });
      console.error("Offline-Version konnte nicht vorbereitet werden", error);
    });
  return pendingRegistration;
}

export async function retryPwa() {
  if (!registration?.active && !registration?.waiting) {
    registration = undefined;
    pendingRegistration = undefined;
    publish({ error: false });
    return registerPwa();
  }
  publish({ error: false });
  try {
    await registration.update();
  } catch {
    publish({ error: true });
  }
}
