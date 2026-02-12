import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cls, useInterval } from "./lib/utils";
import { idbGet, idbSet, idbDel, idbSetDrawing, idbGetDrawing, idbDeleteDrawing, idbDeleteDrawingNamespace, idbPruneDrawingsExcept, idbPruneOldSessions } from "./lib/persist";
import { Card, Header, SectionTitle } from "./components/ui";
import { DrawPad } from "./components/draw-pad";
import { Stopwatch, Countdown60 } from "./components/timers";
import { AbortButton } from "./components/abort-button";
import { ErrorBoundary } from "./components/error-boundary";
import { CounterCard } from "./components/counter-card";

// ---------- Preloaded test materials (read-only in UI) ----------
const VLMT_LISTS = {
  A: [
    "Trommel","Vorhang","Glocke","Kaffee","Schule",
    "Eltern","Mond","Garten","Hut","Bauer",
    "Nase","Truthahn","Farbe","Haus","Fluss",
  ],
  B: [
    "Geige","Fenster","Lampe","Museum","Tee",
    "Reise","Sonne","Wiese","Treppe","Maurer",
    "Zunge","Tiger","Musik","Stadt","See",
  ],
  C: [
    "Horn","Tür","Seil","Kakao","Gericht",
    "Wagen","Sterne","Baum","Mantel","Pfarrer",
    "Mund","Gans","Form","Land","Regen",
  ],
  D: [
    "Trompete","Regal","Kamin","Suppe","Schwester",
    "Messer","Jacke","Wald","Aufzug","Lager",
    "Kinn","Leopard","Tanz","Sand","Teich",
  ],
};

const VLMT_INTERFERENCE = [
  "Tisch","Förster","Vogel","Schuh","Ofen",
  "Berg","Handtuch","Brille","Wolke","Boot",
  "Lamm","Gewehr","Bleistift","Kirsche","Arm",
];

const VLMT_RECOG = {
  A: [
    { w: "Vorhang", t: true }, { w: "Glocke", t: true }, { w: "Schuh", t: false }, { w: "Tisch", t: false },
    { w: "Garbe", t: false }, { w: "Locke", t: false }, { w: "See", t: false }, { w: "Truthahn", t: true },
    { w: "Garten", t: true }, { w: "Trommel", t: true }, { w: "Sonne", t: false }, { w: "Ofen", t: false },
    { w: "Schule", t: true }, { w: "Fisch", t: false }, { w: "Bleistift", t: false }, { w: "Jäger", t: false },
    { w: "Haus", t: true }, { w: "Vogel", t: false }, { w: "Warten", t: false }, { w: "Kinder", t: false },
    { w: "Boot", t: false }, { w: "Lehrer", t: false }, { w: "Fenster", t: false }, { w: "Kuchen", t: false },
    { w: "Maus", t: false }, { w: "Fluss", t: true }, { w: "Handtuch", t: false }, { w: "Bein", t: false },
    { w: "Eltern", t: true }, { w: "Bauer", t: true }, { w: "Vase", t: false }, { w: "Kuh", t: false },
    { w: "Förster", t: false }, { w: "Lamm", t: false }, { w: "Wolke", t: false }, { w: "Gewehr", t: false },
    { w: "Mut", t: false }, { w: "Brille", t: false }, { w: "Pauke", t: false }, { w: "Arm", t: false },
    { w: "Farbe", t: true }, { w: "Hut", t: true }, { w: "Mond", t: true }, { w: "Nase", t: true },
    { w: "Kaffee", t: true }, { w: "Stille", t: false }, { w: "Mauer", t: false }, { w: "Schaf", t: false },
    { w: "Berg", t: false }, { w: "Kirsche", t: false },
  ],
  B: [
    { w: "Stadt", t: true }, { w: "Ofen", t: false }, { w: "Schuh", t: false }, { w: "Tisch", t: false },
    { w: "Neige", t: false }, { w: "Wonne", t: false }, { w: "Glas", t: false }, { w: "Musik", t: true },
    { w: "Tiger", t: true }, { w: "Geige", t: true }, { w: "Flöte", t: false }, { w: "Fenster", t: true },
    { w: "Treppe", t: true }, { w: "Fisch", t: false }, { w: "Bleistift", t: false }, { w: "Jäger", t: false },
    { w: "Museum", t: true }, { w: "Vogel", t: false }, { w: "Rampe", t: false }, { w: "Löwe", t: false },
    { w: "Boot", t: false }, { w: "Licht", t: false }, { w: "Urlaub", t: false }, { w: "Gras", t: false },
    { w: "Klee", t: false }, { w: "Sonne", t: true }, { w: "Handtuch", t: false }, { w: "Bein", t: false },
    { w: "See", t: true }, { w: "Tee", t: true }, { w: "Riese", t: false }, { w: "Kuh", t: false },
    { w: "Förster", t: false }, { w: "Lamm", t: false }, { w: "Wolke", t: false }, { w: "Gewehr", t: false },
    { w: "Mauer", t: false }, { w: "Brille", t: false }, { w: "Stufe", t: false }, { w: "Arm", t: false },
    { w: "Zunge", t: true }, { w: "Reise", t: true }, { w: "Lampe", t: true }, { w: "Maurer", t: true },
    { w: "Wiese", t: true }, { w: "Stille", t: false }, { w: "Sieger", t: false }, { w: "Schaf", t: false },
    { w: "Berg", t: false }, { w: "Kirsche", t: false },
  ],
  C: [
    { w: "Seil", t: true }, { w: "Ofen", t: false }, { w: "Schuh", t: false }, { w: "Vogel", t: false },
    { w: "Brille", t: false }, { w: "Mantel", t: true }, { w: "Förster", t: false }, { w: "Lamm", t: false },
    { w: "Wolke", t: false }, { w: "Gewehr", t: false }, { w: "Geweih", t: false }, { w: "Horn", t: true },
    { w: "Gericht", t: true }, { w: "Hand", t: false }, { w: "Schaf", t: false }, { w: "Arm", t: false },
    { w: "Wagen", t: true }, { w: "Kakao", t: true }, { w: "Baum", t: true }, { w: "Stille", t: false },
    { w: "Boot", t: false }, { w: "Huhn", t: false }, { w: "Degen", t: false }, { w: "Gesicht", t: false },
    { w: "Berg", t: false }, { w: "Kirsche", t: false }, { w: "Tisch", t: false }, { w: "Beil", t: false },
    { w: "Norm", t: false }, { w: "Auto", t: false }, { w: "Hund", t: false }, { w: "Kuh", t: false },
    { w: "Mund", t: true }, { w: "Regen", t: true }, { w: "Land", t: true }, { w: "Sterne", t: true },
    { w: "Fisch", t: false }, { w: "Bleistift", t: false }, { w: "Jäger", t: false }, { w: "Form", t: true },
    { w: "Gans", t: true }, { w: "Tür", t: true }, { w: "Milch", t: false }, { w: "Bein", t: false },
    { w: "Jacke", t: false }, { w: "Fenster", t: false }, { w: "Wald", t: false }, { w: "Mandel", t: false },
    { w: "Pfarrer", t: true }, { w: "Handtuch", t: false },
  ],
  D: [
    { w: "Trompete", t: true }, { w: "Ofen", t: false }, { w: "Schuh", t: false }, { w: "Tisch", t: false },
    { w: "Lage", t: false }, { w: "Land", t: false }, { w: "Stirn", t: false }, { w: "Regal", t: true },
    { w: "Messer", t: true }, { w: "Leopard", t: true }, { w: "Posaune", t: false }, { w: "Kamin", t: true },
    { w: "Aufzug", t: true }, { w: "Fisch", t: false }, { w: "Bleistift", t: false }, { w: "Jäger", t: false },
    { w: "Suppe", t: true }, { w: "Vogel", t: false }, { w: "Backe", t: false }, { w: "Gabel", t: false },
    { w: "Boot", t: false }, { w: "Schornstein", t: false }, { w: "See", t: false }, { w: "Tango", t: false },
    { w: "legal", t: false }, { w: "Jacke", t: true }, { w: "Handtuch", t: false }, { w: "Bein", t: false },
    { w: "Teich", t: true }, { w: "Kinn", t: true }, { w: "Anzug", t: false }, { w: "Kuh", t: false },
    { w: "Förster", t: false }, { w: "Lamm", t: false }, { w: "Wolke", t: false }, { w: "Gewehr", t: false },
    { w: "Wall", t: false }, { w: "Brille", t: false }, { w: "Bruder", t: false }, { w: "Arm", t: false },
    { w: "Schwester", t: true }, { w: "Wald", t: true }, { w: "Sand", t: true }, { w: "Tanz", t: true },
    { w: "Lager", t: true }, { w: "Stille", t: false }, { w: "Schuppe", t: false }, { w: "Schaf", t: false },
    { w: "Berg", t: false }, { w: "Kirsche", t: false },
  ],
};

// CERAD Benennen: 15 Bilder (Labels, keine Inhalte)
const CERAD_BENENNEN_LABELS = [
  "Baum",
  "Bett",
  "Pfeife",
  "Blume",
  "Haus",
  "Kanu/Kajak",
  "Zahnbürste",
  "Vulkan",
  "Maske",
  "Kamel/Dromedar",
  "Mundharmonika",
  "Zange",
  "Hängematte",
  "Trichter",
  "Dominosteine",
];

// ---------- Zahlen-/Blockspanne Sequenzen (aus PDF) ----------
const ZS_FWD = [
  ["6-2-9","3-7-5"],
  ["5-4-1-7","8-3-9-6"],
  ["3-6-9-2-5","6-9-4-7-1"],
  ["9-1-8-4-2-7","6-3-5-4-8-2"],
  ["1-2-8-5-3-4-6","2-8-1-4-9-7-5"],
  ["3-8-2-9-5-1-7-4","5-9-1-8-2-6-4-7"],
];
const ZS_REV = [
  ["5-1","3-8"],
  ["4-9-3","5-2-6"],
  ["3-8-1-4","1-7-9-5"],
  ["6-2-9-7-3","4-8-5-2-7"],
  ["7-1-5-2-8-6","8-3-1-9-6-4"],
  ["4-7-3-9-1-2-8","8-1-2-9-3-6-5"],
];
const BS_FWD = [
  ["2-6","8-4"],
  ["2-7-5","8-1-6"],
  ["3-2-8-4","2-6-1-5"],
  ["5-3-4-6-1","3-5-1-7-2"],
  ["1-7-2-8-5-4","7-3-6-1-4-8"],
  ["8-2-5-3-4-6-1","4-2-6-8-3-7-5"],
];
const BS_REV = [
  ["3-6","7-4"],
  ["6-8-5","3-1-8"],
  ["4-8-1-6","5-2-4-1"],
  ["4-6-8-5-2","8-1-6-3-7"],
  ["7-1-8-3-6-2","3-8-1-7-5-4"],
  ["1-5-2-7-4-3-8","6-7-4-3-1-5-2"],
];

function ImpressumModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg dark:bg-zinc-900 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Impressum</div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Schließen
          </button>
        </div>
        <div className="text-sm space-y-2 leading-relaxed">
          <p><strong>Betreiber*in:</strong> AG Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum</p>
          <p><strong>Anschrift:</strong> In der Schornau 23-25, 44892 Bochum</p>
          <p><strong>Kontakt:</strong> Tel: 0234-299-0 · E-Mail: neuropsychologie.bochum@knappschaft-kliniken.de</p>
          <p><strong>Zweck der Anwendung:</strong> interne, nicht-kommerzielle Nutzung für neuropsychologische Testung</p>
          <p><strong>Umsatzsteuer-ID:</strong> DE 815 447 053</p>
          <p><strong>Haftungsausschluss:</strong> Trotz sorgfältiger inhaltlicher Kontrolle keine Haftung für externe Links; für den Inhalt verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich. Die Anwendung ersetzt keine ärztliche Aufklärung oder Dokumentationspflichten.</p>
          <p><strong>Urheberrecht:</strong> Inhalte und Layout sind urheberrechtlich geschützt; Vervielfältigung nur mit Zustimmung der Betreiber*in. Die Rechte der genutzten neuropsychologischen Untersuchungsverfahren verbleiben bei den ursprünglichen Rechteinhabern.</p>
        </div>
      </div>
    </div>
  );
}

function PasswordPrompt({ onSubmit, error }) {
  const [pwd, setPwd] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handle = (e) => {
    e.preventDefault();
    if (!onSubmit) return;
    setSubmitting(true);
    Promise.resolve(onSubmit(pwd, remember)).finally(() => setSubmitting(false));
  };

  return (
    <form className="space-y-3" onSubmit={handle}>
      <div>
        <label className="block text-sm mb-1">Passwort</label>
        <input
          type="password"
          className="w-full rounded-xl border px-3 py-2"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && <div className="mt-1 text-sm text-rose-500">{error}</div>}
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Angemeldet bleiben (Gerät merken)
      </label>
      <button
        type="submit"
        className="w-full px-3 py-2 rounded-xl border bg-zinc-900 text-white disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "Prüfen..." : "Anmelden"}
      </button>
    </form>
  );
}

