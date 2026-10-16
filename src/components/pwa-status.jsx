import { useEffect, useState, useSyncExternalStore } from "react";
import { getPwaStatus, retryPwa, subscribePwa } from "../lib/pwa";
import { Button } from "./ui";

export function PwaStatus() {
  const { ready, updateAvailable, error } = useSyncExternalStore(subscribePwa, getPwaStatus);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installed] = useState(() => window.matchMedia("(display-mode: standalone)").matches || !!navigator.standalone);

  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return (
    <div className="w-full space-y-2 rounded-xl border border-indigo-100 bg-white/80 p-3 text-sm" aria-label="App und Offlinebetrieb">
      <p role="status">
        {ready
          ? online ? "Für Offlinebetrieb bereit." : "Offline – Testung und Export sind verfügbar."
          : error ? "Offline-Version nicht verfügbar. Bitte mit Internetverbindung erneut versuchen."
            : "Offline-Version wird vorbereitet … Bitte die App geöffnet lassen."}
      </p>
      {error && <Button size="sm" onClick={() => void retryPwa()}>Erneut herunterladen</Button>}
      {updateAvailable && (
        <div className="space-y-2">
          <p>Eine neue App-Version ist bereit. Die laufende Testung bleibt in der aktuellen Version.</p>
          <p className="text-xs text-zinc-600">Zum Aktualisieren nach der Testung alle Fenster dieser App schließen und die App erneut öffnen.</p>
        </div>
      )}
      {!installed && (
        <details>
          <summary className="cursor-pointer font-medium">Auf dem iPad als App installieren</summary>
          <p className="mt-2">Diese Seite in Safari öffnen, auf „Teilen“ und dann „Zum Home-Bildschirm“ tippen. Falls angezeigt, „Als Web-App öffnen“ aktivieren und „Hinzufügen“ wählen.</p>
          <p className="mt-1 text-xs text-zinc-600">Die App einmal mit Internetverbindung öffnen und auf „Für Offlinebetrieb bereit“ warten.</p>
        </details>
      )}
    </div>
  );
}
