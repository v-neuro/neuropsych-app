import { useId, useState } from "react";
import { Button, Card, Header } from "./ui";
import { AbortButton } from "./abort-button";
import { cls } from "../lib/utils";
import { REY_VERSIONS, REY_SCORE_OPTIONS, getReyVersion, getReyElementScore, getReySummary } from "../lib/rey-scoring";

const formatScore = (value) => value.toLocaleString("de-DE");

function ReferenceImage({ version, children, className, ...props }) {
  const cropId = useId();
  return (
    <svg viewBox={version.viewBox} className={cls("w-full h-auto", className)} {...props}>
      <defs><clipPath id={cropId}><rect width={version.width} height={version.cropHeight} /></clipPath></defs>
      <image href={version.image} width={version.width} height={version.height} clipPath={`url(#${cropId})`} />
      {children}
    </svg>
  );
}

function ReyReference({ version, selectedId, scores, onSelect }) {
  const selected = version.elements.find(({ id }) => id === selectedId);
  const scale = version.markerScale;
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-center rounded-xl border border-indigo-100 bg-white p-2">
        <ReferenceImage version={version} className="max-h-[min(42dvh,430px)] md:max-h-[440px]" role="group" aria-label={`Version ${version.id}: Element über seine Nummer auswählen`}>
          <g transform={`scale(${version.coordinateScale})`}>
          <path data-rey-highlight={selected.id} d={selected.path} fill="none" stroke="#4f46e5" strokeWidth={selected.strokeWidth || 5 * scale} strokeLinecap="round" strokeLinejoin="round" opacity="0.9" pointerEvents="none" />
          {selected.detailPath && <path d={selected.detailPath} fill="none" stroke="#4f46e5" strokeWidth={selected.detailStrokeWidth} strokeLinecap="round" opacity="0.9" pointerEvents="none" />}
          {version.elements.map((element) => {
            const isSelected = selectedId === element.id;
            const isScored = getReyElementScore({ scores }, element.id) !== null;
            return (
              <g key={element.id} role="button" tabIndex="0" aria-label={`Element ${element.id}: ${element.label}`} aria-pressed={isSelected}
                className="rey-figure-marker cursor-pointer"
                onClick={() => onSelect(element.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(element.id); }
                }}
              >
                <title>{element.id}. {element.label}</title>
                <circle cx={element.marker[0]} cy={element.marker[1]} r={23 * scale} fill="transparent" />
                <circle cx={element.marker[0]} cy={element.marker[1]} r={15 * scale} fill={isSelected ? "#4f46e5" : isScored ? "#ecfdf5" : "white"} stroke={isSelected ? "#4f46e5" : isScored ? "#059669" : "#94a3b8"} strokeWidth={1.5 * scale} />
                <text x={element.marker[0]} y={element.marker[1]} dy="0.35em" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize={15 * scale} fontWeight="700" fill={isSelected ? "white" : isScored ? "#047857" : "#334155"} pointerEvents="none">{element.id}</text>
              </g>
            );
          })}
          </g>
        </ReferenceImage>
      </div>
    </div>
  );
}

function VersionChoice({ onSelect }) {
  return (
    <section className="py-4" aria-label="Rey-Figur – Versionswahl">
      <Header title="Rey-Figur – Kopie" subtitle="ROCFT · Version für diese Testung auswählen" />
      <div className="grid gap-4 sm:grid-cols-2 mt-4">
        {REY_VERSIONS.map((version) => (
            <Card key={version.id}>
              <h2 className="font-semibold">Version {version.id}</h2>
              <div className="my-3 flex h-52 items-center rounded-xl border border-indigo-100 bg-white p-3">
                <ReferenceImage version={version} className="max-h-full" role="img" aria-label={`ROCFT, Version ${version.id}`} />
              </div>
              <Button variant="primary" className="mt-3 w-full" onClick={() => onSelect(version.id)}>Version {version.id} wählen</Button>
            </Card>
        ))}
      </div>
    </section>
  );
}

