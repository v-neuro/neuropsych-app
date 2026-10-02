import { Button, Card, Header, SectionTitle } from "./ui";
import { AbortButton } from "./abort-button";
import { cls } from "../lib/utils";
import { QOLIE31_EXAMINER_BLOCKS } from "../lib/qolie31-content";
import { QOLIE31_SCORING_VERSION, QOLIE31_SUBSCALES, getQolie31Assessment } from "../lib/qolie31-scoring";

const formatScore = (score) => score === null ? "Nicht verfügbar" : score.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Qolie31Results({ result }) {
  return (
    <Card className="space-y-3">
      <SectionTitle>QOLIE-31</SectionTitle>
      <div className="flex flex-wrap items-start justify-between gap-3" aria-live="polite" aria-atomic="true">
        <div>
          <h2 className="font-semibold">QOLIE-31 Gesamtscore</h2>
          <p className="text-2xl font-semibold tabular-nums text-indigo-900" data-qolie-overall>{formatScore(result.overall)}{result.overall !== null && <span className="text-sm font-normal"> / 100</span>}</p>
          <p className="text-xs text-zinc-600">{result.overall === null ? "Erst verfügbar, wenn alle sieben Subskalen berechenbar sind." : result.scoredComplete ? "Alle 30 bewerteten Items beantwortet." : "Vorläufig · aus unvollständigen Antworten berechnet."}</p>
        </div>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2" data-qolie-subscales>
        {QOLIE31_SUBSCALES.map(({ key, label }) => {
          const scale = result.subscales[key];
          return <div key={key} className="rounded-xl border border-indigo-100 p-3" data-qolie-scale={key}>
            <dt className="text-sm font-medium">{label}</dt>
            <dd className="font-semibold tabular-nums" data-qolie-score>{formatScore(scale.score)}{scale.score !== null && " / 100"}</dd>
            <dd className="text-xs text-zinc-500">{scale.answeredCount} / {scale.itemCount} Items beantwortet{scale.score !== null && !scale.complete ? " · unvollständige Antworten" : ""}</dd>
          </div>;
        })}
      </dl>
      <p className="text-xs text-zinc-600">Höhere Scores bedeuten eine bessere Lebensqualität.</p>
      <div className="border-t border-indigo-100 pt-3">
        <h2 className="text-sm font-semibold">Allgemeiner Gesundheitszustand</h2>
        <p className="font-semibold tabular-nums" data-qolie-health>{formatScore(result.health)}{result.health !== null && " / 100"}</p>
      </div>
    </Card>
  );
}

function groupAnswerRows(items) {
  return items.reduce((groups, item) => {
    const signature = JSON.stringify(item.options);
    const last = groups.at(-1);
    if (last?.signature === signature) last.items.push(item);
    else groups.push({ signature, options: item.options, items: [item] });
    return groups;
  }, []);
}

function QolieAnswerGrid({ group, blockTitle, responses, errors, onChange }) {
  const { options, items } = group;
  const endpointOnly = options.slice(1, -1).every(({ label }) => !label);
  const gridStyle = { gridTemplateColumns: `repeat(${options.length}, minmax(44px, 1fr))` };
  const minimumWidth = options.length * 44 + (options.length - 1) * 4;
  return (
    <div className="overflow-x-auto pb-1" data-qolie-answer-grid>
      <div style={{ minWidth: minimumWidth }}>
        {endpointOnly ? <div className="mb-2 flex justify-between gap-4 text-xs text-zinc-600" aria-hidden="true" data-qolie-answer-labels>
          <span className="max-w-[45%]">{options[0].label}</span><span className="max-w-[45%] text-right">{options.at(-1).label}</span>
        </div> : <div className="grid gap-1 mb-2 text-center text-xs text-zinc-600" style={gridStyle} aria-hidden="true" data-qolie-answer-labels>
          {options.map((option) => <span key={option.value} className="min-w-0 break-words px-0.5">{option.label}</span>)}
        </div>}
        <div className="space-y-2">
          {items.map((item) => {
            const raw = responses[item.id] ?? null;
            const error = errors[item.id];
            return <fieldset key={item.id} className="min-w-0 border-t border-indigo-100 pt-2" data-qolie-item={item.id} aria-describedby={error ? `qolie-error-${item.id}` : undefined}>
              <legend className="max-w-full px-1 text-sm font-medium">{item.text || <span className="sr-only">{blockTitle}</span>}<span className="sr-only"> · Item {item.id}</span></legend>
              <div className="grid gap-1" style={gridStyle} data-qolie-answer-row>
                {item.options.map((option) => <label key={option.value} className={cls("flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold focus-within:ring-2 focus-within:ring-indigo-500", raw === option.value ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50")}>
                  <input type="radio" name={`qolie-item-${item.id}`} value={option.value} checked={raw === option.value}
                    className="sr-only" aria-label={`Item ${item.id}: ${option.value}${option.label ? ` · ${option.label}` : ""}`} aria-invalid={!!error} onChange={() => onChange(item.id, option.value)} />
                  <span>{option.value}</span>
                </label>)}
              </div>
              {error && <p id={`qolie-error-${item.id}`} className="mt-1 text-sm text-rose-700">{error}</p>}
              {raw !== null && <Button size="sm" variant="subtle" className="mt-1" aria-label={`Antwort für Item ${item.id} löschen`} onClick={() => onChange(item.id, null)}>Antwort löschen</Button>}
            </fieldset>;
          })}
        </div>
      </div>
    </div>
  );
}

function QolieHealthSlider({ raw, error, onChange }) {
  const hasStepValue = typeof raw === "number" && raw >= 0 && raw <= 100 && raw % 10 === 0;
  const hasLegacyValue = typeof raw === "number" && raw >= 0 && raw <= 100 && !hasStepValue;
  const ticks = Array.from({ length: 11 }, (_, index) => index * 10);
  const selectValue = (event) => onChange(31, event.currentTarget.valueAsNumber);
  return (
    <fieldset className="min-w-0 space-y-2" data-qolie-item="31">
      <legend className="sr-only">Gesundheitsthermometer · Item 31</legend>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor="qolie-health-input" className="text-sm font-medium">Gesundheitsthermometer (0–100)</label>
        <output htmlFor="qolie-health-input" className="text-sm font-semibold tabular-nums" data-qolie-health-selection>
          {error ? "Ungültiger gespeicherter Wert" : raw === null ? "Noch nicht beantwortet" : `${raw} / 100`}
        </output>
      </div>
      <input id="qolie-health-input" type="range" min="0" max="100" step="10" list="qolie-health-ticks" value={hasStepValue ? raw : 0}
        className={cls("h-11 w-full cursor-pointer accent-indigo-700", !hasStepValue && raw !== null && "[&::-webkit-slider-thumb]:opacity-0 [&::-moz-range-thumb]:opacity-0 focus:[&::-webkit-slider-thumb]:opacity-100 focus:[&::-moz-range-thumb]:opacity-100")}
        aria-invalid={!!error} aria-valuetext={hasStepValue ? `${raw} von 100` : hasLegacyValue ? `Gespeicherter Wert ${raw} von 100; neue Auswahl in Zehnerschritten` : "Noch nicht beantwortet"}
        aria-describedby={`qolie-health-endpoints${hasLegacyValue ? " qolie-health-help" : ""}${error ? " qolie-error-31" : ""}`}
        onChange={selectValue} onPointerUp={selectValue}
        onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) selectValue(event); }} />
      <datalist id="qolie-health-ticks">{ticks.map((value) => <option key={value} value={value} />)}</datalist>
      <div className="grid grid-cols-11 text-center text-xs tabular-nums text-zinc-500" aria-hidden="true">{ticks.map((value) => <span key={value}>{value}</span>)}</div>
      <p id="qolie-health-endpoints" className="flex justify-between gap-4 text-xs text-zinc-600"><span>0 = Denkbar schlechtester Gesundheitszustand</span><span className="text-right">100 = Denkbar bester Gesundheitszustand</span></p>
      {hasLegacyValue && <p id="qolie-health-help" className="text-xs text-zinc-500">Gespeicherter Wert bleibt unverändert. Neue Auswahl in 10er-Schritten.</p>}
      {error && <p id="qolie-error-31" className="text-sm text-rose-700">{error}</p>}
      {raw !== null && <Button size="sm" variant="subtle" aria-label="Antwort für Item 31 löschen" onClick={() => onChange(31, null)}>Antwort löschen</Button>}
    </fieldset>
  );
}