// Epi-Track: echte UI mit Stopwatches, Countdown und Span-Übernahme
function EpiTrackWire({ sessionData, onImportInv, onPersistTime, onAbort, onSendTmt }) {
  const subs = [
    { id: "zahlen_interferenz", label: "Zahleninterferenz", type: "stopwatch" },
    { id: "zahlen_verbinden", label: "Zahlen verbinden", type: "stopwatch" },
    { id: "zahlen_buchstaben", label: "Zahlen-Buchstaben", type: "stopwatch" },
    { id: "labyrinth", label: "Labyrinth", type: "stopwatch" },
    { id: "wortfl", label: "Wortflüssigkeit", type: "wf" },
    { id: "inv_spanne", label: "Invertierte Zahlenspanne", type: "inv" },
  ];

  const longestFromZahlRev = useMemo(() => {
    const z = sessionData?.zahl_rev;
    if (!z || !Array.isArray(z.rows) || !Array.isArray(z.vals)) return 0;
    let max = 0;
    z.rows.forEach((pair, idx) => {
      const v = z.vals[idx];
      const ok = v && (v.v1 === 1 || v.v2 === 1);
      if (ok) {
        const L = (pair?.[0] || "").split("-").filter(Boolean).length;
        if (L > max) max = L;
      }
    });
    return max;
  }, [sessionData]);

  const epiTimes = sessionData?.epi?.times || {};
  const invSpan = sessionData?.epi?.inv_spanne ?? "";
  const wfSum = epiTimes.wortfl_sum ?? "";
  const [sent, setSent] = useState({}); // track sent state for TMT buttons

  return (
    <section className="py-6">
      <Header title="Epi-Track" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {subs.map((s) => (
          <div key={s.id} className="p-3 rounded-2xl border bg-white space-y-3">
            <div className="font-medium">{s.label}</div>

            {s.type === "stopwatch" && (
              <Stopwatch
                persisted={epiTimes[s.id] ?? null}
                onPersist={(ms) => onPersistTime && onPersistTime(s.id, ms)}
              />
            )}
            {s.type === "stopwatch" && ["zahlen_verbinden", "zahlen_buchstaben"].includes(s.id) && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={typeof epiTimes[s.id] !== "number"}
                  onClick={() => {
                    const target = s.id === "zahlen_verbinden" ? "tmt_a" : "tmt_b";
                    onSendTmt && onSendTmt(target, epiTimes[s.id]);
                    setSent((m) => ({ ...m, [target]: true }));
                  }}
                  className={cls(
                    "px-3 py-2 rounded-xl border text-sm",
                    typeof epiTimes[s.id] !== "number" && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {sent[s.id === "zahlen_verbinden" ? "tmt_a" : "tmt_b"]
                    ? `An TMT-${s.id === "zahlen_verbinden" ? "A" : "B"} gesendet`
                    : `An TMT-${s.id === "zahlen_verbinden" ? "A" : "B"} senden`}
                </button>
              </div>
            )}

            {s.type === "wf" && (
              <div className="space-y-2">
                <div className="text-sm text-zinc-600">2× 60s</div>
                <Countdown60 />
                <Countdown60 />
                <label className="block text-sm">Summe Wörter</label>
                <input
                  className="mt-1 w-32 rounded-xl border p-2 text-sm"
                  placeholder="0"
                  value={wfSum}
                  onChange={(e) => {
                    const n = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0);
                    onPersistTime && onPersistTime("wortfl_sum", n);
                  }}
                />
              </div>
            )}

            {s.type === "inv" && (
              <div className="space-y-2">
                <label className="block text-sm">Spanne (max rückwärts)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-32 rounded-xl border p-2 text-sm"
                  placeholder="z. B. 6"
                  value={invSpan}
                  onChange={(e) => {
                    const v = e.target.value;
                    const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                    onImportInv && onImportInv(n);
                  }}
                />
                <div className="text-xs text-zinc-600">
                  Quelle: Zahlenspanne rückwärts
                  {longestFromZahlRev ? ` – aktuell berechnet: ${longestFromZahlRev}` : " – (keine Daten)"}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!longestFromZahlRev}
                    onClick={() => onImportInv && onImportInv(longestFromZahlRev)}
                    className={cls(
                      "px-3 py-2 rounded-xl border text-sm",
                      !longestFromZahlRev && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    aus Zahlenspanne rückwärts übernehmen
                  </button>
                  <button
                    type="button"
                    onClick={() => onImportInv && onImportInv(0)}
                    className="px-3 py-2 rounded-xl border text-sm"
                    title="Feld leeren/zurücksetzen"
                  >
                    Eingabe leeren
                  </button>
                </div>
                <div className="text-xs text-zinc-500">
                  Wert ist frei editierbar oder per Button aus der Zahlenspanne rückwärts übernehmbar.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// Basic guard to avoid crashing on malformed persisted screen state
const normalizeScreen = (value) => {
  if (value && typeof value === "object" && typeof value.name === "string") return value;
  return { name: "menu" };
};

async function loadDcsrDrawings(sessionUUID, sessionData) {
  const dcsr = sessionData?.dcsr || {};
  const keys = Array.isArray(dcsr.drawingKeys)
    ? dcsr.drawingKeys
    : Array.isArray(dcsr.drawings)
      ? dcsr.drawings
      : [];
  if (!keys.length) return [];
  const data = await Promise.all(keys.map((k) => (k ? idbGetDrawing(k) : null)));
  // Convert blobs to object URLs for img src
  return data.map((val) => {
    if (!val) return null;
    if (val instanceof Blob) return URL.createObjectURL(val);
    return val;
  });
}

// Build flat export row (CSV) with curated keys; skips große Blobs wie DCS-Zeichnungen
async function buildExportRow(sessionData, sessionUUID, opts = {}) {
  const s = sessionData || {};
  const row = { session_uuid: sessionUUID };
  const includeDrawings = !!opts.includeDrawings;
  const drawingsData = includeDrawings ? (opts.drawingsData || []) : [];

  const msToSec = (ms) => (typeof ms === "number" ? Math.round(ms / 1000) : null);

  // Basisdaten
  const demo = s.demographics || {};
  row.demographics_patient_initials = demo.patient_initials || "";
  row.demographics_patient_gender = demo.patient_gender || "";
  row.demographics_examiner_initials = demo.examiner_initials || "";

  // VLMT
  const vlmt = s.vlmt || {};
  const results = Array.isArray(vlmt.results) ? vlmt.results : [];
  const hasVlmt = !!vlmt.list || results.some((r) => r && Object.keys(r.sel || {}).length > 0);
  if (hasVlmt) {
    row.vlmt_version = vlmt.list || "";
    const hitsAt = (idx) => {
      const r = results[idx] || {};
      const sel = r.sel || {};
      return Object.values(sel).filter(Boolean).length;
    };
    const sumDG1to5 = [0, 1, 2, 3, 4].reduce((acc, i) => acc + hitsAt(i), 0);
    row.vlmt_sum_dg1_5 = sumDG1to5;
    row.vlmt_dg5_hits = hitsAt(4);
    row.vlmt_dg6_hits = hitsAt(5);
    row.vlmt_dg7_hits = hitsAt(6);
    row.vlmt_loss_dg5_to_dg7 = hitsAt(4) - hitsAt(6);
    const rekogItems = vlmt.rekog?.items || [];
    const rekogSel = vlmt.rekog?.sel || {};
    let vlmtHits = 0;
    let vlmtFP = 0;
    rekogItems.forEach((it, idx) => {
      const pick = !!rekogSel[idx];
      if (pick && it.t) vlmtHits += 1;
      if (pick && !it.t) vlmtFP += 1;
    });
    row.vlmt_rekog_correct_minus_fp = vlmtHits - vlmtFP;
  } else {
    row.vlmt_version = "";
    row.vlmt_sum_dg1_5 = null;
    row.vlmt_dg5_hits = null;
    row.vlmt_dg6_hits = null;
    row.vlmt_dg7_hits = null;
    row.vlmt_loss_dg5_to_dg7 = null;
    row.vlmt_rekog_correct_minus_fp = null;
  }

  // DCS-R
  const dcsr = s.dcsr || {};
  const dcsrCounts = Array.isArray(dcsr.counts) ? dcsr.counts : [];
  const hasDcsr = !!dcsr.ver || dcsrCounts.some((c) =>
    ["richtig", "falsch", "gedreht", "perseveration"].some((f) => (c?.[f] || 0) > 0)
  );
  if (hasDcsr) {
    row.dcsr_version = dcsr.ver || "";
    const dcsrHitsAt = (i) => (dcsrCounts[i]?.richtig ?? 0);
    row.dcsr_sum_dg1_5 = dcsrCounts.reduce((a, c) => a + (c?.richtig ?? 0), 0);
    row.dcsr_dg1_hits = dcsrHitsAt(0);
    const dcsrRecog = dcsr.rekog?.responses || {};
    if (Array.isArray(dcsrRecog)) {
      const dcsrRecogVals = Object.values(dcsrRecog);
      row.dcsr_rekog_correct = dcsrRecogVals.filter((v) => v === "korrekt").length || 0;
      row.dcsr_rekog_wrong = dcsrRecogVals.filter((v) => v === "falsch" || v === "gedreht").length || 0;
    } else {
      const corr = Number(dcsrRecog.korrekt || 0);
      const wrong = Number(dcsrRecog.falsch || 0) + Number(dcsrRecog.gedreht || 0);
      row.dcsr_rekog_correct = corr || null;
      row.dcsr_rekog_wrong = wrong || null;
    }
  } else {
    row.dcsr_version = "";
    row.dcsr_sum_dg1_5 = null;
    row.dcsr_dg1_hits = null;
    row.dcsr_rekog_correct = null;
    row.dcsr_rekog_wrong = null;
  }
  if (includeDrawings) {
    const drawings = Array.isArray(drawingsData) ? drawingsData : [];
    drawings.forEach((img, idx) => {
      row[`dcsr_drawing_dg${idx + 1}`] = img || "";
    });
  }

  // Epi-Track
  const epiTimes = s.epi?.times || {};
  row.epi_zahlen_interferenz_s = msToSec(epiTimes.zahlen_interferenz);
  row.epi_zahlen_verbinden_s = msToSec(epiTimes.zahlen_verbinden);
  row.epi_zahlen_buchstaben_s = msToSec(epiTimes.zahlen_buchstaben);
  row.epi_labyrinth_s = msToSec(epiTimes.labyrinth);
  row.epi_wortfluessigkeit_sum = epiTimes.wortfl_sum ?? null;
  row.epi_inv_spanne = s.epi?.inv_spanne ?? null;

  // TMT Haupt
  row.tmt_a_s = msToSec(s.tmt_a);
  row.tmt_b_s = msToSec(s.tmt_b);

  // Stroop
  row.stroop_woerter_s = msToSec(s.stroop?.woerter);
  row.stroop_farbstriche_s = msToSec(s.stroop?.farbstriche);
  row.stroop_interferenz_s = msToSec(s.stroop?.interferenz);
  const fails = s.stroop_notes?.interferenz_fails || {};
  const failVals = Object.values(fails);
  const anyStroopTime = ["woerter", "farbstriche", "interferenz"].some((k) => typeof s.stroop?.[k] === "number");
  const anyFails = failVals.length > 0;
  if (anyStroopTime || anyFails) {
    row.stroop_interferenz_errors = failVals.filter((v) => v === 1).length;
    row.stroop_interferenz_corrected = failVals.filter((v) => v === 2).length;
  } else {
    row.stroop_interferenz_errors = null;
    row.stroop_interferenz_corrected = null;
  }
  row.stroop_notes_woerter = s.stroop_notes?.woerter || "";
  row.stroop_notes_farbstriche = s.stroop_notes?.farbstriche || "";
  row.stroop_notes_interferenz = s.stroop_notes?.interferenz || "";

  // Grooved Pegboard
  const gp = s.gp || {};
  row.gp_dom_hand = gp.dom_hand || "";
  row.gp_dom_s = msToSec(gp.dom_ms);
  row.gp_non_s = msToSec(gp.non_ms);
  row.gp_dom_note = gp.dom_note || "";
  row.gp_non_note = gp.non_note || "";

  // CERAD MMST
  const mmstItems = s.cerad_mmst?.items || {};
  const hasMmst = Object.keys(mmstItems || {}).length > 0;
  row.cerad_mmst_total = hasMmst ? computeMmstTotal(mmstItems) : null;
  row.cerad_mmst_buchstabieren_note = s.cerad_mmst?.buchstabieren_note || "";

  // CERAD Verbalgedächtnis
  const ceradWl = s.cerad_wl || {};
  const ceradHasWl = ["dg1", "dg2", "dg3", "dg4"].some((k) => {
    const dg = ceradWl[k] || {};
    const marks = dg.marks || {};
    const hasMarks = Object.values(marks).some(Boolean);
    const hasIntr = (dg.intrusions || 0) > 0;
    return hasMarks || hasIntr;
  }) || (ceradWl.recog && Object.keys(ceradWl.recog.responses || {}).length > 0);
  if (ceradHasWl) {
    const ceradGetHits = (key) => {
      const dg = ceradWl[key] || {};
      const marks = dg.marks || {};
      return CERAD_WORDLIST.reduce((acc, w) => acc + (marks[w] ? 1 : 0), 0);
    };
    const ceradIntr = (key) => (ceradWl[key]?.intrusions ?? 0);
    row.cerad_wl_dg1_hits = ceradGetHits("dg1");
    row.cerad_wl_dg1_intrusions = ceradIntr("dg1");
    row.cerad_wl_dg2_hits = ceradGetHits("dg2");
    row.cerad_wl_dg2_intrusions = ceradIntr("dg2");
    row.cerad_wl_dg3_hits = ceradGetHits("dg3");
    row.cerad_wl_dg3_intrusions = ceradIntr("dg3");
    row.cerad_wl_dg4_hits = ceradGetHits("dg4");
    row.cerad_wl_dg4_intrusions = ceradIntr("dg4");
    row.cerad_wl_recog_correct_yes = ceradWl.recog?.correct_yes ?? 0;
    row.cerad_wl_recog_correct_no = ceradWl.recog?.correct_no ?? 0;
  } else {
    row.cerad_wl_dg1_hits = null;
    row.cerad_wl_dg1_intrusions = null;
    row.cerad_wl_dg2_hits = null;
    row.cerad_wl_dg2_intrusions = null;
    row.cerad_wl_dg3_hits = null;
    row.cerad_wl_dg3_intrusions = null;
    row.cerad_wl_dg4_hits = null;
    row.cerad_wl_dg4_intrusions = null;
    row.cerad_wl_recog_correct_yes = null;
    row.cerad_wl_recog_correct_no = null;
  }

  // CERAD Benennen
  const ben = s.cerad_benennen?.items || [];
  const hasBen = ben.length > 0;
  row.cerad_bnt_correct = hasBen ? ben.filter((it) => it?.correct === true).length : null;

  // CERAD Wortflüssigkeit
  const ceradWf = s.cerad_wf || {};
  row.cerad_wf_semantic_count = ceradWf.semantic_count ?? null;
  row.cerad_wf_phonemic_count = ceradWf.phonemic_count ?? null;
  row.cerad_wf_semantic_note = ceradWf.semantic_note || "";
  row.cerad_wf_phonemic_note = ceradWf.phonemic_note || "";

  // CERAD TMT
  const ceradTmt = s.cerad_tmt || {};
  row.cerad_tmt_a_s = msToSec(ceradTmt.a_time ?? s.cerad_tmt_a?.time);
  row.cerad_tmt_b_s = msToSec(ceradTmt.b_time ?? s.cerad_tmt_b?.time);
  row.cerad_tmt_a_note = (ceradTmt.note_a ?? s.cerad_tmt_a?.note) || "";
  row.cerad_tmt_b_note = (ceradTmt.note_b ?? s.cerad_tmt_b?.note) || "";

  // CERAD Figural
  const fig = s.cerad_fig || {};
  const draw = fig.draw_scores || {};
  const recall = fig.recall_scores || {};
  row.cerad_fig_draw_kreis = draw.kreis ?? null;
  row.cerad_fig_draw_rhombus = draw.rhombus ?? null;
  row.cerad_fig_draw_rechtecke = draw.rechtecke ?? null;
  row.cerad_fig_draw_wuerfel = draw.wuerfel ?? null;
  row.cerad_fig_recall_kreis = recall.kreis ?? null;
  row.cerad_fig_recall_rhombus = recall.rhombus ?? null;
  row.cerad_fig_recall_rechtecke = recall.rechtecke ?? null;
  row.cerad_fig_recall_wuerfel = recall.wuerfel ?? null;
  row.cerad_fig_draw_note = fig.draw_note || "";
  row.cerad_fig_recall_note = fig.recall_note || "";

  // CERAD MMST Notiz etc. + generische Notizen
  row.notes_mmst = s.cerad_mmst?.note || "";
  row.notes_benennen = s.cerad_benennen?.note || "";
  row.notes_cerad_wf = ceradWf.note || "";
  row.notes_cerad_fig = fig.notes || "";

  // TMT notes (Haupt)
  row.notes_tmt_a = s.tmt_a_note || "";
  row.notes_tmt_b = s.tmt_b_note || "";

  // Epi notes not modeled; GP notes already above.

  // Uhrentest
  row.uhr_score = s.uhr?.score ?? null;
  row.uhr_note = s.uhr?.note || "";

  // RWT
  const rwt = s.rwt || {};
  row.rwt_phon_simple_version = rwt.phon_simple?.version || "";
  row.rwt_phon_simple_sum = rwt.phon_simple?.sum ?? null;
  row.rwt_phon_simple_notes = rwt.phon_simple?.notes || "";
  row.rwt_phon_complex_version = rwt.phon_complex?.version || "";
  row.rwt_phon_complex_sum = rwt.phon_complex?.sum ?? null;
  row.rwt_phon_complex_notes = rwt.phon_complex?.notes || "";
  row.rwt_sem_simple_version = rwt.sem_simple?.version || "";
  row.rwt_sem_simple_sum = rwt.sem_simple?.sum ?? null;
  row.rwt_sem_simple_notes = rwt.sem_simple?.notes || "";
  row.rwt_sem_complex_version = rwt.sem_complex?.version || "";
  row.rwt_sem_complex_sum = rwt.sem_complex?.sum ?? null;
  row.rwt_sem_complex_notes = rwt.sem_complex?.notes || "";
  row.rwt_note = rwt.note || "";

  // Zahlenspanne & Blockspanne – export only derived lengths and correctness sums
  const spanDefs = [
    { key: "zahl_fwd", rowKey: "zahl_fwd" },
    { key: "zahl_rev", rowKey: "zahl_rev" },
    { key: "block_fwd", rowKey: "block_fwd" },
    { key: "block_rev", rowKey: "block_rev" },
  ];
  const spanLongest = (vals, rows) => {
    if (!Array.isArray(vals) || !Array.isArray(rows)) return 0;
    let max = 0;
    rows.forEach((pair, idx) => {
      const ok = vals[idx] && (vals[idx].v1 === 1 || vals[idx].v2 === 1);
      if (ok) {
        const L = (pair?.[0] || "").split("-").filter(Boolean).length;
        if (L > max) max = L;
      }
    });
    return max;
  };
  const spanCorrectSum = (vals) => {
    if (!Array.isArray(vals)) return 0;
    return vals.reduce((acc, v) => acc + (v?.v1 === 1 ? 1 : 0) + (v?.v2 === 1 ? 1 : 0), 0);
  };
  spanDefs.forEach(({ key, rowKey }) => {
    const data = s[key] || {};
    const rows = data.rows || [];
    const vals = data.vals || [];
    const hasSpan = Array.isArray(vals) && vals.some((v) => v && (v.v1 !== null || v.v2 !== null));
    row[`${rowKey}_longest`] = hasSpan ? spanLongest(vals, rows) : null;
    row[`${rowKey}_correct_sum`] = hasSpan ? spanCorrectSum(vals) : null;
  });

  // Abbruch-Flags (boolean)
  const abortedMap = {
    vlmt_aborted: s.vlmt_aborted,
    dcsr_aborted: s.dcsr_aborted,
    zahl_fwd_aborted: s.zahl_fwd_aborted,
    zahl_rev_aborted: s.zahl_rev_aborted,
    block_fwd_aborted: s.block_fwd_aborted,
    block_rev_aborted: s.block_rev_aborted,
    tmt_aborted: s.tmt_aborted,
    tmt_a_aborted: s.tmt_a_aborted,
    tmt_b_aborted: s.tmt_b_aborted,
    stroop_aborted: s.stroop_aborted,
    rwt_aborted: s.rwt_aborted,
    epi_aborted: s.epi_aborted,
    gp_aborted: s.gp_aborted,
    uhr_aborted: s.uhr_aborted,
    cerad_wl_aborted: s.cerad_wl_aborted,
    cerad_mmst_aborted: s.cerad_mmst_aborted,
    cerad_benennen_aborted: s.cerad_benennen_aborted,
    cerad_wf_aborted: s.cerad_wf_aborted,
    cerad_tmt_aborted: s.cerad_tmt_aborted,
    cerad_fig_aborted: s.cerad_fig_aborted,
    cerad_tmt_a_aborted: s.cerad_tmt_a_aborted,
    cerad_tmt_b_aborted: s.cerad_tmt_b_aborted,
  };
  Object.entries(abortedMap).forEach(([k, v]) => {
    if (v && typeof v === "object") {
      row[k] = Object.values(v).some(Boolean) ? 1 : 0;
    } else {
      row[k] = v ? 1 : 0;
    }
  });

  // Epi Wortfl Notiz nicht vorhanden

  return row;
}

// Shared UI primitives moved to components/ui

// ---------- Minimal placeholder screens (runtime guards) ----------
function StopwatchScreen({ label, persisted, note, onPersist, onPersistNote, onAbort }) {
  const [comment, setComment] = useState(note || "");
  return (
    <section className="py-6">
      <Header title={label} />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="space-y-3">
        <Stopwatch persisted={persisted} onPersist={onPersist} />
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-700 w-24">Notiz</label>
          <input
            className="flex-1 rounded-xl border p-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onPersistNote && onPersistNote(comment)}
          />
        </div>
      </div>
    </section>
  );
}

const OptBtn = ({ selected, ok, onSelect, children, testid }) => (
  <button
    type="button"
    data-testid={testid}
    onPointerUp={() => { onSelect && onSelect("pointerup"); }}
    onClick={() => { onSelect && onSelect("click"); }}
    className={cls(
      "px-4 py-2 rounded-xl border text-base select-none inline-flex items-center gap-2",
      selected ? (ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200") : "bg-white border-zinc-300"
    )}
  >
    <span>{children}</span>
  </button>
);

function AttemptsRow({ title, seq1, seq2, val, onChange }) {
  const v = val && typeof val === "object" ? val : { v1: null, v2: null };
  const setPick = (k, value) => {
    onChange({ ...v, [k]: value });
  };

  const renderSegment = (which, label) => {
    const cur = v[which];
    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="font-medium tabular-nums text-zinc-800 truncate">{label}</div>
        <div className="flex items-center gap-3 shrink-0" aria-label={`Bewertung ${label}`}>
          <OptBtn testid={`${title}-${which}-ok`} ok selected={cur === 1} onSelect={() => setPick(which, 1)}>Richtig</OptBtn>
          <OptBtn testid={`${title}-${which}-no`} selected={cur === 0} onSelect={() => setPick(which, 0)}>Falsch</OptBtn>
        </div>
      </div>
    );
  };

  return (
    <div className="relative z-0 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <div className="sr-only">{title}</div>
      <div className="flex items-center justify-between gap-6">
        {renderSegment("v1", seq1)}
        <div className="w-px self-stretch bg-zinc-300/70" />
        {renderSegment("v2", seq2)}
      </div>
    </div>
  );
}

function ZahlenSpanneScreen({ label, sequences, persisted, extraActionLabel, onStateChange, onAbort, onExtraAction, onBackToSpanMenu }) {
  const pairs = useMemo(() => (sequences && sequences.length ? sequences : []), [sequences]);
  const [vals, setVals] = useState(() => {
    if (persisted?.vals && Array.isArray(persisted.vals) && persisted.vals.length === pairs.length) {
      return persisted.vals;
    }
    return pairs.map(() => ({ v1: null, v2: null }));
  });

  useEffect(() => {
    onStateChange && onStateChange({ label, rows: pairs, vals });
  }, [onStateChange, label, pairs, vals]);

  useEffect(() => {
    if (persisted?.vals && Array.isArray(persisted.vals) && persisted.vals.length === pairs.length) {
      setVals(persisted.vals);
      return;
    }
    setVals((prev) => {
      if (!Array.isArray(prev) || prev.length !== pairs.length) {
        return pairs.map((_, i) => prev?.[i] ?? { v1: null, v2: null });
      }
      return prev;
    });
  }, [pairs, persisted?.vals]);

  const longest = useMemo(() => {
    let max = 0;
    pairs.forEach((pair, idx) => {
      const ok = vals[idx] && (vals[idx].v1 === 1 || vals[idx].v2 === 1);
      if (ok) {
        const L = (pair[0] || "").split("-").filter(Boolean).length;
        if (L > max) max = L;
      }
    });
    return max;
  }, [pairs, vals]);

  return (
    <section className="py-6">
      <Header title={label} />
      <div className="mb-3 flex gap-2">
        <AbortButton onAbort={onAbort} />
        {onBackToSpanMenu && (
          <button
            type="button"
            onClick={onBackToSpanMenu}
            onTouchEnd={(e) => { e.preventDefault(); onBackToSpanMenu && onBackToSpanMenu(); }}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur Auswahl
          </button>
        )}
      </div>
      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <AttemptsRow
            key={idx}
            title={`${label} – Reihe ${idx + 1}`}
            seq1={pair[0]}
            seq2={pair[1]}
            val={vals[idx]}
            onChange={(nv) => setVals((xs) => {
              const base = Array.isArray(xs) ? xs : pairs.map(() => ({ v1: null, v2: null }));
              return base.map((x, i) => (i === idx ? nv : x));
            })}
          />
        ))}
      </div>
      <div className="mt-3 text-sm text-zinc-600">
        Längste korrekt reproduzierte Reihe: <span className="font-medium">{longest}</span>
      </div>
      {extraActionLabel && (
        <div className="mt-4">
          <button onClick={()=> onExtraAction && onExtraAction(longest)} className="px-3 py-2 rounded-xl border">{extraActionLabel}</button>
        </div>
      )}
    </section>
  );
}

function BlockSpanneScreen({ label, sequences, persisted, onStateChange, onAbort, onBackToSpanMenu }) {
  const pairs = useMemo(() => (sequences && sequences.length ? sequences : []), [sequences]);
  const [vals, setVals] = useState(() => {
    if (persisted?.vals && Array.isArray(persisted.vals) && persisted.vals.length === pairs.length) {
      return persisted.vals;
    }
    return pairs.map(() => ({ v1: null, v2: null }));
  });

  useEffect(() => {
    onStateChange && onStateChange({ label, rows: pairs, vals });
  }, [onStateChange, label, pairs, vals]);

  useEffect(() => {
    if (persisted?.vals && Array.isArray(persisted.vals) && persisted.vals.length === pairs.length) {
      setVals(persisted.vals);
      return;
    }
    setVals((prev) => {
      if (!Array.isArray(prev) || prev.length !== pairs.length) {
        return pairs.map((_, i) => prev?.[i] ?? { v1: null, v2: null });
      }
      return prev;
    });
  }, [pairs, persisted?.vals]);

  const longest = useMemo(() => {
    let max = 0;
    pairs.forEach((pair, idx) => {
      const ok = vals[idx] && (vals[idx].v1 === 1 || vals[idx].v2 === 1);
      if (ok) {
        const L = (pair[0] || "").split("-").filter(Boolean).length;
        if (L > max) max = L;
      }
    });
    return max;
  }, [pairs, vals]);

  return (
    <section className="py-6">
      <Header title={label} />
      <div className="mb-3 flex gap-2">
        <AbortButton onAbort={onAbort} />
        {onBackToSpanMenu && (
          <button
            type="button"
            onClick={onBackToSpanMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur Auswahl
          </button>
        )}
      </div>
      <div className="space-y-3">
        {pairs.map((pair, idx) => (
          <AttemptsRow
            key={idx}
            title={`${label} – Reihe ${idx + 1}`}
            seq1={pair[0]}
            seq2={pair[1]}
            val={vals[idx]}
            onChange={(nv) => setVals((xs) => {
              const base = Array.isArray(xs) ? xs : pairs.map(() => ({ v1: null, v2: null }));
              return base.map((x, i) => (i === idx ? nv : x));
            })}
          />
        ))}
      </div>
      <div className="mt-3 text-sm text-zinc-600">
        Längste korrekt reproduzierte Reihe: <span className="font-medium">{longest}</span>
      </div>
    </section>
  );
}

const RWT_MODES = {
  phon_simple: { title: "Einfache phonematische Wortflüssigkeit", options: ["P", "M"] },
  phon_complex: { title: "Komplexe phonematische Wortflüssigkeit", options: ["G-R", "H-T"] },
  sem_simple: { title: "Einfache semantische Wortflüssigkeit", options: ["Tiere", "Lebensmittel"] },
  sem_complex: { title: "Komplexe semantische Wortflüssigkeit", options: ["Sport - Obst", "Blumen - Kleidung"] },
};

function RWTModeMenu({ onSelect }) {
  return (
    <Card>
      <div className="grid md:grid-cols-2 gap-4">
        <button onClick={() => onSelect("phon_simple")} className="h-28 rounded-2xl border bg-white">Einfache phonematische Wortflüssigkeit</button>
        <button onClick={() => onSelect("phon_complex")} className="h-28 rounded-2xl border bg-white">Komplexe phonematische Wortflüssigkeit</button>
        <button onClick={() => onSelect("sem_simple")} className="h-28 rounded-2xl border bg-white">Einfache semantische Wortflüssigkeit</button>
        <button onClick={() => onSelect("sem_complex")} className="h-28 rounded-2xl border bg-white">Komplexe semantische Wortflüssigkeit</button>
      </div>
    </Card>
  );
}

function RWTTestPanel({ meta, modeKey, sessionData, onPersist, onClose }) {
  const persisted = (sessionData?.rwt || {})[modeKey] || {};
  const [opt, setOpt] = useState(persisted.version || meta.options[0]);
  const [notes, setNotes] = useState(persisted.notes || "");
  const [sum, setSum] = useState(typeof persisted.sum === "number" ? persisted.sum : (persisted.sum || ""));

  useEffect(() => {
    const p = (sessionData?.rwt || {})[modeKey] || {};
    setOpt(p.version || meta.options[0]);
    setNotes(p.notes || "");
    setSum(typeof p.sum === "number" ? p.sum : (p.sum || ""));
  }, [modeKey, sessionData, meta.options]);

  const persist = (patch) => onPersist && onPersist(modeKey, patch);

  return (
    <Card>
      <div className="text-center text-2xl font-semibold mb-2">{meta.title}</div>
      <div className="flex items-center justify-center gap-4 mb-3">
        {meta.options.map((o) => (
          <button
            key={o}
            onClick={() => { setOpt(o); persist({ version: o }); }}
            className={cls("px-5 py-2 rounded-xl border text-lg", opt === o ? "bg-zinc-100 border-zinc-300" : "bg-white border-zinc-300")}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="mt-4 grid md:grid-cols-2 gap-4 items-start">
        <div className="space-y-3 md:col-span-1">
          <Countdown60 />
        </div>
        <div className="space-y-2 md:col-span-1">
          <label className="block text-sm">Summe Wörter</label>
          <div className="flex items-stretch gap-3">
            <button
              type="button"
              onClick={() => {
                const next = Number(sum) || 0;
                const val = next + 1;
                setSum(val);
                persist({ sum: val });
              }}
              className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
            >
              +1 Wort
            </button>
            <input
              className="w-32 rounded-xl border px-3 text-lg h-16"
              placeholder="0"
              inputMode="numeric"
              value={sum}
              onChange={(e) => {
                const v = e.target.value;
                const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                setSum(n);
              }}
              onBlur={() => persist({ sum: sum === "" ? null : Number(sum) })}
            />
          </div>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm">Freihand-Mitschrift</label>
        <textarea
          className="mt-1 w-full rounded-xl border p-2 h-52"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => persist({ notes })}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl border bg-zinc-900 text-white text-sm">Fertig</button>
      </div>
    </Card>
  );
}

function RWTWire({ sessionData, onPersist, onAbort }) {
  const [mode, setMode] = useState(null); // null | modes
  return (
    <section className="py-6">
      <Header title="Wortflüssigkeit (RWT)" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      {mode === null ? (
        <RWTModeMenu onSelect={(m) => setMode(m)} />
      ) : (
        <RWTTestPanel
          meta={RWT_MODES[mode]}
          modeKey={mode}
          sessionData={sessionData}
          onPersist={onPersist}
          onClose={() => setMode(null)}
        />
      )}
    </section>
  );
}

function StroopWire({ sessionData, onPersistTime, onPersistNote, onAbort }) {
  const col1 = [
    "blau","grün","gelb","rot","grün","blau","gelb","rot","blau","gelb","grün","rot",
    "gelb","blau","grün","rot","gelb","grün","blau","rot","grün","blau","gelb","rot",
  ];
  const col2 = [
    "grün","gelb","blau","grün","rot","gelb","grün","rot","blau","grün","gelb","rot",
    "blau","gelb","rot","grün","gelb","blau","rot","gelb","blau","rot","grün","blau",
  ];
  const col3 = [
    "gelb","rot","blau","gelb","grün","rot","blau","grün","rot","gelb","blau","grün",
    "rot","blau","gelb","grün","blau","rot","gelb","blau","grün","gelb","rot","grün",
  ];
  const maxRows = Math.max(col1.length, col2.length, col3.length);

  const initialFails = sessionData?.stroop_notes?.interferenz_fails || {};
  const [fails, setFails] = useState(initialFails);
  useEffect(() => {
    setFails(initialFails);
  }, [initialFails]);

  const toggleFail = (key) => {
    setFails((prev) => {
      const cur = prev[key] ?? 0;
      const nextState = (cur + 1) % 3; // 0 ok, 1 fehler, 2 korrigiert
      const next = { ...prev, [key]: nextState };
      if (nextState === 0) delete next[key];
      onPersistNote && onPersistNote("interferenz_fails", next);
      return next;
    });
  };

  return (
    <section className="py-6">
      <Header title="Stroop" />
      <div className="mb-3">
        <AbortButton onAbort={(payload) => onAbort && onAbort("global", payload)} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {[
          { key: "woerter", label: "Wörter lesen" },
          { key: "farbstriche", label: "Farbstriche benennen" },
        ].map((t) => (
          <div key={t.key} className="p-3 rounded-2xl border bg-white space-y-2">
            <div className="font-medium mb-1">{t.label}</div>
            <Stopwatch
              persisted={sessionData?.stroop?.[t.key] ?? null}
              onPersist={(ms) => onPersistTime && onPersistTime(t.key, ms)}
            />
            <label className="block text-sm">Kommentar / Fehler</label>
            <input
              className="mt-1 w-full rounded-xl border px-3 py-2"
              value={sessionData?.stroop_notes?.[t.key] ?? ""}
              onChange={(e) => onPersistNote && onPersistNote(t.key, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="p-3 rounded-2xl border bg-white space-y-3">
          <div className="font-medium mb-1">Interferenz</div>
          <div className="grid md:grid-cols-3 gap-3 items-start">
            <div className="md:col-span-2 space-y-2">
              <div className="rounded-xl border bg-zinc-50 p-2 text-xs text-zinc-700">
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: maxRows }).map((_, idx) => {
                    const words = [col1[idx], col2[idx], col3[idx]];
                    return words.map((w, colIdx) => {
                      if (!w) return <div key={`empty-${colIdx}-${idx}`} />;
                      const key = `c${colIdx + 1}_${idx}`;
                      const cur = fails[key] ?? 0;
                      const label =
                        cur === 1 ? "F" : cur === 2 ? "F korr." : "F";
                      const clsBtn =
                        cur === 1
                          ? "bg-rose-50 border-rose-200 text-rose-700"
                          : cur === 2
                            ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-white";
                      return (
                        <div key={key} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 bg-white border">
                          <span className="font-mono">{w}</span>
                          <button
                            type="button"
                            className={`px-2 py-0.5 rounded-md border text-[11px] ${clsBtn}`}
                            onClick={() => toggleFail(key)}
                            title="Fehl-Nennung markieren/korrigieren"
                          >
                            {label}
                          </button>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>
            <div className="md:col-span-1 space-y-2">
              <Stopwatch
                persisted={sessionData?.stroop?.interferenz ?? null}
                onPersist={(ms) => onPersistTime && onPersistTime("interferenz", ms)}
              />
              <div>
                <label className="block text-sm">Kommentar / Fehler</label>
                <input
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={sessionData?.stroop_notes?.interferenz ?? ""}
                  onChange={(e) => onPersistNote && onPersistNote("interferenz", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GroovedPegboardWire({ sessionData, onPersistPanel, onAbort }) {
  const gp = sessionData?.gp || {};
  const [domHand, setDomHand] = useState(gp.dom_hand || "rechts"); // "links"|"rechts"
  useEffect(() => {
    setDomHand(gp.dom_hand || "rechts");
  }, [gp.dom_hand]);

  const persistHand = (handKey, patch) => {
    onPersistPanel && onPersistPanel(handKey, patch);
  };

  return (
    <section className="py-6">
      <Header title="Grooved Pegboard" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="mb-4 space-y-2">
        <div className="text-sm text-zinc-700">Dominante Hand:</div>
        <div className="flex gap-2">
          {["rechts", "links"].map((h) => (
            <button
              key={h}
              onClick={() => {
                setDomHand(h);
                onPersistPanel && onPersistPanel("meta", { dom_hand: h });
              }}
              className={cls("px-3 py-1.5 rounded-xl border text-sm", domHand === h ? "bg-emerald-50 border-emerald-200" : "bg-white")}
            >
              {h}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {[
          { key: "dom", label: domHand === "rechts" ? "Dominant (rechts)" : "Dominant (links)" },
          { key: "non", label: domHand === "rechts" ? "Nicht-dominant (links)" : "Nicht-dominant (rechts)" },
        ].map((panel) => (
          <Card key={panel.key} className="space-y-2">
            <div className="font-medium">{panel.label}</div>
            <Stopwatch
              persisted={gp[panel.key + "_ms"] ?? null}
              onPersist={(ms) => persistHand(panel.key, { ms })}
            />
            <div>
              <label className="block text-sm text-zinc-700">Notizen</label>
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                value={gp[panel.key + "_note"] || ""}
                onChange={(e) => persistHand(panel.key, { note: e.target.value })}
                placeholder="Notizen"
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function SpannenMenu({ statusMap, onOpen }) {
  const items = [
    { key: "zahl_fwd", label: "Zahlenspanne vorwärts" },
    { key: "zahl_rev", label: "Zahlenspanne rückwärts" },
    { key: "block_fwd", label: "Blockspanne vorwärts" },
    { key: "block_rev", label: "Blockspanne rückwärts" },
  ];
  return (
    <section className="py-6">
      <Header title="Zahlen- und Blockspanne" />
      <div className="mb-3">
      </div>
      <Card className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((i) => (
          <button
            key={i.key}
            onClick={() => onOpen && onOpen(i.key)}
            className="h-20 rounded-2xl border bg-white hover:bg-zinc-50 shadow-sm px-3 text-left flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{i.label}</div>
              {statusMap && statusMap[i.key] && (
                <div
                  className={cls(
                    "mt-1 inline-block px-2 py-0.5 rounded-full text-xs border",
                    statusMap[i.key] === "abgebrochen"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  )}
                >
                  {statusMap[i.key]}
                </div>
              )}
            </div>
            <span className="text-lg">→</span>
          </button>
        ))}
      </Card>
    </section>
  );
}

function UhrentestWire({ sessionData, onPersist, onAbort }) {
  const data = sessionData?.uhr || {};
  const derivePartsFromScore = (val) => {
    const s = typeof val === "number" ? Math.max(0, Math.min(5, val)) : 0;
    const parts = { kreis: false, nummern: false, zeiger: false };
    let remaining = s;
    if (remaining >= 1) { parts.kreis = true; remaining -= 1; }
    if (remaining >= 2) { parts.nummern = true; remaining -= 2; }
    if (remaining >= 2) { parts.zeiger = true; remaining -= 2; }
    return parts;
  };

  const [parts, setParts] = useState(() => data.parts || derivePartsFromScore(data.score));
  const [score, setScore] = useState(() => {
    if (typeof data.score === "number") return data.score;
    const p = data.parts || derivePartsFromScore(data.score);
    return (p.kreis ? 1 : 0) + (p.nummern ? 2 : 0) + (p.zeiger ? 2 : 0);
  });
  const [note, setNote] = useState(data.note || "");
  useEffect(() => {
    const nextParts = data.parts || derivePartsFromScore(data.score);
    setParts(nextParts);
    const nextScore = typeof data.score === "number"
      ? data.score
      : (nextParts.kreis ? 1 : 0) + (nextParts.nummern ? 2 : 0) + (nextParts.zeiger ? 2 : 0);
    setScore(nextScore);
    setNote(data.note || "");
  }, [data.score, data.note, data.parts]);

  const togglePart = (key, points) => {
    setParts((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const nextScore = (next.kreis ? 1 : 0) + (next.nummern ? 2 : 0) + (next.zeiger ? 2 : 0);
      setScore(nextScore);
      onPersist && onPersist({ score: nextScore, parts: next, note });
      return next;
    });
  };
  return (
    <section className="py-6">
      <Header title="Uhrentest" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="p-3 rounded-2xl border bg-white max-w-md space-y-3">
        <div className="text-sm text-zinc-700">Punkte: <span className="font-semibold">{score}</span> / 5</div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={() => togglePart("kreis", 1)}
            className={cls(
              "w-full text-left px-3 py-2 rounded-xl border text-sm",
              parts.kreis ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-zinc-300"
            )}
          >
            Kreis (1 Punkt)
          </button>
          <button
            type="button"
            onClick={() => togglePart("nummern", 2)}
            className={cls(
              "w-full text-left px-3 py-2 rounded-xl border text-sm",
              parts.nummern ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-zinc-300"
            )}
          >
            Nummern korrekt (2 Punkte)
          </button>
          <button
            type="button"
            onClick={() => togglePart("zeiger", 2)}
            className={cls(
              "w-full text-left px-3 py-2 rounded-xl border text-sm",
              parts.zeiger ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-zinc-300"
            )}
          >
            Zeiger korrekt (2 Punkte)
          </button>
        </div>
        <label className="block mt-2 text-sm">Kommentar</label>
        <input
          className="mt-1 w-full rounded-xl border p-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onPersist && onPersist({ score, note })}
        />
      </div>
    </section>
  );
}

function CERADMenu({ onOpen }) {
  const items = [
    { key: "cerad_mmst", label: "CERAD MMST" },
    { key: "cerad_wl", label: "CERAD Verbalgedächtnis" },
    { key: "cerad_benennen", label: "Boston Naming Test" },
    { key: "cerad_wf", label: "Wortflüssigkeit" },
    { key: "cerad_tmt", label: "CERAD TMT A/B" },
    { key: "cerad_fig", label: "Visuokonstruktion / Figuralgedächtnis" },
  ];
  return (
    <section className="py-6">
      <Header title="CERAD – Auswahl"/>
      <Card className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((i) => (
          <button
            key={i.key}
            onClick={() => onOpen && onOpen(i.key)}
            className="px-3 py-2 rounded-xl border text-left hover:bg-zinc-50"
          >
            {i.label}
          </button>
        ))}
      </Card>
    </section>
  );
}

function CERADWFWire({ sessionData, onPersist, onPersistNote, onAbort, onDone, onBackToMenu }) {
  const base = sessionData?.cerad_wf || {};
  const [semCount, setSemCount] = useState(base.semantic_count ?? "");
  const [semNote, setSemNote] = useState(base.semantic_note || "");
  const [phonCount, setPhonCount] = useState(base.phonemic_count ?? "");
  const [phonNote, setPhonNote] = useState(base.phonemic_note || "");
  const [totalNote, setTotalNote] = useState(base.note || "");

  useEffect(() => {
    setSemCount(base.semantic_count ?? "");
    setSemNote(base.semantic_note || "");
    setPhonCount(base.phonemic_count ?? "");
    setPhonNote(base.phonemic_note || "");
    setTotalNote(base.note || "");
  }, [base.semantic_count, base.semantic_note, base.phonemic_count, base.phonemic_note, base.note]);

  const persist = (patch) => onPersist && onPersist(patch);

  return (
    <section className="py-6">
      <Header title="CERAD – Wortflüssigkeit" />
      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="space-y-3">
          <div className="text-lg font-semibold">Semantisch – Tiere (60s)</div>
          <Countdown60 />
          <div>
            <label className="block text-sm text-zinc-700">Summe Wörter</label>
            <div className="flex items-stretch gap-3 mt-1">
              <button
                type="button"
                onClick={() => {
                  const next = Number(semCount) || 0;
                  const val = next + 1;
                  setSemCount(val);
                  persist({ semantic_count: val });
                }}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                +1 Wort
              </button>
              <input
                className="w-32 rounded-xl border px-3 text-lg h-16"
                placeholder="0"
                inputMode="numeric"
                value={semCount}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                  setSemCount(n);
                }}
                onBlur={() => persist({ semantic_count: semCount === "" ? null : Number(semCount) })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Notiz</label>
            <textarea
            className="mt-1 w-full rounded-xl border px-3 py-2 h-20"
              value={semNote}
              onChange={(e) => setSemNote(e.target.value)}
              onBlur={() => persist({ semantic_note: semNote })}
            />
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-lg font-semibold">Phonematisch – Buchstabe S (60s)</div>
          <Countdown60 />
          <div>
            <label className="block text-sm text-zinc-700">Summe Wörter</label>
            <div className="flex items-stretch gap-3 mt-1">
              <button
                type="button"
                onClick={() => {
                  const next = Number(phonCount) || 0;
                  const val = next + 1;
                  setPhonCount(val);
                  persist({ phonemic_count: val });
                }}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                +1 Wort
              </button>
              <input
                className="w-32 rounded-xl border px-3 text-lg h-16"
                placeholder="0"
                inputMode="numeric"
                value={phonCount}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                  setPhonCount(n);
                }}
                onBlur={() => persist({ phonemic_count: phonCount === "" ? null : Number(phonCount) })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Notiz</label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 h-20"
              value={phonNote}
              onChange={(e) => setPhonNote(e.target.value)}
              onBlur={() => persist({ phonemic_note: phonNote })}
            />
          </div>
        </Card>
      </div>


      <div className="mt-4">
        <button
          type="button"
          onClick={() => onDone && onDone()}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </button>
      </div>
    </section>
  );
}

// Timer model (doc comment only)
// type Timer = { id, label, type: "global_reminder"|"subtest_stopwatch", startTs, durationMs?, pausedMs?, pausedAt?, endedAt? }

// ---------- App Shell ----------
export default function App() {
  const authDisabled = import.meta.env?.VITE_DISABLE_AUTH === "true";
  const [authOK, setAuthOK] = useState(() => {
    if (typeof window === "undefined") return false;
    if (authDisabled) return true;
    return localStorage.getItem("auth_ok") === "true" || sessionStorage.getItem("auth_temp_ok") === "true";
  });
  const [authError, setAuthError] = useState("");
  const [showImpressum, setShowImpressum] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved === "true";
  });
  const [screen, setScreen] = useState(
    { name: "menu" } // many names: "vlmt","dcsr","cerad_wl","tmt_a","tmt_b","zahl_fwd","zahl_rev","block_fwd","block_rev","rwt","stroop","epi","gp","uhr","cerad_menu","cerad_mmst","cerad_benennen","cerad_wf"
  );

  const generateSessionId = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [sessionUUID, setSessionUUID] = useState(() => {
    const existing = localStorage.getItem("sessionUUID");
    if (existing) return existing;
    const gen = generateSessionId();
    localStorage.setItem("sessionUUID", gen);
    return gen;
  });

  const [globalTimers, setGlobalTimers] = useState([]); // only reminder timers live here
  const addGlobalReminder = (label, minutes, nav) => {
    const now = Date.now();
    const t = {
      id: (crypto && crypto.randomUUID ? crypto.randomUUID() : `t_${now}_${Math.random()}`),
      label,
      type: "global_reminder",
      startTs: now,
      durationMs: minutes * 60_000,
      pausedMs: 0,
      pausedAt: null,
      endedAt: null,
      nav: nav || null,
    };
    setGlobalTimers((xs) => [...xs, t]);
  };
  const clearGlobalTimer = (id) => setGlobalTimers((xs) => xs.filter((t) => t.id !== id));

  const newSession = async () => {
    const ok = window.confirm("Neue Testung starten? Alle aktuellen Eingaben werden gelöscht.");
    if (!ok) return;
    try {
      await idbDeleteDrawingNamespace(`${sessionUUID}:dcsr:`);
      await idbDel(sessionUUID);
    } catch (e) {
      console.error("IDB delete failed", e);
    }
    const nextId = generateSessionId();
    localStorage.setItem("sessionUUID", nextId);
    setSessionUUID(nextId);
    setGlobalTimers([]);
    setSessionData({});
    setScreen({ name: "menu" });
  };

  const [sessionData, setSessionData] = useState({});
  const latestStateRef = useRef({ screen, globalTimers, sessionData, sessionUUID });

  useEffect(() => {
    latestStateRef.current = { screen, globalTimers, sessionData, sessionUUID };
  }, [screen, globalTimers, sessionData, sessionUUID]);

  const persistNow = useCallback(() => {
    const { screen: s, globalTimers: g, sessionData: sd, sessionUUID: id } = latestStateRef.current;
    idbSet(id, { screen: s, globalTimers: g, sessionData: sd, lastUpdated: Date.now() }).catch((e) => {
      console.error("Persistenz speichern fehlgeschlagen", e);
    });
  }, []);
  // hydrate on mount
  useEffect(() => {
    // purge sessions older than 7 days and their drawings
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    idbPruneOldSessions(sevenDaysMs, (key) => {
      if (typeof key === "string") idbDeleteDrawingNamespace(`${key}:dcsr:`).catch(() => {});
    }).catch((e) => console.error("Alte Sessions bereinigen fehlgeschlagen", e));

    (async () => {
      try {
        const saved = await idbGet(sessionUUID);
        if (saved) {
          if (saved.screen) setScreen(normalizeScreen(saved.screen));
          if (saved.globalTimers) setGlobalTimers(saved.globalTimers);
          setSessionData(saved.sessionData || {});
        }
      } catch (e) {
        console.error("Persistenz laden fehlgeschlagen", e);
      }
    })();
  }, []);

  // Prune stale drawing blobs (keep only current session namespace)
  useEffect(() => {
    idbPruneDrawingsExcept([`${sessionUUID}:`]).catch((e) => console.error("Prune drawings failed", e));
  }, [sessionUUID]);
  // persist on changes (debounced)
  useEffect(() => {
    const h = setTimeout(persistNow, 300);
    return () => clearTimeout(h);
  }, [persistNow, sessionUUID, screen, globalTimers, sessionData]);

  // flush immediately when the tab is hidden or closed to reduce data loss risk
  useEffect(() => {
    const flush = () => persistNow();
    window.addEventListener("visibilitychange", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("visibilitychange", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [persistNow]);

  useEffect(() => {
    localStorage.setItem("darkMode", darkMode ? "true" : "false");
    if (darkMode) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [darkMode]);

  const passwordHash = (import.meta.env?.VITE_APP_PASSWORD_HASH || "e3f67bab0aaf4f97f50b6d999c89300f988ca9e34895207bf9e700591406e09c").toLowerCase();

  async function hashText(text) {
    const enc = new TextEncoder();
    const data = enc.encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const handleAuth = async (pwd, remember) => {
    setAuthError("");
    try {
      const h = await hashText(pwd);
      if (h === passwordHash) {
        // persist for this tab always; optionally persist across reloads
        sessionStorage.setItem("auth_temp_ok", "true");
        if (remember) localStorage.setItem("auth_ok", "true");
        else localStorage.removeItem("auth_ok");
        setAuthOK(true);
        setScreen({ name: "menu" });
        return;
      }
      setAuthError("Falsches Passwort");
    } catch (e) {
      console.error("Hashing failed", e);
      setAuthError("Fehler bei der Prüfung");
    }
  };

  const authScreen = (
    <div className={cls("min-h-screen flex flex-col items-center justify-center px-4", darkMode ? "bg-zinc-900 text-zinc-100" : "bg-zinc-50 text-zinc-900")}>
      <div className="w-full max-w-md p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm dark:bg-zinc-800 dark:border-zinc-700">
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg font-semibold">Zugang</div>
          <button
            onClick={() => setDarkMode((v) => !v)}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Bitte Passwort eingeben, um die Tests zu öffnen.</p>
        <PasswordPrompt onSubmit={handleAuth} error={authError} />
      </div>
      <button
        type="button"
        onClick={() => setShowImpressum(true)}
        className="mt-4 text-sm underline underline-offset-4"
      >
        Impressum
      </button>
      <ImpressumModal open={showImpressum} onClose={() => setShowImpressum(false)} />
    </div>
  );

  const triggerCsvExport = async () => {
    const row = await buildExportRow(sessionData, sessionUUID, { includeDrawings: false });
    const keys = Object.keys(row);
    const csv = [
      keys.join(";"),
      keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return "";
        const s = String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(";"),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const pat = (sessionData?.demographics?.patient_initials || "Pat").replace(/[^A-Za-z0-9_-]/g, "");
    const doc = (sessionData?.demographics?.examiner_initials || "NP").replace(/[^A-Za-z0-9_-]/g, "");
    a.download = `${pat}_${doc}_${sessionUUID}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerPdfExport = async () => {
    const drawingsData = await loadDcsrDrawings(sessionUUID, sessionData);
    const row = await buildExportRow(sessionData, sessionUUID, { includeDrawings: true, drawingsData });
    const drawings = Object.entries(row).filter(([k]) => k.startsWith("dcsr_drawing_") && row[k]);
    // Simple HTML print view
    const pat = (sessionData?.demographics?.patient_initials || "Pat").replace(/[^A-Za-z0-9_-]/g, "");
    const doc = (sessionData?.demographics?.examiner_initials || "NP").replace(/[^A-Za-z0-9_-]/g, "");
    const filename = `${pat}_${doc}_${sessionUUID}`;
    const win = window.open("", "_blank");
    if (!win) return;
    const style = `
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
      .draw-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
      .draw-card { border: 1px solid #ccc; padding: 8px; }
      img { max-width: 100%; height: auto; border: 1px solid #ddd; }
    `;
    const rowsHtml = Object.entries(row)
      .filter(([k]) => !k.startsWith("dcsr_drawing_"))
      .map(([k, v]) => `<tr><td>${k}</td><td>${v === null || v === undefined ? "" : v}</td></tr>`)
      .join("");
    const drawingsHtml = drawings
      .map(([k, v]) => `<div class="draw-card"><div style="font-size:12px;margin-bottom:4px;">${k}</div><img src="${v}" alt="${k}"/></div>`)
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>${filename}.pdf</title>
          <style>${style}</style>
        </head>
        <body>
          <h1>Neuropsychologische Testung</h1>
          <div class="meta">Export: ${new Date().toLocaleString()} · Session: ${sessionUUID}</div>
          <h2>Messwerte</h2>
          <table><tbody>${rowsHtml}</tbody></table>
          ${drawings.length ? `<h2>DCS-R Zeichnungen</h2><div class="draw-grid">${drawingsHtml}</div>` : ""}
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const statusMap = useMemo(() => {
    const m = {};
    const s = sessionData || {};
    const set = (k, l) => { m[k] = l; };

    // Helper: mark as fällig if a reminder exists that navigates to this screen
    const dueFor = (key) => (globalTimers || []).some((t) => t?.nav?.name === key && !t.endedAt);

    // VLMT / DCS-R (haben Reminder → "fällig")
    if (dueFor("vlmt")) set("vlmt", "fällig");
    else if (s.vlmt_aborted) set("vlmt", "abgebrochen");
    else if (s.vlmt) set("vlmt", "erfasst");

    if (dueFor("dcsr")) set("dcsr", "fällig");
    else if (s.dcsr_aborted) set("dcsr", "abgebrochen");
    else if (s.dcsr) set("dcsr", "erfasst");

    // Zahlenspanne / Blockspanne (aggregiert)
    const spanStates = [
      s.zahl_fwd, s.zahl_rev, s.block_fwd, s.block_rev,
    ];
    const spanAborts = [
      s.zahl_fwd_aborted, s.zahl_rev_aborted, s.block_fwd_aborted, s.block_rev_aborted,
    ];
    if (spanAborts.some(Boolean)) set("spannen_menu", "abgebrochen");
    else if (spanStates.some(Boolean)) set("spannen_menu", "erfasst");

    // TMT (kombiniert)
    const anyMainTmt = typeof s.tmt_a === 'number' || typeof s.tmt_b === 'number';
    const anyMainTmtAborted = s.tmt_a_aborted || s.tmt_b_aborted;
    if (anyMainTmtAborted) set("tmt_ab","abgebrochen"); else if (anyMainTmt) set("tmt_ab","erfasst");

    // Stroop (erfasst wenn mind. eine Zeit gespeichert)
    const stroopTimes = s.stroop || {};
    const anyStroop = Object.keys(stroopTimes).some((k) => typeof stroopTimes[k] === 'number');
    const anyStroopAborted = !!s.stroop_aborted && Object.values(s.stroop_aborted).some(Boolean);
    if (anyStroopAborted) set("stroop","abgebrochen"); else if (anyStroop) set("stroop","erfasst");

    // Epi-Track
    if (s.epi_aborted) set("epi","abgebrochen"); else if (s.epi && (s.epi.times || s.epi.inv_spanne)) set("epi","erfasst");

    // Grooved Pegboard
    if (s.gp_aborted) set("gp","abgebrochen"); else if (s.gp && (typeof s.gp.dom_ms === 'number' || typeof s.gp.non_ms === 'number')) set("gp","erfasst");

    // RWT
    const rwtData = s.rwt || {};
    const hasRwt = Object.keys(rwtData).some((k) => {
      const m = rwtData[k] || {};
      return m.sum !== undefined || m.version || m.notes;
    });
    if (s.rwt_aborted) set("rwt", "abgebrochen");
    else if (hasRwt) set("rwt", "erfasst");

    // Uhrentest
    if (s.uhr_aborted) set("uhr","abgebrochen"); else if (s.uhr && (s.uhr.score !== undefined || s.uhr.note)) set("uhr","erfasst");

    // CERAD
    if (s.cerad_wl_aborted) set("cerad_wl","abgebrochen"); else if (s.cerad_wl) set("cerad_wl","erfasst");
    if (s.cerad_mmst_aborted) set("cerad_mmst","abgebrochen"); else if (s.cerad_mmst) set("cerad_mmst","erfasst");
    if (s.cerad_benennen_aborted) set("cerad_benennen","abgebrochen"); else if (s.cerad_benennen) set("cerad_benennen","erfasst");
    if (s.cerad_wf_aborted) set("cerad_wf","abgebrochen"); else if (s.cerad_wf) set("cerad_wf","erfasst");
    const tmtTimes = s.cerad_tmt || {};
    const anyTmt = typeof tmtTimes.a_time === "number" || typeof tmtTimes.b_time === "number";
    if (s.cerad_tmt_aborted) set("cerad_tmt","abgebrochen"); else if (anyTmt) set("cerad_tmt","erfasst");
    if (s.cerad_fig_aborted) set("cerad_fig","abgebrochen"); else if (s.cerad_fig) set("cerad_fig","erfasst");

    // CERAD aggregated for main tile
    const ceradAborted = [
      s.cerad_wl_aborted,
      s.cerad_mmst_aborted,
      s.cerad_benennen_aborted,
      s.cerad_wf_aborted,
      s.cerad_tmt_aborted,
      s.cerad_fig_aborted,
      s.cerad_tmt_a_aborted,
      s.cerad_tmt_b_aborted,
    ].some(Boolean);
    const ceradAny =
      !!s.cerad_wl ||
      !!s.cerad_mmst ||
      !!s.cerad_benennen ||
      !!s.cerad_wf ||
      anyTmt ||
      !!s.cerad_tmt ||
      !!s.cerad_fig ||
      !!s.cerad_tmt_a ||
      !!s.cerad_tmt_b;
    if (ceradAborted) set("cerad_menu", "abgebrochen");
    else if (ceradAny) set("cerad_menu", "erfasst");

    return m;
  }, [sessionData, globalTimers]);

  if (!authOK) return authScreen;

  return (
    <ErrorBoundary onReset={() => setScreen({ name: "menu" })}>
      <div className={cls("min-h-screen font-sans antialiased", darkMode ? "bg-zinc-900 text-zinc-100" : "bg-zinc-50 text-zinc-900")}>
        <TopBar
          sessionUUID={sessionUUID}
          onBackToMenu={() => setScreen({ name: "menu" })}
          globalTimers={globalTimers}
          onClearTimer={clearGlobalTimer}
          onOpenTimer={(t) => { setScreen(t.nav || { name: "menu" }); clearGlobalTimer(t.id); }}
          onNewSession={newSession}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode((v) => !v)}
          sessionData={sessionData}
        onOpenCeradRecall={() => {
          setSessionData(s => ({
            ...s,
            cerad_wl: { ...(s.cerad_wl || {}), recall_pending: false }
          }));
          setScreen({ name: "cerad_wl", go: "dg4" });
        }}
       onOpenCeradFigRecall={() => {
        setSessionData((s) => ({
          ...s,
          cerad_fig: { ...(s.cerad_fig || {}), recall_pending: false }
        }));
        setScreen({ name: "cerad_fig", go: "recall" });
      }}
        onExportCsv={triggerCsvExport}
      />
        <main className="max-w-5xl mx-auto px-4 pb-24 pt-3">
        {screen.name === "menu" && (
          <TileMenu
            onOpen={(n) => setScreen({ name: n })}
            onOpenCERAD={() => setScreen({ name: "cerad_menu" })}
            statusMap={statusMap}
            disabled={!sessionData?.demographics_saved}
          />
        )}
        {screen.name === "menu" && (
          <DemoCapture
            demographics={sessionData?.demographics || {}}
            saved={!!sessionData?.demographics_saved}
            onSave={(payload) =>
              setSessionData((s) => ({
                ...s,
                demographics: { ...(s.demographics || {}), ...payload },
                demographics_saved: true,
              }))
            }
          />
        )}

          {screen.name === "vlmt" && (
            <VLMTWire
              addGlobalReminder={addGlobalReminder}
              route={screen}
              onDone={() => setScreen({ name: "menu" })}
              onStateChange={(data)=> setSessionData((s)=>({ ...s, vlmt: data }))}
              onAbort={(payload)=> setSessionData((s)=>({ ...s, vlmt_aborted: payload }))}
            />
          )}
        {screen.name === "dcsr" && (
          <DCSRWire
            addGlobalReminder={addGlobalReminder}
            route={screen}
            sessionData={sessionData}
            sessionUUID={sessionUUID}
            onStateChange={(data)=> setSessionData((s)=>({ ...s, dcsr: data }))}
            onAbort={(payload)=> setSessionData((s)=>({ ...s, dcsr_aborted: payload }))}
            onDone={() => setScreen({ name: "menu" })}
          />
        )}
          {screen.name === "cerad_wl" && (
            <CERADWordlistWire
              sessionData={sessionData}
              route={screen}
              onBackToMenu={() => setScreen({ name: "cerad_menu" })}
              onDone={() => setScreen({ name: "cerad_menu" })}
              onAfterDG3={() => setScreen({ name: "cerad_fig" })}
              onAfterRecog={() => {
                setSessionData((s) => ({
                  ...s,
                  cerad_wl: { ...(s.cerad_wl || {}), recall_pending: false },
                }));
                setScreen({ name: "cerad_fig", go: "recall" });
              }}
              onPersist={(patch) =>
                setSessionData((s) => ({
                  ...s,
                  cerad_wl: { ...(s.cerad_wl || {}), ...patch },
                }))
              }
              onAbort={(payload) =>
                setSessionData((s) => ({
                  ...s,
                  cerad_wl_aborted: payload,
                }))
              }
            />
          )}
        {screen.name === "tmt_ab" && (
          <TMTCombo
            sessionData={sessionData}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                ...patch,
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                tmt_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "menu" })}
          />
        )}

        {screen.name === "zahl_fwd" && (
          <ZahlenSpanneScreen
            label="Zahlenspanne vorwärts"
            sequences={ZS_FWD}
            persisted={sessionData?.zahl_fwd}
            onStateChange={(data)=> setSessionData((s)=>({ ...s, zahl_fwd: data }))}
            onAbort={(payload)=> setSessionData((s)=>({ ...s, zahl_fwd_aborted: payload }))}
            onBackToSpanMenu={() => setScreen({ name: "spannen_menu" })}
          />
        )}
        {screen.name === "zahl_rev" && (
          <ZahlenSpanneScreen
            label="Zahlenspanne rückwärts"
            sequences={ZS_REV}
            persisted={sessionData?.zahl_rev}
            extraActionLabel="→ an Epi-Track übernehmen"
            onStateChange={(data)=> setSessionData((s)=>({ ...s, zahl_rev: data }))}
            onAbort={(payload)=> setSessionData((s)=>({ ...s, zahl_rev_aborted: payload }))}
            onExtraAction={(longest)=> setSessionData((s)=>({ ...s, epi: { ...(s.epi||{}), inv_spanne: longest } }))}
            onBackToSpanMenu={() => setScreen({ name: "spannen_menu" })}
          />
        )}

        {screen.name === "block_fwd" && (
          <BlockSpanneScreen
            label="Blockspanne vorwärts"
            sequences={BS_FWD}
            persisted={sessionData?.block_fwd}
            onStateChange={(data)=> setSessionData((s)=>({ ...s, block_fwd: data }))}
            onAbort={(payload)=> setSessionData((s)=>({ ...s, block_fwd_aborted: payload }))}
            onBackToSpanMenu={() => setScreen({ name: "spannen_menu" })}
          />
        )}
        {screen.name === "block_rev" && (
          <BlockSpanneScreen
            label="Blockspanne rückwärts"
            sequences={BS_REV}
            persisted={sessionData?.block_rev}
            onStateChange={(data)=> setSessionData((s)=>({ ...s, block_rev: data }))}
            onAbort={(payload)=> setSessionData((s)=>({ ...s, block_rev_aborted: payload }))}
            onBackToSpanMenu={() => setScreen({ name: "spannen_menu" })}
          />
        )}
        {screen.name === "spannen_menu" && (
          <SpannenMenu
            statusMap={statusMap}
            onOpen={(n) => setScreen({ name: n })}
          />
        )}

        {screen.name === "rwt" && (
          <RWTWire
            sessionData={sessionData}
            onPersist={(mode, payload) =>
              setSessionData((s) => ({
                ...s,
                rwt: {
                  ...(s.rwt || {}),
                  [mode]: { ...((s.rwt || {})[mode] || {}), ...payload },
                },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                rwt_aborted: payload,
              }))
            }
          />
        )}
        {screen.name === "stroop" && (
          <StroopWire
            sessionData={sessionData}
            onPersistTime={(key, ms) =>
              setSessionData((s) => ({ ...s, stroop: { ...(s.stroop || {}), [key]: ms } }))
            }
            onPersistNote={(key, note) =>
              setSessionData((s) => ({ ...s, stroop_notes: { ...((s.stroop_notes)||{}), [key]: note } }))
            }
            onAbort={(key, payload) =>
              setSessionData((s) => ({ ...s, stroop_aborted: { ...((s.stroop_aborted)||{}), [key]: payload } }))
            }
          />
        )}
        {screen.name === "epi" && (
          <EpiTrackWire
            sessionData={sessionData}
            onImportInv={(val) =>
              setSessionData((s) => ({ ...s, epi: { ...(s.epi || {}), inv_spanne: val } }))
            }
            onPersistTime={(id, ms) =>
              setSessionData((s) => ({
                ...s,
                epi: { ...(s.epi || {}), times: { ...((s.epi || {}).times || {}), [id]: ms } },
              }))
            }
            onSendTmt={(key, ms) =>
              setSessionData((s) => ({
                ...s,
                [key]: ms,
              }))
            }
            onAbort={(payload)=> setSessionData((s)=>({ ...s, epi_aborted: payload }))}
          />
        )}
        {screen.name === "gp" && (
          <GroovedPegboardWire
            sessionData={sessionData}
            onPersistPanel={(panel, payload) =>
              setSessionData((s) => ({
                ...s,
                gp: {
                  ...(s.gp || {}),
                  ...(panel === "meta"
                    ? { dom_hand: payload?.dom_hand ?? s.gp?.dom_hand }
                    : {
                        [panel + '_ms']: payload?.ms ?? s.gp?.[panel + '_ms'] ?? null,
                        [panel + '_note']: payload?.note ?? s.gp?.[panel + '_note'] ?? "",
                      }),
                },
              }))
            }
          />
        )}
        {screen.name === "uhr" && (
          <UhrentestWire
            sessionData={sessionData}
            onPersist={(patch) => setSessionData((s) => ({ ...s, uhr: { ...(s.uhr||{}), ...patch } }))}
            onAbort={(payload) => setSessionData((s) => ({ ...s, uhr_aborted: payload }))}
          />
        )}

        {screen.name === "cerad_menu" && <CERADMenu onOpen={(n) => setScreen({ name: n })} />}
        {screen.name === "cerad_mmst" && (
          <MMSTWire
            sessionData={sessionData}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                cerad_mmst: { ...(s.cerad_mmst || {}), ...patch },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_mmst_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_wf" })}
            onBackToMenu={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_benennen" && (
          <BenennenWire
            sessionData={sessionData}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                cerad_benennen: { ...(s.cerad_benennen || {}), ...patch },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_benennen_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_wl" })}
            onBackToMenu={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_wf" && (
          <CERADWFWire
            sessionData={sessionData}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                cerad_wf: { ...(s.cerad_wf || {}), ...patch },
              }))
            }
            onPersistNote={(txt) =>
              setSessionData((s) => ({
                ...s,
                cerad_wf: { ...(s.cerad_wf || {}), note: txt },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_wf_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_benennen" })}
            onBackToMenu={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_fig" && (
          <CERADFiguralWire
            sessionData={sessionData}
            route={screen}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                cerad_fig: { ...(s.cerad_fig || {}), ...patch },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_fig_aborted: payload,
              }))
            }
            onAfterDraw={() => setScreen({ name: "cerad_tmt" })}
            onAfterRecall={() => {
              setSessionData((s) => ({
                ...s,
                cerad_fig: { ...(s.cerad_fig || {}), recall_pending: false },
              }));
              setScreen({ name: "cerad_menu" });
            }}
            onDone={() => setScreen({ name: "cerad_menu" })}
            onBackToMenu={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_tmt" && (
          <CERADTmtCombo
            sessionData={sessionData}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt: { ...(s.cerad_tmt || {}), ...patch },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_wl", go: "dg4" })}
            onBackToMenu={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_tmt_a" && (
          <CERADTmtScreen
            label="CERAD – TMT-A"
            persisted={sessionData?.cerad_tmt_a?.time ?? null}
            note={sessionData?.cerad_tmt_a?.note ?? ""}
            onPersist={(ms) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_a: { ...(s.cerad_tmt_a || {}), time: ms },
              }))
            }
            onPersistNote={(txt) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_a: { ...(s.cerad_tmt_a || {}), note: txt },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_a_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_menu" })}
          />
        )}
        {screen.name === "cerad_tmt_b" && (
          <CERADTmtScreen
            label="CERAD – TMT-B"
            persisted={sessionData?.cerad_tmt_b?.time ?? null}
            note={sessionData?.cerad_tmt_b?.note ?? ""}
            onPersist={(ms) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_b: { ...(s.cerad_tmt_b || {}), time: ms },
              }))
            }
            onPersistNote={(txt) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_b: { ...(s.cerad_tmt_b || {}), note: txt },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                cerad_tmt_b_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_menu" })}
          />
        )}

        <DevSelfTests />
      </main>
      <div className="max-w-5xl mx-auto px-4 pb-6 -mt-4">
        <button
          type="button"
          onClick={() => setShowImpressum(true)}
          className="text-sm underline underline-offset-4"
        >
          Impressum
        </button>
      </div>
      <ImpressumModal open={showImpressum} onClose={() => setShowImpressum(false)} />
    </div>
    </ErrorBoundary>
  );
}

// ---------- Dev Self-Tests (placeholder to avoid runtime error) ----------
function DevSelfTests() {
  // Referenced in layout; currently no self-tests implemented.
  return null;
}

// ---------- Error Boundary ----------
// ErrorBoundary now lives in components/error-boundary

// AbortButton now lives in components/abort-button

// ---------- Top Bar ----------
function TopBar({
  sessionUUID,
  onBackToMenu,
  globalTimers,
  onClearTimer,
  onOpenTimer,
  onNewSession,
  darkMode,
  onToggleDark,
  sessionData,
  onOpenCeradRecall,
  onOpenCeradFigRecall,
  onExportCsv,
}) {
  return (
    <div id="topbar-root" className="sticky top-0 z-30 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
        <button
          onClick={onBackToMenu}
          onTouchEnd={(e) => { e.preventDefault(); onBackToMenu && onBackToMenu(); }}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-sm"
        >
          Übersicht
        </button>
        <div className="text-xs text-zinc-600">Session: {sessionUUID.slice(0, 8)}…</div>
        <div className="ml-auto flex items-center gap-2">
          {sessionData?.cerad_wl?.recall_pending && (
            <button
              onClick={onOpenCeradRecall}
              onTouchEnd={(e) => { e.preventDefault(); onOpenCeradRecall && onOpenCeradRecall(); }}
              className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-sm"
            >
              CERAD-Verbalgedächtnis – Abruf starten
            </button>
          )}
          {sessionData?.cerad_fig?.recall_pending && (
            <button
              onClick={onOpenCeradFigRecall}
              onTouchEnd={(e) => { e.preventDefault(); onOpenCeradFigRecall && onOpenCeradFigRecall(); }}
              className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-sm"
            >
              CERAD Figuralgedächtnis – Abruf starten
            </button>
          )}
          <button
            className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-sm"
            onClick={onExportCsv}
          >
            CSV Export
          </button>
          <button
            type="button"
            onClick={onNewSession}
            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm"
          >
            Neue Testung
          </button>
          <button
            type="button"
            onClick={onToggleDark}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
          <GlobalTimers timers={globalTimers} onClear={onClearTimer} onOpen={onOpenTimer} />
        </div>
      </div>
    </div>
  );
}
// ---------- Debug Overlay ----------
function DebugOverlay() {
  const panelRef = useRef(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [stack, setStack] = useState([]); // elementsFromPoint summary
  const [targetInfo, setTargetInfo] = useState(null);
  const [highlight, setHighlight] = useState(null); // {x,y,w,h}
  const [topbarRect, setTopbarRect] = useState(null);

  useEffect(() => {
    const tb = document.getElementById("topbar-root");
    if (tb) {
      const r = tb.getBoundingClientRect();
      setTopbarRect({ x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom });
    }
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      const x = e.clientX, y = e.clientY;
      setCursor({ x, y });
      const arr = (document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)].filter(Boolean));
      const items = arr.slice(0, 6).map((el) => {
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          cls: el.className ? String(el.className).trim().slice(0, 80) : "",
          z: cs.zIndex,
          pe: cs.pointerEvents,
          pos: cs.position,
          id: el.id || "",
        };
      });
      setStack(items);
    };
    const onClick = (e) => {
      if (panelRef.current && panelRef.current.contains(e.target)) return; // ignore clicks on panel
      const el = e.target;
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      setTargetInfo({
        tag: el.tagName.toLowerCase(), id: el.id || "", cls: el.className ? String(el.className) : "",
        z: cs.zIndex, pe: cs.pointerEvents, pos: cs.position, vis: cs.visibility, op: cs.opacity,
      });
      setHighlight({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  // Pointer event logging
  useEffect(() => {
    const onPD = (e) => { console.debug("[diag] pointerdown", e.target?.tagName?.toLowerCase(), e.target?.className || ""); };
    const onPU = (e) => { console.debug("[diag] pointerup", e.target?.tagName?.toLowerCase(), e.target?.className || ""); };
    const onCLK = (e) => { console.debug("[diag] click", e.target?.tagName?.toLowerCase(), e.target?.className || ""); };
    window.addEventListener("pointerdown", onPD, true);
    window.addEventListener("pointerup", onPU, true);
    window.addEventListener("click", onCLK, true);
    return () => {
      window.removeEventListener("pointerdown", onPD, true);
      window.removeEventListener("pointerup", onPU, true);
      window.removeEventListener("click", onCLK, true);
    };
  }, []);

  const overlapTopbar = topbarRect ? (cursor.y >= topbarRect.y && cursor.y <= topbarRect.b && cursor.x >= topbarRect.x && cursor.x <= topbarRect.x + topbarRect.w) : false;

  return (
    <>
      {/* highlight box */}
      {highlight && (
        <div style={{ position: "fixed", left: highlight.x, top: highlight.y, width: highlight.w, height: highlight.h, pointerEvents: "none", zIndex: 9998, boxShadow: "0 0 0 2px rgba(244,63,94,0.9) inset, 0 0 0 2px rgba(244,63,94,0.9)" }} />
      )}
      {/* topbar outline */}
      {topbarRect && (
        <div style={{ position: "fixed", left: topbarRect.x, top: topbarRect.y, width: topbarRect.w, height: topbarRect.h, pointerEvents: "none", zIndex: 9997, boxShadow: "inset 0 0 0 2px rgba(59,130,246,0.75)" }} />
      )}
      {/* info panel */}
      <div ref={panelRef} className="fixed bottom-3 right-3 z-[9999] w-[360px] max-w-[95vw] p-3 rounded-2xl border bg-white/95 shadow-lg backdrop-blur">
        <div className="text-sm font-medium mb-2">Diagnose</div>
        <div className="text-xs text-zinc-700 space-y-1">
          <div>Cursor: {Math.round(cursor.x)},{Math.round(cursor.y)} {overlapTopbar ? <span className="ml-2 text-blue-700">(über TopBar)</span> : null}</div>
          {topbarRect && (
            <div>TopBar: y={Math.round(topbarRect.y)} b={Math.round(topbarRect.b)} h={Math.round(topbarRect.h)}</div>
          )}
          {targetInfo && (
            <div className="mt-1">
              <div className="font-semibold">Zuletzt geklickt:</div>
              <div>tag: {targetInfo.tag} #{targetInfo.id}</div>
              <div>class: <span className="break-all">{targetInfo.cls}</span></div>
              <div>z-index: {targetInfo.z} · pointer-events: {targetInfo.pe} · position: {targetInfo.pos}</div>
              <div>visibility: {targetInfo.vis} · opacity: {targetInfo.op}</div>
            </div>
          )}
          <div className="mt-2">
            <div className="font-semibold">Stack @ Cursor (oben→unten):</div>
            <ol className="list-decimal pl-5 space-y-0.5 max-h-56 overflow-auto">
              {stack.map((s, i) => (
                <li key={i} className="break-all">
                  {s.tag}{s.id ? `#${s.id}` : ""}{s.cls ? "." : ""}{s.cls}
                  <span className="text-zinc-500"> · z:{s.z} · pe:{s.pe} · pos:{s.pos}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function GlobalTimers({ timers, onClear, onOpen }) {
  return (
    <div className="flex gap-2">
      {timers.map((t) => (
        <ReminderPill
          key={t.id}
          timer={t}
          onClear={() => onClear(t.id)}
          onOpen={() => onOpen && onOpen(t)}
        />
      ))}
    </div>
  );
}

function ReminderPill({ timer, onClear, onOpen }) {
  const initialNowRef = useRef(null);
  if (initialNowRef.current === null) initialNowRef.current = Date.now();
  const [now, setNow] = useState(initialNowRef.current);
  useInterval(() => setNow(Date.now()), 250);
  const remaining = Math.max(0, (timer.startTs + (timer.durationMs ?? 0)) - now);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const done = remaining <= 0;
  return (
    <div
      className={cls(
        "px-3 py-1.5 rounded-xl border text-sm flex items-center gap-2",
        done ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-zinc-100 border-zinc-200 text-zinc-700"
      )}
    >
      <span className="font-medium">{timer.label}</span>
      <span>{done ? "fällig" : `${mm}:${ss.toString().padStart(2, "0")}`}</span>
      {timer.nav && (
        <button onClick={onOpen} className="px-2 py-0.5 rounded-lg bg-white border text-xs">
          Öffnen
        </button>
      )}
      <button onClick={onClear} className="px-2 py-0.5 rounded-lg bg-white border text-xs">
        Entfernen
      </button>
    </div>
  );
}

// ---------- Tile Menu ----------
function TileMenu({ onOpen, onOpenCERAD, statusMap, disabled }) {
  const tiles = [
    { key: "vlmt", label: "VLMT" },
    { key: "dcsr", label: "DCS-R" },
    { key: "epi", label: "Epi-Track" },
    { key: "tmt_ab", label: "TMT A und B" },
    { key: "spannen_menu", label: "Zahlen- und Blockspanne" },
    { key: "rwt", label: "Wortflüssigkeit (RWT)" },
    { key: "stroop", label: "Stroop" },
    { key: "gp", label: "Grooved Pegboard" },
    { key: "cerad_menu", label: "CERAD plus" },
    { key: "uhr", label: "Uhrentest" },
  ];
  return (
    <div className="py-6">
      <h1 className="text-2xl font-semibold mb-4">Neue Session – Tests auswählen</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <button
            key={t.label}
            onClick={() => (t.key === "cerad_menu" ? onOpenCERAD() : onOpen(t.key))}
            disabled={disabled}
            className={cls(
              "tile-btn h-24 rounded-2xl border border-zinc-200 bg-white active:scale-[0.99] transition shadow-sm flex items-center justify-center text-center px-3 text-zinc-900",
              disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-50"
            )}
          >
            <div className="text-center">
              <div className="text-lg font-medium">{t.label}</div>
                {statusMap && statusMap[t.key] && (
                  <div
                    className={cls(
                      "mt-1 inline-block px-2 py-0.5 rounded-full text-xs border",
                      statusMap[t.key] === "abgebrochen"
                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700"
                        : statusMap[t.key] === "fällig"
                          ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700"
                    )}
                  >
                    {statusMap[t.key]}
                  </div>
                )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoCapture({ demographics, saved, onSave }) {
  const { patient_initials = "", patient_gender = "", examiner_initials = "" } = demographics;
  const [local, setLocal] = useState({ patient_initials, patient_gender, examiner_initials });

  useEffect(() => {
    setLocal({ patient_initials, patient_gender, examiner_initials });
  }, [patient_initials, patient_gender, examiner_initials]);

  if (saved) return null;

  return (
    <div className="mb-4">
      <Card className="space-y-2">
        <div className="text-sm font-semibold">Basisdaten (nur einmalig pro Session)</div>
        <div className="grid md:grid-cols-3 gap-2">
          <div>
            <label className="block text-sm text-zinc-700">Patienten-Initialen</label>
            <input
              className="mt-1 w-full rounded-xl border p-2"
              value={local.patient_initials}
              onChange={(e) => setLocal((l) => ({ ...l, patient_initials: e.target.value }))}
              placeholder="z. B. AB"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Geschlecht</label>
            <select
              className="mt-1 w-full rounded-xl border p-2 bg-white"
              value={local.patient_gender}
              onChange={(e) => setLocal((l) => ({ ...l, patient_gender: e.target.value }))}
            >
              <option value="">Bitte wählen …</option>
              <option value="w">weiblich</option>
              <option value="m">männlich</option>
              <option value="d">divers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Initialen Neuropsycholog:in</label>
            <input
              className="mt-1 w-full rounded-xl border p-2"
              value={local.examiner_initials}
              onChange={(e) => setLocal((l) => ({ ...l, examiner_initials: e.target.value }))}
              placeholder="z. B. CD"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { onSave(local); }}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Speichern
          </button>
        </div>
      </Card>
    </div>
  );
}

// ---------- VLMT Wireframe ----------
function VLMTWire({ addGlobalReminder, route, onDone, onStateChange, onAbort }) {
  const [step, setStep] = useState("choose"); // "list" | "score" | "interf" | "dg6" | "waiting" | "dg7" | "rekog"
  const [list, setList] = useState(null); // "A"|"B"|"C"|"D"
  useEffect(() => {
    if (route && route.name === "vlmt" && route.go === "dg7") {
      if (!list && route.list) setList(route.list);
      setStep("dg7");
    }
  }, [route]);

  const words = useMemo(() => {
    if (!list) return [];
    const source = VLMT_LISTS[list];
    return source && source.length ? source : Array.from({ length: 15 }, (_, i) => `${list}-Wort ${i + 1}`);
  }, [list]);

  const [dg, setDG] = useState(1); // DG1..5
  // per-step scoring: selected words (boolean) and perseverations per word (number)
  const [sel, setSel] = useState({});
  const [pers, setPers] = useState({});
  const [intrusions, setIntrusions] = useState("");
  const [results, setResults] = useState(
    Array.from({ length: 7 }, () => ({ sel: {}, pers: {}, intrusions: "" }))
  );

  const resetScoring = () => {
    setSel({});
    setPers({});
    setIntrusions("");
  };

  const commitCurrent = (index) => {
    setResults((rs) => {
      const copy = rs.slice();
      copy[index] = { sel: { ...sel }, pers: { ...pers }, intrusions };
      return copy;
    });
  };

  const loadFrom = (index) => {
    const r = results[index] || { sel: {}, pers: {}, intrusions: "" };
    setSel(r.sel || {});
    setPers(r.pers || {});
    setIntrusions(r.intrusions || "");
  };

  function nextDG() {
    // commit DG1..5 index (dg-1)
    commitCurrent(dg - 1);
    if (dg < 5) {
      setDG(dg + 1);
      resetScoring();
      setStep("list");
    } else {
      resetScoring();
      setStep("interf");
    }
  }

  const interferenzList = VLMT_INTERFERENCE;
  const rekogItems = useMemo(() => (list ? (VLMT_RECOG[list] || []) : []), [list]);
  const [rekogSel, setRekogSel] = useState({}); // key: index -> boolean
  const rekogHits = useMemo(() => rekogItems.reduce((a, it, i) => a + ((rekogSel[i] && it.t) ? 1 : 0), 0), [rekogItems, rekogSel]);
  const rekogFP = useMemo(() => rekogItems.reduce((a, it, i) => a + ((rekogSel[i] && !it.t) ? 1 : 0), 0), [rekogItems, rekogSel]);

  useEffect(() => {
    if (step === "score") loadFrom(dg - 1);
    if (step === "dg6") loadFrom(5);
    if (step === "dg7") loadFrom(6);
  }, [step, dg]);

  useEffect(() => {
    onStateChange && onStateChange({ step, list, dg, results, rekog: { sel: rekogSel, items: rekogItems } });
  }, [onStateChange, step, list, dg, results, rekogSel, rekogItems]);

  return (
    <section className="py-6">
      <Header title="VLMT" />
      <div className="mb-3"><AbortButton onAbort={onAbort} /></div>

      {step === "choose" && (
        <Card>
          <p className="mb-3">Wähle Wortliste:</p>
          <div className="flex gap-2">
            {["A", "B", "C", "D"].map((L) => (
              <button
                key={L}
                onClick={() => {
                  setList(L);
                  setStep("list");
                  setDG(1);
                }}
                className="px-3 py-2 rounded-xl border"
              >
                VLMT-{L}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "list" && (
        <Card>
          <SectionTitle>Vorlesen – Liste VLMT-{list}</SectionTitle>
          <ul className="grid grid-cols-3 gap-2 text-zinc-700">
            {words.map((w) => (
              <li key={w} className="px-3 py-2 rounded-lg bg-zinc-100 border border-zinc-200">
                {w}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <button onClick={() => { setStep("score"); }} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">
              Weiter: Scoring DG{dg}
            </button>
            <button onClick={() => setStep("choose")} className="px-3 py-2 rounded-xl border">
              Zurück
            </button>
          </div>
        </Card>
      )}

      {step === "score" && (
        <Card>
          <SectionTitle>DG{dg} – Scoring</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {words.map((w) => {
              const active = !!sel[w];
              const p = pers[w] || 0;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setSel((m) => {
                      const next = { ...m, [w]: !m[w] };
                      return next;
                    });
                    setPers((m) => (!sel[w] ? m : { ...m, [w]: 0 }));
                  }}
                  className={cls(
                    "h-12 rounded-xl border bg-white flex items-center justify-between px-3",
                    active && "bg-emerald-50 border-emerald-200"
                  )}
                >
                  <span className="text-left pr-2 truncate">{w}</span>
                  <span className="flex items-center gap-1">
                    {active && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPers((m) => ({ ...m, [w]: (m[w] || 0) + 1 }));
                        }}
                        className="px-2 py-0.5 rounded-md border text-xs bg-white"
                        title="Perseveration +1"
                      >
                        P{p > 0 ? `(${p})` : ""}
                      </button>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="block mt-3 text-sm">Intrusionen / FP</label>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-1 rounded-xl border p-2 h-20"
            placeholder="frei…"
          />
          <div className="flex gap-2 mt-4">
            <button onClick={nextDG} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">
              Weiter
            </button>
            <button onClick={resetScoring} className="px-3 py-2 rounded-xl border">
              Zurücksetzen
            </button>
          </div>
        </Card>
      )}

      {step === "interf" && (
        <Card>
          <SectionTitle>Interferenzliste – Vorlesen & Scoring</SectionTitle>
          <ul className="grid grid-cols-3 gap-2 text-zinc-700">
            {interferenzList.map((w) => (
              <li key={w} className="px-3 py-2 rounded-lg bg-zinc-100 border border-zinc-200">
                {w}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => {
                setStep("dg6");
                resetScoring();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter zu DG6
            </button>
          </div>
        </Card>
      )}

      {step === "dg6" && (
        <Card>
          <SectionTitle>DG6 – Abfrage ohne Vorlesen</SectionTitle>
          <p className="text-sm text-zinc-600 mb-2">Scoring identisch zu DG1–5 (ohne erneutes Vorlesen).</p>
          <div className="grid grid-cols-3 gap-2">
            {words.map((w) => {
              const active = !!sel[w];
              const p = pers[w] || 0;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setSel((m) => {
                      const next = { ...m, [w]: !m[w] };
                      return next;
                    });
                    setPers((m) => (!sel[w] ? m : { ...m, [w]: 0 }));
                  }}
                  className={cls(
                    "h-12 rounded-xl border bg-white flex items-center justify-between px-3",
                    active && "bg-emerald-50 border-emerald-200"
                  )}
                >
                  <span className="text-left pr-2 truncate">{w}</span>
                  <span className="flex items-center gap-1">
                    {active && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPers((m) => ({ ...m, [w]: (m[w] || 0) + 1 }));
                        }}
                        className="px-2 py-0.5 rounded-md border text-xs bg-white"
                        title="Perseveration +1"
                      >
                        P{p > 0 ? `(${p})` : ""}
                      </button>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="block mt-3 text-sm">Intrusionen / FP</label>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-1 rounded-xl border p-2 h-20"
            placeholder="frei…"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { commitCurrent(5); addGlobalReminder("VLMT DG7", 30, { name: "vlmt", go: "dg7", list }); setStep("waiting"); }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              30-Min. Reminder starten
            </button>
            <button onClick={resetScoring} className="px-3 py-2 rounded-xl border">Zurücksetzen</button>
          </div>
        </Card>
      )}

      {step === "waiting" && (
        <Card>
          <SectionTitle>Wartephase bis DG7</SectionTitle>
          <p className="text-sm text-zinc-600">
            Der Reminder läuft oben rechts. Du kannst andere Tests durchführen und später zu VLMT
            zurückkehren.
          </p>
          <div className="mt-4">
            <button onClick={() => setStep("dg7")} className="px-3 py-2 rounded-xl border">
              DG7 jetzt durchführen
            </button>
          </div>
        </Card>
      )}

      {step === "dg7" && (
        <Card>
          <SectionTitle>DG7 – verzögerter Abruf</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {words.map((w) => {
              const active = !!sel[w];
              const p = pers[w] || 0;
              return (
                <button
                  key={w}
                  onClick={() => {
                    setSel((m) => {
                      const next = { ...m, [w]: !m[w] };
                      return next;
                    });
                    setPers((m) => (!sel[w] ? m : { ...m, [w]: 0 }));
                  }}
                  className={cls(
                    "h-12 rounded-xl border bg-white flex items-center justify-between px-3",
                    active && "bg-emerald-50 border-emerald-200"
                  )}
                >
                  <span className="text-left pr-2 truncate">{w}</span>
                  <span className="flex items-center gap-1">
                    {active && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPers((m) => ({ ...m, [w]: (m[w] || 0) + 1 }));
                        }}
                        className="px-2 py-0.5 rounded-md border text-xs bg-white"
                        title="Perseveration +1"
                      >
                        P{p > 0 ? `(${p})` : ""}
                      </button>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <label className="block mt-3 text-sm">Intrusionen / FP</label>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-1 rounded-xl border p-2 h-20"
            placeholder="frei…"
          />
          <div className="mt-4">
            <button
              onClick={() => { commitCurrent(6); setStep("rekog"); }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: Wiedererkennen
            </button>
          </div>
        </Card>
      )}

      {step === "rekog" && (
        <Card>
          <SectionTitle>Wiedererkennen</SectionTitle>
          {!list && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 mb-2">
              Hinweis: Bitte zunächst eine VLMT-Liste wählen, um die korrekte Wiedererkennungsliste zu laden.
            </div>
          )}
          <p className="text-sm text-zinc-600">Markiere die Wörter, die der Patient als "gesehen" benennt. Treffer zählen nur für Originalwörter der gewählten Liste, ansonsten Fehler.</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {rekogItems.map((it, i) => (
              <button
                key={`${it.w}_${i}`}
                onClick={() => setRekogSel((m) => ({ ...m, [i]: !m[i] }))}
                className={cls(
                  "flex items-center justify-between border rounded-xl px-3 py-2 bg-white",
                  rekogSel[i] && (it.t ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")
                )}
                title={it.t ? "Originalwort (Treffer bei Auswahl)" : "Lure (Fehler bei Auswahl)"}
              >
                <span>{it.w}</span>
                {rekogSel[i] && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-white border">
                    {it.t ? "Treffer" : "Fehler"}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="mt-4 text-sm text-zinc-700">
            Treffer: <span className="font-medium">{rekogHits}</span> · Fehler: <span className="font-medium">{rekogFP}</span>
          </div>
          <div className="mt-4">
            <button
              onClick={() => (onDone ? onDone() : null)}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig
            </button>
          </div>
        </Card>
      )}
    </section>
  );

}

// ---------- DCS-R Wireframe ----------
function DCSRWire({ addGlobalReminder, route, sessionData, sessionUUID, onStateChange, onAbort, onDone }) {
  const saved = sessionData?.dcsr || {};
  const [step, setStep] = useState(saved.step || "choose"); // "dg" | "waiting" | "rekog"
  const [ver, setVer] = useState(saved.ver || null); // "V1"|"V2"
  const [dg, setDG] = useState(saved.dg || 1);
  const [counts, setCounts] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      richtig: 0,
      falsch: 0,
      gedreht: 0,
      perseveration: 0,
      ...(saved.counts?.[i] || {}),
    }))
  );
  const drawingNamespace = useMemo(() => `${sessionUUID}:dcsr:`, [sessionUUID]);
  const initialKeys = useMemo(() => {
    if (Array.isArray(saved.drawingKeys) && saved.drawingKeys.length) return saved.drawingKeys;
    if (Array.isArray(saved.drawings) && saved.drawings.length) {
      return saved.drawings.map((_, idx) => `${drawingNamespace}dg${idx + 1}`);
    }
    return Array.from({ length: 5 }, () => null);
  }, [saved.drawingKeys, saved.drawings, drawingNamespace]);
  const drawingKeysRef = useRef(initialKeys);
  const [drawingKeysVersion, bumpDrawingKeysVersion] = useState(0); // used to trigger effect when keys mutate
  const [drawings, setDrawings] = useState(() => Array.from({ length: 5 }, () => null));
  const [rekogResp, setRekogResp] = useState(() => saved.rekog?.responses || { korrekt: 0, falsch: 0, gedreht: 0 });
  const totalFirst3 = counts.slice(0, 3).reduce((a, c) => a + c.richtig, 0);
  const ceilingHit = counts.some((c) => c.richtig === 9);
  const figSrc = ver === "V2" ? "/material/DCS-2.png" : "/material/DCS-1.png";

  function inc(field) {
    setCounts((xs) => {
      const copy = xs.slice();
      copy[dg - 1] = { ...copy[dg - 1], [field]: copy[dg - 1][field] + 1 };
      return copy;
    });
  }

  useEffect(() => {
    if (route && route.name === "dcsr" && route.go === "rekog") {
      setStep("rekog");
    }
  }, [route]);

  // Migrate legacy embedded drawings into the drawings store
  useEffect(() => {
    if (!Array.isArray(saved.drawings) || saved.drawings.length === 0) return;
    const keys = drawingKeysRef.current.slice();
    (async () => {
      await Promise.all(saved.drawings.map(async (data, idx) => {
        if (!data) return;
        const key = keys[idx] || `${drawingNamespace}dg${idx + 1}`;
        keys[idx] = key;
        await idbSetDrawing(key, data);
      }));
      drawingKeysRef.current = keys;
      setDrawings((arr) => {
        const next = arr.slice();
        saved.drawings.forEach((d, i) => { if (d) next[i] = d; });
        return next;
      });
      bumpDrawingKeysVersion((v) => v + 1);
      onStateChange && onStateChange({
        step,
        ver,
        dg,
        counts,
        drawingKeys: keys,
        rekog: { responses: rekogResp },
      });
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Load drawings for current session from IDB
  useEffect(() => {
    const keys = drawingKeysRef.current;
    (async () => {
      const loaded = await Promise.all(keys.map((k) => (k ? idbGetDrawing(k) : null)));
      setDrawings((arr) => {
        const next = arr.slice();
        loaded.forEach((d, i) => { if (d) next[i] = d; });
        return next;
      });
      // prune drawings from old sessions to avoid quota bloat
      idbPruneDrawingsExcept([`${sessionUUID}:`]).catch((e) => console.error("Prune drawings failed", e));
    })();
  }, [sessionUUID, drawingKeysVersion]);

  useEffect(() => {
    onStateChange && onStateChange({
      step,
      ver,
      dg,
      counts,
      drawingKeys: drawingKeysRef.current,
      rekog: { responses: rekogResp },
    });
  }, [onStateChange, step, ver, dg, counts, rekogResp, drawingKeysVersion]);

  const handleDrawingChange = useCallback(async (data) => {
    const key = drawingKeysRef.current[dg - 1] || `${drawingNamespace}dg${dg}`;
    drawingKeysRef.current[dg - 1] = key;
    setDrawings((arr) => {
      const next = arr.slice();
      next[dg - 1] = data;
      return next;
    });
    try {
      if (data) await idbSetDrawing(key, data);
      else await idbDeleteDrawing(key);
      bumpDrawingKeysVersion((v) => v + 1);
    } catch (e) {
      console.error("Zeichnung speichern fehlgeschlagen", e);
    }
  }, [dg, drawingNamespace]);

  return (
    <section className="py-6">
      <Header title="DCS-R" />
      <div className="mb-3"><AbortButton onAbort={onAbort} /></div>
      {step === "choose" && (
        <Card>
          <p className="mb-3">Wähle Version:</p>
          <div className="flex gap-2">
            {["V1", "V2"].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setVer(v);
                  setStep("dg");
                }}
                className="px-3 py-2 rounded-xl border"
              >
                {v}
              </button>
            ))}
          </div>
        </Card>
      )}

      {step === "dg" && (
        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle>Durchgang {dg} – Scoring</SectionTitle>
            <div className="text-sm text-zinc-600">Version: {ver}</div>
          </div>
          {ver && (
            <div className="mt-2">
              <div className="text-xs text-zinc-600 mb-1">Orientierung – korrekte Figur (Version {ver})</div>
              <img
                src={figSrc}
                alt={`DCS-R Vorlage Version ${ver}`}
                className="w-full rounded-xl border"
              />
              <div className="mt-3 space-y-1">
                <div className="text-xs text-zinc-600">Skizze der vom Patienten gelegten Figur</div>
                <DrawPad
                  key={`dcsr-dg-${dg}`}
                  width={820}
                  height={360}
                  initialData={drawings[dg - 1]}
                  onChange={handleDrawingChange}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <Counter label="Richtig" val={counts[dg - 1].richtig} onPlus={() => inc("richtig")} max={9} />
            <Counter label="Falsch" val={counts[dg - 1].falsch} onPlus={() => inc("falsch")} />
            <Counter label="Gedreht" val={counts[dg - 1].gedreht} onPlus={() => inc("gedreht")} />
            <Counter label="Perseveration" val={counts[dg - 1].perseveration} onPlus={() => inc("perseveration")} />
          </div>

          {dg <= 3 && totalFirst3 <= 1 && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              Niedrige Lernleistung in DG1–3 (≤1 richtig).{" "}
              <button className="ml-2 underline">Testabbruch hervorheben</button>
            </div>
          )}

          {counts[dg - 1].richtig === 9 && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              Ceiling erreicht (9/9). Verbleibende DG werden automatisch mit 9 Punkten gefüllt.
            </div>
          )}

          <div className="flex gap-2 mt-4">
            {dg < 5 && !ceilingHit && (
              <button onClick={() => setDG(dg + 1)} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">
                Weiter zu DG{dg + 1}
              </button>
            )}
            {(dg === 5 || ceilingHit) && (
              <button
                onClick={() => {
                  addGlobalReminder("DCS Rekognition", 30, { name: "dcsr", go: "rekog" });
                  setStep("waiting");
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
              >
                30-Min. Reminder für Rekognition
              </button>
            )}
          </div>
        </Card>
      )}

      {step === "waiting" && (
        <Card>
          <SectionTitle>Wartephase bis Rekognition</SectionTitle>
          <p className="text-sm text-zinc-600">
            Reminder läuft oben rechts. Du kannst andere Tests durchführen und später zurückkehren.
          </p>
          <button onClick={() => setStep("rekog")} className="mt-4 px-3 py-2 rounded-xl border">
            Rekognition jetzt durchführen
          </button>
        </Card>
      )}

      {step === "rekog" && (
        <Card>
          <SectionTitle>Rekognitionsdurchgang</SectionTitle>
          <div className="p-3 rounded-2xl border bg-white mt-2 space-y-3">
            <div className="flex flex-wrap gap-3">
              {[
                { key: "korrekt", label: "korrekt", color: "bg-emerald-50 border-emerald-200" },
                { key: "falsch", label: "falsch", color: "bg-rose-50 border-rose-200" },
                { key: "gedreht", label: "gedreht", color: "bg-amber-50 border-amber-200" },
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() =>
                    setRekogResp((r) => ({
                      ...r,
                      [btn.key]: Number(r?.[btn.key] || 0) + 1,
                    }))
                  }
                  className={`px-6 py-3 rounded-xl border text-base ${btn.color}`}
                >
                  +1 {btn.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <CounterCard label="korrekt" value={rekogResp.korrekt ?? 0} onDec={() => setRekogResp((r) => ({ ...r, korrekt: Math.max(0, Number(r?.korrekt || 0) - 1) }))} />
              <CounterCard label="falsch" value={rekogResp.falsch ?? 0} onDec={() => setRekogResp((r) => ({ ...r, falsch: Math.max(0, Number(r?.falsch || 0) - 1) }))} />
              <CounterCard label="gedreht" value={rekogResp.gedreht ?? 0} onDec={() => setRekogResp((r) => ({ ...r, gedreht: Math.max(0, Number(r?.gedreht || 0) - 1) }))} />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border text-sm"
                onClick={() => setRekogResp({ korrekt: 0, falsch: 0, gedreht: 0 })}
              >
                Zurücksetzen
              </button>
            </div>
          </div>
          <div className="mt-4">
            <button
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
              onClick={() => onDone && onDone()}
            >
              Fertig
            </button>
          </div>
        </Card>
      )}
    </section>
  );
}

function Counter({ label, val, onPlus, max }) {
  const disabled = typeof max === "number" && val >= max;
  return (
    <div className="p-3 rounded-xl border bg-white flex items-center justify-between">
      <div>
        <div className="text-sm text-zinc-600">{label}</div>
        <div className="text-2xl font-semibold">{val}</div>
      </div>
      <button
        disabled={disabled}
        onClick={onPlus}
        className={cls("px-3 py-2 rounded-xl border", disabled && "opacity-40 cursor-not-allowed")}
      >
        +1
      </button>
    </div>
  );
}

// ---------- MMST Helpers & Structure ----------

// Struktur aller MMST-Bereiche und Items (30 Punkte)
const MMST_STRUCTURE = {
  zeit: ["Jahr", "Jahreszeit", "Datum", "Wochentag", "Monat"],
  ort: ["Land", "Bundesland", "Stadt", "Gebäude", "Etage"],
  einpraegen: ["Zitrone", "Schlüssel", "Ball"],
  buchstabieren: { label: "PREIS rückwärts buchstabieren", max: 5 },
  erinnern: ["Zitrone (Recall)", "Schlüssel (Recall)", "Ball (Recall)"],
  benennen: ["Bleistift", "Uhr"],
  nachsprechen: ["Bitte keine Wenn und Aber"],
  lesen_ausfuehren: ["Schließen Sie die Augen"],
  handlung: ["Nehmen Sie das Blatt in die rechte Hand", "Falten Sie das Blatt mit beiden Händen", "Legen Sie das Blatt auf Ihren Schoss"],
  schreiben: ["Satz schreiben"],
  figur: ["Figur abzeichnen"],
};

// Punkteberechnung
function computeMmstTotal(items) {
  if (!items) return 0;
  let sum = 0;

  const simpleBlocks = [
    "zeit",
    "ort",
    "einpraegen",
    "erinnern",
    "benennen",
    "nachsprechen",
    "lesen_ausfuehren",
    "handlung",
    "schreiben",
    "figur",
  ];

  for (const block of simpleBlocks) {
    const obj = items[block] || {};
    for (const k of Object.keys(obj)) sum += obj[k] ? 1 : 0;
  }

  // Spezialfall: PREIS rückwärts (0–5 Punkte)
  sum += Math.max(0, Math.min(5, Number(items?.buchstabieren ?? 0)));

  return sum;
}

// UI-Toggle: 0/1-Scorer
function MmstToggle({ value, onChange, label }) {
  return (
    <button
      onClick={() => onChange(value ? 0 : 1)}
      className={cls(
        "px-3 py-2 rounded-xl border flex justify-between",
        value ? "bg-emerald-50 border-emerald-200" : "bg-white border-zinc-300"
      )}
    >
      <span>{label}</span>
      {value ? <span>✔️</span> : <span>✖️</span>}
    </button>
  );
}

// UI-Zähler: 0–5 Punkte (Buchstabieren)
function MmstCounter({ value, onChange, max = 5, label }) {
  return (
    <div className="p-3 rounded-xl border bg-white flex items-center justify-between">
      <div>{label}</div>
      <div className="flex gap-2 items-center">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="px-3 py-1.5 rounded-xl border"
        >
          −
        </button>
        <div className="font-bold w-6 text-center">{value}</div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-3 py-1.5 rounded-xl border"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ---------- CERAD MMST (interaktive Version, kompakt) ----------
function MMSTWire({ sessionData, onPersist, onAbort, onDone, onBackToMenu }) {
  const mmst = sessionData?.cerad_mmst || {};
  const items = mmst.items || {};
  const note = mmst.note || "";
  const total = computeMmstTotal(items);

  const updateBlockItem = (block, label, val) => {
    const nextBlock = { ...(items[block] || {}), [label]: val };
    const nextItems = { ...items, [block]: nextBlock };
    onPersist && onPersist({ items: nextItems, total: computeMmstTotal(nextItems) });
  };

  const updateBuchstabieren = (val) => {
    const v = Math.max(0, Math.min(5, Number(val || 0)));
    const nextItems = { ...items, buchstabieren: v };
    onPersist && onPersist({ items: nextItems, total: computeMmstTotal(nextItems) });
  };

  const updateNote = (txt) => {
    onPersist && onPersist({ note: txt });
  };

  return (
    <section className="py-6">
      <Header title="CERAD – MMST" />
      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}

      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <SectionTitle>Gesamtscore</SectionTitle>
            <div className="text-3xl font-semibold tabular-nums">{total} / 30</div>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm">Allgemeine Notiz (MMST)</label>
            <input
              className="mt-1 w-full rounded-xl border p-2"
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              placeholder="z. B. Besonderheiten, Verständnisprobleme …"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>1. Orientierung – Zeit (5 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {MMST_STRUCTURE.zeit.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.zeit && items.zeit[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("zeit", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>2. Orientierung – Ort (5 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {MMST_STRUCTURE.ort.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.ort && items.ort[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("ort", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>3. Einprägen (3 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {MMST_STRUCTURE.einpraegen.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.einpraegen && items.einpraegen[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("einpraegen", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>4. Aufmerksamkeit – PREIS rückwärts (0–5 Punkte)</SectionTitle>
        <div className="p-3 rounded-xl border bg-white space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-zinc-600">{MMST_STRUCTURE.buchstabieren.label}</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateBuchstabieren(Math.max(0, Number(items.buchstabieren ?? 0) - 1))}
                className="px-3 py-1.5 rounded-xl border"
              >
                −
              </button>
              <div className="text-2xl font-semibold w-10 text-center">{Number(items.buchstabieren ?? 0)}</div>
              <button
                onClick={() => updateBuchstabieren(Math.min(MMST_STRUCTURE.buchstabieren.max, Number(items.buchstabieren ?? 0) + 1))}
                className="px-3 py-1.5 rounded-xl border"
              >
                +1
              </button>
            </div>
          </div>
          <div>
            <input
              className="mt-1 w-full rounded-xl border p-2"
              value={mmst.buchstabieren_note || ""}
              onChange={(e) => onPersist && onPersist({ buchstabieren_note: e.target.value })}
              placeholder="SIERP"
            />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>5. Erinnern (3 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {MMST_STRUCTURE.erinnern.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.erinnern && items.erinnern[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("erinnern", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>6. Benennen (2 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-2 gap-2 mt-2">
          {MMST_STRUCTURE.benennen.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.benennen && items.benennen[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("benennen", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>7. Nachsprechen (1 Punkt)</SectionTitle>
        {MMST_STRUCTURE.nachsprechen.map((label) => (
          <MmstToggle
            key={label}
            label={label}
            value={(items.nachsprechen && items.nachsprechen[label]) ? 1 : 0}
            onChange={(v) => updateBlockItem("nachsprechen", label, v)}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>8. Lesen & Ausführen (1 Punkt)</SectionTitle>
        {MMST_STRUCTURE.lesen_ausfuehren.map((label) => (
          <MmstToggle
            key={label}
            label={label}
            value={(items.lesen_ausfuehren && items.lesen_ausfuehren[label]) ? 1 : 0}
            onChange={(v) => updateBlockItem("lesen_ausfuehren", label, v)}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>9. Dreiteilige Handlung (3 Punkte)</SectionTitle>
        <div className="grid md:grid-cols-3 gap-2 mt-2">
          {MMST_STRUCTURE.handlung.map((label) => (
            <MmstToggle
              key={label}
              label={label}
              value={(items.handlung && items.handlung[label]) ? 1 : 0}
              onChange={(v) => updateBlockItem("handlung", label, v)}
            />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>10. Satz schreiben (1 Punkt)</SectionTitle>
        {MMST_STRUCTURE.schreiben.map((label) => (
          <MmstToggle
            key={label}
            label={label}
            value={(items.schreiben && items.schreiben[label]) ? 1 : 0}
            onChange={(v) => updateBlockItem("schreiben", label, v)}
          />
        ))}
      </Card>

      <Card>
        <SectionTitle>11. Figur abzeichnen (1 Punkt)</SectionTitle>
        {MMST_STRUCTURE.figur.map((label) => (
          <MmstToggle
            key={label}
            label={label}
            value={(items.figur && items.figur[label]) ? 1 : 0}
            onChange={(v) => updateBlockItem("figur", label, v)}
          />
        ))}
      </Card>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onDone && onDone()}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </button>
      </div>
    </section>
  );
}

// ---------- CERAD Benenn-Leistung ----------
function BenennenWire({ sessionData, onPersist, onAbort, onDone, onBackToMenu }) {
  const base = sessionData?.cerad_benennen || {};

  const initialItems = React.useMemo(() => {
    const fromSession = Array.isArray(base.items) ? base.items : null;
    if (fromSession && fromSession.length === CERAD_BENENNEN_LABELS.length) {
      // sicherstellen, dass alle Felder vorhanden sind
      return fromSession.map((it, idx) => ({
        id: idx,
        label: CERAD_BENENNEN_LABELS[idx],
        correct: typeof it.correct === "boolean" ? it.correct : null,
        note: typeof it.note === "string" ? it.note : "",
      }));
    }
    return CERAD_BENENNEN_LABELS.map((label, idx) => ({
      id: idx,
      label,
      correct: null,
      note: "",
    }));
  }, [base.items]);

  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + (it.correct === true ? 1 : 0), 0),
    [items]
  );

  const updateItems = (updater) => {
    setItems((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const newTotal = next.reduce((acc, it) => acc + (it.correct === true ? 1 : 0), 0);
      onPersist && onPersist({ items: next, total: newTotal });
      return next;
    });
  };

  const handleToggle = (idx, value) => {
    updateItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              // erneutes Klicken auf die gleiche Option hebt die Auswahl auf
              correct: it.correct === value ? null : value,
            }
          : it
      )
    );
  };

  return (
    <section className="py-6">
      <Header
        title="CERAD – Boston Naming Test"
      />

      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}

      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <SectionTitle>Gesamtscore</SectionTitle>
            <div className="text-3xl font-semibold tabular-nums">{total} / 15</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Einzelitems (1 Punkt pro korrekt benanntem Bild)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          {items.map((it, idx) => (
            <div key={it.id} className="p-3 rounded-2xl border bg-white flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{it.label}</div>
                <div className="flex gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggle(idx, true)}
                    className={cls(
                      "px-3 py-1.5 rounded-xl border",
                      it.correct === true
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-zinc-300"
                    )}
                  >
                    Richtig
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(idx, false)}
                    className={cls(
                      "px-3 py-1.5 rounded-xl border",
                      it.correct === false
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-white border-zinc-300"
                    )}
                  >
                    Falsch
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-600">Notiz</label>
                <input
                  className="w-full rounded-xl border p-2 text-sm"
                  value={it.note}
                  onChange={(e) =>
                    updateItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, note: e.target.value } : p))
                    )
                  }
                  onBlur={() => {
                    const next = items.map((p, i) => (i === idx ? { ...p, note: it.note } : p));
                    const newTotal = next.reduce((acc, n) => acc + (n.correct === true ? 1 : 0), 0);
                    onPersist && onPersist({ items: next, total: newTotal });
                  }}
                  placeholder="Falschbenennung..."
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {onDone && (
        <div className="mt-4">
          <button
            type="button"
            onClick={onDone}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Weiter
          </button>
        </div>
      )}
    </section>
  );
}

const CERAD_WORDLIST = [
  "Butter",
  "Arm",
  "Strand",
  "Brief",
  "Königin",
  "Hütte",
  "Stange",
  "Karte",
  "Gras",
  "Motor",
];

// CERAD Wiedererkennen-Liste (aus CERAD-PDF)
const CERAD_WL_RECOG_ITEMS = [
  { word: "Kirche", isOrig: false },
  { word: "Kaffee", isOrig: false },
  { word: "Butter", isOrig: true },
  { word: "Dollar", isOrig: false },
  { word: "Arm", isOrig: true },
  { word: "Strand", isOrig: true },
  { word: "Fünf", isOrig: false },
  { word: "Brief", isOrig: true },
  { word: "Hotel", isOrig: false },
  { word: "Berg", isOrig: false },
  { word: "Königin", isOrig: true },
  { word: "Hütte", isOrig: true },
  { word: "Pantoffel", isOrig: false },
  { word: "Stange", isOrig: true },
  { word: "Dorf", isOrig: false },
  { word: "Band", isOrig: false },
  { word: "Karte", isOrig: true },
  { word: "Heer", isOrig: false },
  { word: "Gras", isOrig: true },
  { word: "Motor", isOrig: true },
];

// ---------- CERAD Visuokonstruktion / Figuralgedächtnis ----------
const CERAD_FIGS = [
  {
    key: "kreis",
    label: "Figur 1 – Kreis",
    max: 2,
    criteria: [
      "a) geschlossener Kreis (Lücken ≤ 3 Millimeter)",
      "b) annähernd kreisförmig",
    ],
  },
  {
    key: "rhombus",
    label: "Figur 2 – Rhombus",
    max: 3,
    criteria: [
      "a) vier Seiten vorhanden",
      "b) geschlossene Linien (Lücken ≤ 3 Millimeter)",
      "c) Seiten alle etwa gleich lang",
    ],
  },
  {
    key: "rechtecke",
    label: "Figur 3 – Rechtecke",
    max: 2,
    criteria: [
      "a) beide Figuren haben vier Seiten",
      "b) überschneidende Rechtecke sehen dem Original ähnlich",
    ],
  },
  {
    key: "wuerfel",
    label: "Figur 4 – Würfel",
    max: 4,
    criteria: [
      "a) Figur ist dreidimensional",
      "b) Frontseite korrekt orientiert (egal ob links- oder rechtsorientiert)",
      "c) innere Linien sind korrekt gezeichnet",
      "d) gegenüberliegende Seiten parallel (±10°)",
    ],
  },
];

function CERADFiguralWire({ sessionData, route, onPersist, onAbort, onDone, onBackToMenu, onAfterDraw, onAfterRecall }) {
  const [step, setStep] = useState("draw"); // "draw" | "recall"
  const base = sessionData?.cerad_fig || {};

  useEffect(() => {
    if (route?.go === "recall") setStep("recall");
  }, [route]);

  const scoresDraw = base.draw_scores || {};
  const scoresRecall = base.recall_scores || {};
  const critDrawPersisted = base.draw_criteria || {};
  const critRecallPersisted = base.recall_criteria || {};
  const [noteDraw, setNoteDraw] = useState(base.draw_note || "");
  const [noteRecall, setNoteRecall] = useState(base.recall_note || "");

  const buildCriteriaState = (scores, critPersisted) =>
    CERAD_FIGS.reduce((acc, fig) => {
      if (Array.isArray(critPersisted?.[fig.key])) {
        // normalize to booleans, capped to max criteria length
        acc[fig.key] = fig.criteria.map((_, idx) => !!critPersisted[fig.key][idx]);
      } else {
        const filled = Math.max(0, Math.min(fig.max, Number(scores?.[fig.key]) || 0));
        acc[fig.key] = fig.criteria.map((_, idx) => idx < filled);
      }
      return acc;
    }, {});

  const [critDraw, setCritDraw] = useState(() => buildCriteriaState(scoresDraw, critDrawPersisted));
  const [critRecall, setCritRecall] = useState(() => buildCriteriaState(scoresRecall, critRecallPersisted));

  useEffect(() => {
    setNoteDraw(base.draw_note || "");
    setNoteRecall(base.recall_note || "");
    setCritDraw(buildCriteriaState(base.draw_scores || {}, base.draw_criteria || {}));
    setCritRecall(buildCriteriaState(base.recall_scores || {}, base.recall_criteria || {}));
  }, [base.draw_note, base.recall_note, base.draw_scores, base.recall_scores, base.draw_criteria, base.recall_criteria]);

  const updateScore = (phase, figKey, val) => {
    const key = phase === "draw" ? "draw_scores" : "recall_scores";
    const prev = phase === "draw" ? scoresDraw : scoresRecall;
    onPersist &&
      onPersist({
        [key]: { ...prev, [figKey]: val },
      });
  };

  const updateNote = (phase, val) => {
    const key = phase === "draw" ? "draw_note" : "recall_note";
    onPersist && onPersist({ [key]: val });
  };

  const renderFigCard = (phase, fig) => {
    const current = (phase === "draw" ? scoresDraw : scoresRecall)[fig.key];
    const critState = phase === "draw" ? critDraw : critRecall;
    const setCrit = phase === "draw" ? setCritDraw : setCritRecall;
    const toggles = critState[fig.key] || fig.criteria.map(() => false);

    const toggleCriterion = (idx) => {
      const next = toggles.slice();
      next[idx] = !next[idx];
      const nextScore = Math.min(fig.max, next.filter(Boolean).length);
      setCrit((prev) => ({ ...prev, [fig.key]: next }));
      const keyScore = phase === "draw" ? "draw_scores" : "recall_scores";
      const keyCrit = phase === "draw" ? "draw_criteria" : "recall_criteria";
      const prevScores = phase === "draw" ? scoresDraw : scoresRecall;
      const prevCrit = phase === "draw" ? critDraw : critRecall;
      onPersist &&
        onPersist({
          [keyScore]: { ...prevScores, [fig.key]: nextScore },
          [keyCrit]: { ...prevCrit, [fig.key]: next },
        });
    };

    return (
      <Card key={`${phase}_${fig.key}`} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{fig.label}</div>
          <div className="text-sm text-zinc-600">
            Punkte: <span className="font-semibold">{(current ?? 0)}/{fig.max}</span>
          </div>
        </div>
        <div className="grid gap-2">
          {fig.criteria.map((c, idx) => {
            const active = toggles[idx];
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleCriterion(idx)}
                className={cls(
                  "w-full text-left px-3 py-2 rounded-xl border text-sm",
                  active ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-zinc-300"
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <section className="py-6">
      <Header
        title="CERAD – Visuokonstruktion / Figuralgedächtnis"
      />
      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}
      <div className="mb-3 flex items-center justify-between gap-3">
        <AbortButton onAbort={onAbort} />
      </div>

      {step === "draw" && (
        <>
          <SectionTitle>Figuren abzeichnen</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {CERAD_FIGS.map((f) => renderFigCard("draw", f))}
          </div>
          <div className="mt-3">
            <label className="block text-sm text-zinc-700">Notiz (Abzeichnen)</label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 h-20"
              value={noteDraw}
              onChange={(e) => setNoteDraw(e.target.value)}
              onBlur={() => updateNote("draw", noteDraw)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: true });
                if (onAfterDraw) onAfterDraw();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Erinnerung für Abruf setzen
            </button>
            <button
              type="button"
              onClick={() => setStep("recall")}
              className="px-3 py-2 rounded-xl border"
            >
              Direkt zum Abruf
            </button>
          </div>
        </>
      )}

      {step === "recall" && (
        <>
          <SectionTitle>Figuren erinnern</SectionTitle>
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {CERAD_FIGS.map((f) => renderFigCard("recall", f))}
          </div>
          <div className="mt-3">
            <label className="block text-sm text-zinc-700">Notiz (Erinnern)</label>
            <textarea
              className="mt-1 w-full rounded-xl border px-3 py-2 h-20"
              value={noteRecall}
              onChange={(e) => setNoteRecall(e.target.value)}
              onBlur={() => updateNote("recall", noteRecall)}
            />
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: false });
                if (onAfterRecall) onAfterRecall();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function CERADTmtScreen({ label, persisted, note, onPersist, onPersistNote, onAbort, onDone }) {
  const [comment, setComment] = useState(note || "");
  const isA = label.toLowerCase().includes("tmt-a");
  const autoLimit = isA ? 180_000 : 300_000;
  const handleAutoAbort = (info) => {
    const limit = autoLimit;
    onPersist && onPersist(limit);
    onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: limit, at: info?.at || Date.now(), part: isA ? "A" : "B" });
  };
  return (
    <section className="py-6">
      <Header title={label} />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="space-y-3">
        <Stopwatch
          persisted={persisted}
          onPersist={onPersist}
          autoAbortMs={autoLimit}
          onAutoAbort={handleAutoAbort}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-zinc-700 w-24">Notiz</label>
          <input
            className="flex-1 rounded-xl border p-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onPersistNote && onPersistNote(comment)}
          />
        </div>
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onDone && onDone()}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Fertig
          </button>
        </div>
      </div>
    </section>
  );
}

function CERADTmtCombo({ sessionData, onPersist, onAbort, onDone, onBackToMenu }) {
  const data = sessionData?.cerad_tmt || {};
  const [step, setStep] = useState("a"); // "a" | "b"
  const [noteA, setNoteA] = useState(data.note_a || "");
  const [noteB, setNoteB] = useState(data.note_b || "");

  useEffect(() => {
    setNoteA(data.note_a || "");
    setNoteB(data.note_b || "");
  }, [data.note_a, data.note_b]);

  return (
    <section className="py-6">
      <Header title="CERAD – TMT A/B" />
      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>

      {step === "a" && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-A</div>
          </div>
          <Stopwatch
            persisted={data.a_time ?? null}
            onPersist={(ms) => onPersist && onPersist({ a_time: ms })}
            autoAbortMs={180_000}
            onAutoAbort={(info) => {
              onPersist && onPersist({ a_time: 180_000 });
              onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: 180_000, at: info?.at || Date.now(), part: "A" });
            }}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700 w-24">Notiz</label>
            <input
              className="flex-1 rounded-xl border p-2"
              value={noteA}
              onChange={(e) => setNoteA(e.target.value)}
              onBlur={() => onPersist && onPersist({ note_a: noteA })}
            />
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setStep("b")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter zu TMT-B
            </button>
          </div>
        </Card>
      )}

      {step === "b" && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-B</div>
          </div>
          <Stopwatch
            persisted={data.b_time ?? null}
            onPersist={(ms) => onPersist && onPersist({ b_time: ms })}
            autoAbortMs={300_000}
            onAutoAbort={(info) => {
              onPersist && onPersist({ b_time: 300_000 });
              onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: 300_000, at: info?.at || Date.now(), part: "B" });
            }}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-zinc-700 w-24">Notiz</label>
            <input
              className="flex-1 rounded-xl border p-2"
              value={noteB}
              onChange={(e) => setNoteB(e.target.value)}
              onBlur={() => onPersist && onPersist({ note_b: noteB })}
            />
          </div>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onDone && onDone()}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig (weiter)
            </button>
          </div>
        </Card>
      )}
    </section>
  );
}

function TMTCombo({ sessionData, onPersist, onAbort, onDone }) {
  const tA = sessionData?.tmt_a ?? null;
  const tB = sessionData?.tmt_b ?? null;
  const [noteA, setNoteA] = useState(sessionData?.tmt_a_note ?? "");
  const [noteB, setNoteB] = useState(sessionData?.tmt_b_note ?? "");

  useEffect(() => {
    setNoteA(sessionData?.tmt_a_note ?? "");
    setNoteB(sessionData?.tmt_b_note ?? "");
  }, [sessionData?.tmt_a_note, sessionData?.tmt_b_note]);

  const persist = (patch) => onPersist && onPersist(patch);

  return (
    <section className="py-6">
      <Header title="TMT A/B" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-A</div>
          </div>
          <Stopwatch
            persisted={tA}
            onPersist={(ms) => persist({ tmt_a: ms })}
            autoAbortMs={180_000}
            onAutoAbort={(info) => {
              const payload = { reason: "Automatischer Abbruch", limit_ms: 180_000, at: info?.at || Date.now(), part: "A" };
              persist({ tmt_a: 180_000, tmt_a_aborted: payload });
              onAbort && onAbort(payload);
            }}
          />
          <Card className="space-y-1">
            <label className="text-sm text-zinc-700">Notiz</label>
            <input
              className="w-full rounded-xl border p-2"
              value={noteA}
              onChange={(e) => setNoteA(e.target.value)}
              onBlur={() => persist({ tmt_a_note: noteA })}
            />
          </Card>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-B</div>
          </div>
          <Stopwatch
            persisted={tB}
            onPersist={(ms) => persist({ tmt_b: ms })}
            autoAbortMs={300_000}
            onAutoAbort={(info) => {
              const payload = { reason: "Automatischer Abbruch", limit_ms: 300_000, at: info?.at || Date.now(), part: "B" };
              persist({ tmt_b: 300_000, tmt_b_aborted: payload });
              onAbort && onAbort(payload);
            }}
          />
          <Card className="space-y-1">
            <label className="text-sm text-zinc-700">Notiz</label>
            <input
              className="w-full rounded-xl border p-2"
              value={noteB}
              onChange={(e) => setNoteB(e.target.value)}
              onBlur={() => persist({ tmt_b_note: noteB })}
            />
          </Card>
        </Card>
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={() => onDone && onDone()}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </button>
      </div>
    </section>
  );
}

// ---------- CERAD Verbalgedächtnis Wireframe ----------
function CERADWordlistWire({ sessionData, route, onPersist, onAbort, onDone, onBackToMenu, onAfterDG3, onAfterRecog }) {
  const [step, setStep] = useState("dg1"); // "dg1" | "dg2" | "dg3" | "dg4" | "recog"
  const base = sessionData?.cerad_wl || {};

  // Route-based entry into DG4
  useEffect(() => {
    if (route?.go === "dg4") {
      setStep("dg4");
    }
  }, [route]);

  // DG-Daten aus sessionData holen oder Defaults
  const getDG = (key) => {
    const dg = base[key] || {};
    return {
      marks: dg.marks || {}, // { [wort]: true/false }
      intrusions: typeof dg.intrusions === "number" ? dg.intrusions : 0,
    };
  };

  // Trefferanzahl pro DG (kein globaler Summenscore)
  const computeHits = (key) => {
    const dg = getDG(key);
    const marks = dg.marks || {};
    return CERAD_WORDLIST.reduce((acc, w) => acc + (marks[w] ? 1 : 0), 0);
  };

  // Wort-Toggle pro DG
  const updateDGMarks = (key, word) => {
    const dg = getDG(key);
    const nextMarks = { ...dg.marks, [word]: !dg.marks[word] };
    const next = { ...dg, marks: nextMarks };
    onPersist && onPersist({ [key]: next });
  };

  // Intrusionszähler (+/-) pro DG
  const updateDGIntrusions = (key, delta) => {
    const dg = getDG(key);
    const nextIntr = Math.max(0, (dg.intrusions || 0) + delta);
    const next = { ...dg, intrusions: nextIntr };
    onPersist && onPersist({ [key]: next });
  };

  const renderDGCard = (key, label) => {
    const dg = getDG(key);
    const hits = computeHits(key);
    const intr = dg.intrusions || 0;

    return (
      <Card>
        <div className="flex items-center justify-between gap-2 mb-2">
          <SectionTitle>{label}</SectionTitle>
          <div className="text-sm text-zinc-600">
            Treffer: <span className="font-medium">{hits}</span> · Intrusionen: {intr}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CERAD_WORDLIST.map((w) => {
            const active = !!dg.marks[w];
            return (
              <button
                key={w}
                type="button"
                onClick={() => updateDGMarks(key, w)}
                className={cls(
                  "h-12 rounded-xl border bg-white flex items-center justify-between px-3",
                  active && "bg-emerald-50 border-emerald-200"
                )}
              >
                <span className="text-left truncate pr-2">{w}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="text-sm">Intrusionen (Anzahl):</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateDGIntrusions(key, -1)}
              className="px-3 py-1.5 rounded-xl border"
            >
              −
            </button>
            <div className="w-10 text-center font-mono tabular-nums">{intr}</div>
            <button
              type="button"
              onClick={() => updateDGIntrusions(key, 1)}
              className="px-3 py-1.5 rounded-xl border"
            >
              +
            </button>
          </div>
        </div>
      </Card>
    );
  };

  // Wiedererkennen: Ja/Nein-Antworten pro Wort
  const [recogAns, setRecogAns] = useState(() => {
    const saved = base.recog && base.recog.responses;
    return saved || {};
  });

  useEffect(() => {
    if (base.recog && base.recog.responses) {
      setRecogAns(base.recog.responses);
    }
  }, [base.recog]);

  const calcRecogCounts = (responses) => {
    let correctYes = 0;
    let correctNo = 0;
    CERAD_WL_RECOG_ITEMS.forEach((item) => {
      const ans = responses[item.word];
      if (item.isOrig && ans === "ja") correctYes += 1;
      if (!item.isOrig && ans === "nein") correctNo += 1;
    });
    return { correctYes, correctNo };
  };

  const recogCounts = useMemo(() => calcRecogCounts(recogAns), [recogAns]);

  const toggleRecog = (word, value) => {
    setRecogAns((prev) => {
      const nextVal = prev[word] === value ? null : value;
      const next = { ...prev, [word]: nextVal };
      const counts = calcRecogCounts(next);
      onPersist &&
        onPersist({
          recog: {
            responses: next,
            correct_yes: counts.correctYes,
            correct_no: counts.correctNo,
          },
        });
      return next;
    });
  };

  return (
    <section className="py-6">
      <Header
        title="CERAD – Verbalgedächtnis"
      />

      {onBackToMenu && (
        <div className="mb-2">
          <button
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </button>
        </div>
      )}

      {/* Kopfzeile: Abbruch */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <AbortButton onAbort={onAbort} />
      </div>


      {step === "dg1" && (
        <>
          {renderDGCard("dg1", "DG1 – Sofortabruf 1")}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setStep("dg2")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: DG2
            </button>
          </div>
        </>
      )}

      {step === "dg2" && (
        <>
          {renderDGCard("dg2", "DG2 – Sofortabruf 2")}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setStep("dg3")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: DG3
            </button>
          </div>
        </>
      )}

      {step === "dg3" && (
        <>
          {renderDGCard("dg3", "DG3 – Sofortabruf 3")}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: true });
                if (onAfterDG3) onAfterDG3();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Erinnerung setzen & weiter zu Figuren
            </button>
          </div>
        </>
      )}

      {/* DG4 – verzögerter Abruf (kein Timer, aber direkt ansteuerbar) */}
      {step === "dg4" && (
        <>
          {renderDGCard("dg4", "DG4 – verzögerter Abruf")}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setStep("recog")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: Wiedererkennen
            </button>
          </div>
        </>
      )}

      {step === "recog" && (
        <>
          <Card>
            <SectionTitle>Wortliste – Wiedererkennen</SectionTitle>
            <p className="text-sm text-zinc-600 mb-2">
              Patient:in antwortet mit JA oder NEIN, ob das Wort zur gelernten Liste gehört.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {CERAD_WL_RECOG_ITEMS.map((item) => {
                const ans = recogAns[item.word] || null;
                const isCorrect = (val) => (item.isOrig ? val === "ja" : val === "nein");
                const btnClass = (val) => {
                  if (ans !== val) return "bg-white border-zinc-300";
                  return isCorrect(val)
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border-rose-200 text-rose-700";
                };
                return (
                  <div
                    key={item.word}
                    className="p-3 rounded-2xl border bg-white flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="font-semibold text-lg tracking-tight">{item.word}</div>
                      <div
                        className={cls(
                          "text-xs font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded-full mt-1",
                          item.isOrig
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}
                      >
                        {item.isOrig ? "Originalwort" : "Neues Wort"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => toggleRecog(item.word, "ja")}
                        className={cls(
                          "px-3 py-1.5 rounded-xl border text-sm",
                          btnClass("ja")
                        )}
                      >
                        JA
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRecog(item.word, "nein")}
                        className={cls(
                          "px-3 py-1.5 rounded-xl border text-sm",
                          btnClass("nein")
                        )}
                      >
                        NEIN
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm text-zinc-700">
              Korrekte JA-Antworten:{" "}
              <span className="font-medium">{recogCounts.correctYes}</span> · Korrekte NEIN-Antworten:{" "}
              <span className="font-medium">{recogCounts.correctNo}</span>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  if (onAfterRecog) onAfterRecog();
                  else if (onDone) onDone();
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
              >
                Fertig
              </button>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