export function ReyCopyScreen({ data = {}, aborted, onPersist, onSelectVersion, onAbort, onResume, onDone }) {
  const [choosingVersion, setChoosingVersion] = useState(() => !data.version && !getReySummary(data).scoredCount && !data.notes && data.duration_s == null && !aborted);
  const version = getReyVersion(data);
  const [selectedId, setSelectedId] = useState(() => version.elements.find(({ id }) => getReyElementScore(data, id) === null)?.id || 1);
  const summary = getReySummary(data);
  const selected = version.elements.find(({ id }) => id === selectedId);
  const selectedScore = getReyElementScore(data, selectedId);
  const update = (patch) => onPersist({ version: version.id, ...patch });
  const chooseVersion = (id) => {
    const draft = id === version.id ? data : data.versions?.[id];
    const nextVersion = getReyVersion({ version: id });
    setSelectedId(nextVersion.elements.find(({ id: elementId }) => getReyElementScore(draft, elementId) === null)?.id || 1);
    onSelectVersion(id);
    setChoosingVersion(false);
  };
  const assignScore = (value) => {
    const scores = { ...data.scores, [selectedId]: value };
    update({ scores });
  };
  if (choosingVersion) return <VersionChoice onSelect={chooseVersion} />;

  return (
    <section className="py-3" aria-label="Rey-Figur – Kopie">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h1 className="text-xl font-semibold">Rey-Figur – Kopie</h1>
          <p className="text-sm text-zinc-600">ROCFT · Version {version.id} · Papierkopie bewerten</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setChoosingVersion(true)}>Version wählen</Button>
          <AbortButton onAbort={onAbort} defaultReasonType={aborted?.reason} defaultNote={aborted?.note} />
        </div>
      </div>
      {aborted && <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="status">
        <span>Test abgebrochen: {aborted.reason}{aborted.note ? ` · ${aborted.note}` : ""}. Bewertungen bleiben erhalten.</span>
        <Button size="sm" onClick={onResume}>Bewertung fortsetzen</Button>
      </div>}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3 mb-3" aria-live="polite" aria-atomic="true">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-zinc-600">{summary.complete ? "Rohwert" : "Vorläufige Teilsumme"}</span>
            <span className="text-xl font-semibold tabular-nums text-indigo-950" data-rey-total>{summary.scoredCount ? formatScore(summary.subtotal) : "—"}<span className="text-sm font-normal text-zinc-500"> / 36</span></span>
          </div>
          <span className="rounded-lg bg-indigo-50 px-2 py-1 text-sm text-indigo-800" data-rey-progress>{summary.scoredCount} / 18 bewertet</span>
        </div>
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)]">
          <div className="min-w-0">
            <ReyReference version={version} selectedId={selectedId} scores={data.scores} onSelect={setSelectedId} />
            <div className="grid grid-cols-2 gap-2 mt-2" role="group" aria-label="Elementnavigation" data-rey-navigation>
              <Button size="sm" disabled={selectedId === 1} onClick={() => setSelectedId((id) => id - 1)}>← Vorheriges</Button>
              <Button size="sm" disabled={selectedId === 18} onClick={() => setSelectedId((id) => id + 1)}>Nächstes →</Button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Nummer anklicken und das Element bewerten. Grün = bewertet.</p>
          </div>
          <div className="min-w-0" data-rey-scoring-panel>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3">
              <div className="flex items-start gap-2 min-h-12" aria-live="polite" aria-atomic="true">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-white text-sm font-semibold">{selectedId}</span>
                <h2 className="text-sm font-semibold pt-1">{selected.label}</h2>
              </div>
              <div className="grid grid-cols-4 gap-1.5 mt-2" role="group" aria-label={`Punkte für Element ${selectedId}`}>
                {REY_SCORE_OPTIONS.map((option) => <Button key={option.value} size="sm" variant={selectedScore === option.value ? "primary" : "secondary"} className="tabular-nums"
                  aria-label={`Element ${selectedId}: ${option.label} Punkte`} aria-pressed={selectedScore === option.value} title={option.description} onClick={() => assignScore(option.value)}>{option.label}</Button>)}
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <span className="text-xs text-zinc-500">{selectedScore === null ? "Noch offen" : `${formatScore(selectedScore)} Punkte vergeben`}</span>
                <Button size="sm" variant="subtle" disabled={selectedScore === null} aria-label={`Bewertung für Element ${selectedId} löschen`} onClick={() => update({ scores: { ...data.scores, [selectedId]: null } })}>Löschen</Button>
              </div>
            </div>
            <h3 className="text-xs font-medium text-zinc-600 mt-3 mb-2">Alle Elemente · Nummer und Punkte</h3>
            <div className="grid grid-cols-6 gap-1.5" aria-label="Elementübersicht">
              {version.elements.map((element) => {
                const score = getReyElementScore(data, element.id);
                return <Button key={element.id} size="bare" data-rey-element={element.id} title={element.label}
                  aria-label={`Element ${element.id} auswählen: ${element.label}`} aria-pressed={selectedId === element.id}
                  className={cls("rounded-lg border px-1 py-1 text-center", selectedId === element.id ? "border-indigo-700 bg-indigo-700 text-white" : score !== null ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white text-zinc-700")}
                  onClick={() => setSelectedId(element.id)}>
                  <span className="block text-sm font-semibold leading-4">{element.id}</span><span className="block text-xs tabular-nums leading-4">{score === null ? "—" : formatScore(score)}</span>
                </Button>;
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 pt-3 mt-3">
          <p className="text-xs text-zinc-500">{summary.complete ? "Alle Elemente bewertet · Rohwert ohne Normumrechnung" : "Offen ≠ 0 · Gesamtrohwert erst bei 18 Bewertungen"}<br />Eingaben werden automatisch gespeichert.</p>
          <Button variant="primary" disabled={!summary.complete || !!aborted} onClick={onDone}>Rey-Kopie abschließen</Button>
        </div>
      </Card>
      <details className="mt-3 w-full rounded-xl border border-indigo-100 bg-white/90 p-3" data-rey-help>
        <summary className="cursor-pointer text-sm font-medium">Bewertungshilfe</summary>
        <dl className="mt-3 space-y-2 text-sm">
          {REY_SCORE_OPTIONS.map((option) => <div key={option.value} className="flex gap-3"><dt className="w-6 shrink-0 font-semibold">{option.label}</dt><dd>{option.description}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs text-zinc-500">18-Elemente-Schema · Für die Detailbewertung das verwendete Testmanual heranziehen.</p>
      </details>
    </section>
  );
}