export function Qolie31Screen({ data = {}, aborted, onPersist, onAbort, onResume, onDone, onBack }) {
  const responses = data.responses || {};
  const result = getQolie31Assessment(data);
  const hasErrors = Object.keys(result.errors).length > 0;
  const update = (patch) => onPersist({ entry_mode: "items", scoring_version: data.scoring_version || QOLIE31_SCORING_VERSION, ...patch });
  const setResponse = (id, value) => update({ responses: { ...responses, [id]: value } });

  return (
    <section className="py-6" aria-label="QOLIE-31">
      <Header title="QOLIE-31" />
      <div className="mb-3 flex flex-wrap gap-2">
        <AbortButton onAbort={onAbort} defaultReasonType={aborted?.reason} defaultNote={aborted?.note} />
        <Button variant="secondary" size="sm" onClick={onBack}>Zur Fragebogenauswahl</Button>
      </div>
      {aborted && <Card className="mb-3 text-sm text-rose-800">
        <p>Fragebogen abgebrochen: {aborted.reason}{aborted.note ? ` · ${aborted.note}` : ""}. Antworten bleiben erhalten.</p>
        <Button className="mt-2" size="sm" onClick={onResume}>Fragebogen fortsetzen</Button>
      </Card>}
      {hasErrors && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
        <p className="font-semibold">Bitte ungültige Antworten korrigieren. Betroffene Scores werden nicht berechnet.</p>
        <ul className="mt-2 list-disc pl-5">{Object.entries(result.errors).map(([id, message]) => <li key={id}>{message}</li>)}</ul>
      </div>}
      <div className="space-y-3">
        <Qolie31Results result={result} />
        {QOLIE31_EXAMINER_BLOCKS.map((block) => <Card key={block.number} className="space-y-3">
          <h2 id={`qolie-block-${block.number}`} className="flex items-start gap-3 font-medium">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{block.number}</span>
            <span>{block.title}</span>
          </h2>
          {block.items[0].healthRating
            ? <QolieHealthSlider raw={responses[31] ?? null} error={result.errors[31]} onChange={setResponse} />
            : groupAnswerRows(block.items).map((group) => <QolieAnswerGrid key={group.items[0].id} group={group} blockTitle={block.title} responses={responses} errors={result.errors} onChange={setResponse} />)}
        </Card>)}
        <Card className="space-y-2">
          <SectionTitle>Allgemeine Notizen</SectionTitle>
          <textarea className="h-28 w-full rounded-xl border p-2" value={data.notes || ""} onChange={(event) => update({ notes: event.target.value })} aria-label="QOLIE-31 Notiz" placeholder="Allgemeine Notiz" />
        </Card>
        <div className="flex justify-end">
          <Button variant="primary" disabled={hasErrors || !!aborted} onClick={onDone}>Fertig</Button>
        </div>
      </div>
    </section>
  );
}
