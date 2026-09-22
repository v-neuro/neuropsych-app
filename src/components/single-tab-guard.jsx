import { useEffect, useState } from "react";
import { Button } from "./ui";

// All sessions and drawings share browser storage, so ownership covers the whole app.
const EDITOR_LOCK = "npt-session-editor";

export function SingleTabGuard({ children }) {
  const [status, setStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let release;

    const acquire = async () => {
      if (!navigator.locks?.request) {
        setStatus("unsupported");
        return;
      }
      try {
        await navigator.locks.request(EDITOR_LOCK, { mode: "exclusive", ifAvailable: true }, async (lock) => {
          // StrictMode can clean up an effect before its lock request completes.
          if (cancelled) return;
          if (!lock) {
            setStatus("blocked");
            return;
          }
          setStatus("active");
          // Keep ownership when backgrounded and while starting a new session.
          // Closing/reloading the document also releases its locks in the browser.
          await new Promise((resolve) => { release = resolve; });
        });
      } catch (error) {
        if (cancelled) return;
        console.error("Sitzung konnte nicht exklusiv geöffnet werden", error);
        setStatus("error");
      }
    };

    // Let StrictMode's immediate cleanup cancel its first setup before requesting
    // a lock; otherwise the replacement effect can collide with our own request.
    void Promise.resolve().then(() => {
      if (!cancelled) return acquire();
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [attempt]);

  // Do not mount App in a waiting tab: even its initialization writes/prunes storage.
  if (status === "active") return children;

  const checking = status === "checking";
  const blocked = status === "blocked";
  return (
    <main className="min-h-screen flex items-center justify-center px-4 text-slate-900">
      <div className="w-full max-w-md rounded-3xl border border-indigo-100 bg-white p-6 shadow-lg">
        <h1 className="text-xl font-semibold">{checking ? "Sitzung wird geöffnet…" : blocked ? "Testung bereits geöffnet" : "Sitzung kann nicht geöffnet werden"}</h1>
        <p className="mt-3 text-sm text-slate-700" role="status">
          {checking
            ? "Bitte einen Moment warten."
            : blocked
              ? "Diese Anwendung ist bereits in einem anderen Tab oder Fenster geöffnet. Bitte dort weiterarbeiten oder den anderen Tab schließen und hier erneut versuchen."
              : status === "unsupported"
                ? "Bitte diese Anwendung über eine HTTPS-Verbindung in einem aktuellen Browser öffnen, damit Ihre Testdaten sicher gespeichert werden können."
                : "Die Testdaten konnten nicht zum Bearbeiten freigegeben werden. Bitte erneut versuchen."}
        </p>
        {!checking && (
          <Button className="mt-4" onClick={() => {
            setStatus("checking");
            setAttempt((value) => value + 1);
          }}>
            Erneut versuchen
          </Button>
        )}
      </div>
    </main>
  );
}
