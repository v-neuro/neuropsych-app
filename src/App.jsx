import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cls, useInterval } from "./lib/utils";
import { idbGet, idbSet, idbDel, idbSetDrawing, idbGetDrawing, idbDeleteDrawing, idbDeleteDrawingNamespace, idbPruneDrawingsExcept, idbPruneOldSessions } from "./lib/persist";
import { Button, Card, Header, SectionTitle } from "./components/ui";
import { DrawPad } from "./components/draw-pad";
import { Stopwatch, Countdown60 } from "./components/timers";
import { AbortButton } from "./components/abort-button";
import { ErrorBoundary } from "./components/error-boundary";

const SESSION_BACKUP_STORAGE_KEY = "npt_session_backup";

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
    { w: "Vorhang", t: true }, { w: "Sonne", t: false }, { w: "Boot", t: false }, { w: "Vase", t: false }, { w: "Farbe", t: true },
    { w: "Glocke", t: true }, { w: "Ofen", t: false }, { w: "Lehrer", t: false }, { w: "Kuh", t: false }, { w: "Hut", t: true },
    { w: "Schuh", t: false }, { w: "Schule", t: true }, { w: "Fenster", t: false }, { w: "Förster", t: false }, { w: "Mond", t: true },
    { w: "Tisch", t: false }, { w: "Fisch", t: false }, { w: "Kuchen", t: false }, { w: "Lamm", t: false }, { w: "Nase", t: true },
    { w: "Garbe", t: false }, { w: "Bleistift", t: false }, { w: "Maus", t: false }, { w: "Wolke", t: false }, { w: "Kaffee", t: true },
    { w: "Locke", t: false }, { w: "Jäger", t: false }, { w: "Fluss", t: true }, { w: "Gewehr", t: false }, { w: "Stille", t: false },
    { w: "See", t: false }, { w: "Haus", t: true }, { w: "Handtuch", t: false }, { w: "Mut", t: false }, { w: "Mauer", t: false },
    { w: "Truthahn", t: true }, { w: "Vogel", t: false }, { w: "Bein", t: false }, { w: "Brille", t: false }, { w: "Schaf", t: false },
    { w: "Garten", t: true }, { w: "Warten", t: false }, { w: "Eltern", t: true }, { w: "Pauke", t: false }, { w: "Berg", t: false },
    { w: "Trommel", t: true }, { w: "Kinder", t: false }, { w: "Bauer", t: true }, { w: "Arm", t: false }, { w: "Kirsche", t: false },
  ],
  B: [
    { w: "Stadt", t: true }, { w: "Flöte", t: false }, { w: "Boot", t: false }, { w: "Riese", t: false }, { w: "Zunge", t: true },
    { w: "Ofen", t: false }, { w: "Fenster", t: true }, { w: "Licht", t: false }, { w: "Kuh", t: false }, { w: "Reise", t: true },
    { w: "Schuh", t: false }, { w: "Treppe", t: true }, { w: "Urlaub", t: false }, { w: "Förster", t: false }, { w: "Lampe", t: true },
    { w: "Tisch", t: false }, { w: "Fisch", t: false }, { w: "Gras", t: false }, { w: "Lamm", t: false }, { w: "Maurer", t: true },
    { w: "Neige", t: false }, { w: "Bleistift", t: false }, { w: "Klee", t: false }, { w: "Wolke", t: false }, { w: "Wiese", t: true },
    { w: "Wonne", t: false }, { w: "Jäger", t: false }, { w: "Sonne", t: true }, { w: "Gewehr", t: false }, { w: "Stille", t: false },
    { w: "Glas", t: false }, { w: "Museum", t: true }, { w: "Handtuch", t: false }, { w: "Mauer", t: false }, { w: "Sieger", t: false },
    { w: "Musik", t: true }, { w: "Vogel", t: false }, { w: "Bein", t: false }, { w: "Brille", t: false }, { w: "Schaf", t: false },
    { w: "Tiger", t: true }, { w: "Rampe", t: false }, { w: "See", t: true }, { w: "Stufe", t: false }, { w: "Berg", t: false },
    { w: "Geige", t: true }, { w: "Löwe", t: false }, { w: "Tee", t: true }, { w: "Arm", t: false }, { w: "Kirsche", t: false },
  ],
  C: [
    { w: "Seil", t: true }, { w: "Geweih", t: false }, { w: "Boot", t: false }, { w: "Hund", t: false }, { w: "Gans", t: true },
    { w: "Ofen", t: false }, { w: "Horn", t: true }, { w: "Huhn", t: false }, { w: "Kuh", t: false }, { w: "Tür", t: true },
    { w: "Schuh", t: false }, { w: "Gericht", t: true }, { w: "Degen", t: false }, { w: "Mund", t: true }, { w: "Milch", t: false },
    { w: "Vogel", t: false }, { w: "Hand", t: false }, { w: "Gesicht", t: false }, { w: "Regen", t: true }, { w: "Bein", t: false },
    { w: "Brille", t: false }, { w: "Schaf", t: false }, { w: "Berg", t: false }, { w: "Land", t: true }, { w: "Jacke", t: false },
    { w: "Mantel", t: true }, { w: "Arm", t: false }, { w: "Kirsche", t: false }, { w: "Sterne", t: true }, { w: "Fenster", t: false },
    { w: "Förster", t: false }, { w: "Wagen", t: true }, { w: "Tisch", t: false }, { w: "Fisch", t: false }, { w: "Wald", t: false },
    { w: "Lamm", t: false }, { w: "Kakao", t: true }, { w: "Beil", t: false }, { w: "Bleistift", t: false }, { w: "Mandel", t: false },
    { w: "Wolke", t: false }, { w: "Baum", t: true }, { w: "Norm", t: false }, { w: "Jäger", t: false }, { w: "Pfarrer", t: true },
    { w: "Gewehr", t: false }, { w: "Stille", t: false }, { w: "Auto", t: false }, { w: "Form", t: true }, { w: "Handtuch", t: false },
  ],
  D: [
    { w: "Ofen", t: false }, { w: "Kamin", t: true }, { w: "Schornstein", t: false }, { w: "Kuh", t: false }, { w: "Wald", t: true },
    { w: "Schuh", t: false }, { w: "Aufzug", t: true }, { w: "See", t: false }, { w: "Förster", t: false }, { w: "Sand", t: true },
    { w: "Tisch", t: false }, { w: "Fisch", t: false }, { w: "Tango", t: false }, { w: "Lamm", t: false }, { w: "Tanz", t: true },
    { w: "Lage", t: false }, { w: "Bleistift", t: false }, { w: "legal", t: false }, { w: "Wolke", t: false }, { w: "Lager", t: true },
    { w: "Land", t: false }, { w: "Jäger", t: false }, { w: "Jacke", t: true }, { w: "Gewehr", t: false }, { w: "Stille", t: false },
    { w: "Stirn", t: false }, { w: "Suppe", t: true }, { w: "Handtuch", t: false }, { w: "Wall", t: false }, { w: "Schuppe", t: false },
    { w: "Regal", t: true }, { w: "Vogel", t: false }, { w: "Bein", t: false }, { w: "Brille", t: false }, { w: "Schaf", t: false },
    { w: "Messer", t: true }, { w: "Backe", t: false }, { w: "Teich", t: true }, { w: "Bruder", t: false }, { w: "Berg", t: false },
    { w: "Leopard", t: true }, { w: "Gabel", t: false }, { w: "Kinn", t: true }, { w: "Arm", t: false }, { w: "Kirsche", t: false },
  ],
};

const TEST_LANGUAGE_OPTIONS = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "Englisch" },
  { code: "tr", label: "Türkisch" },
  { code: "ru", label: "Russisch" },
  { code: "ar", label: "Arabisch" },
  { code: "uk", label: "Ukrainisch" },
  { code: "pl", label: "Polnisch" },
];

const normalizeTestLanguage = (language) => (
  TEST_LANGUAGE_OPTIONS.some((option) => option.code === language) ? language : "de"
);

const QUESTIONNAIRE_RESPONSE_OPTIONS = [
  { value: 0, label: "Überhaupt nicht" },
  { value: 1, label: "An einzelnen Tagen" },
  { value: 2, label: "An mehr als der Hälfte der Tage" },
  { value: 3, label: "Beinahe jeden Tag" },
];

const GDS_RESPONSE_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "no", label: "Nein" },
];

const QUESTIONNAIRE_DEFINITIONS = {
  phq9: {
    title: "PHQ-9",
    fullTitle: "Gesundheitsfragebogen für Patienten (PHQ-9)",
    max: 27,
    prompt: "Wie oft fühlten Sie sich im Verlauf der letzten 2 Wochen durch die folgenden Beschwerden beeinträchtigt?",
    attribution: "Deutsche Version: © Prof. Dr. Bernd Löwe, 2015, Universitätsklinikum Hamburg-Eppendorf",
    items: [
      { key: "a", text: "Wenig Interesse oder Freude an Ihren Tätigkeiten" },
      { key: "b", text: "Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit" },
      { key: "c", text: "Schwierigkeiten ein- oder durchzuschlafen oder vermehrter Schlaf" },
      { key: "d", text: "Müdigkeit oder Gefühl, keine Energie zu haben" },
      { key: "e", text: "Verminderter Appetit oder übermäßiges Bedürfnis zu essen" },
      { key: "f", text: "Schlechte Meinung von sich selbst; Gefühl, ein Versager zu sein oder die Familie enttäuscht zu haben" },
      { key: "g", text: "Schwierigkeiten, sich auf etwas zu konzentrieren, z. B. beim Zeitunglesen oder Fernsehen" },
      { key: "h", text: "Waren Ihre Bewegungen oder Ihre Sprache so verlangsamt, dass es auch anderen auffallen würde? Oder waren Sie im Gegenteil „zappelig“ oder ruhelos und hatten dadurch einen stärkeren Bewegungsdrang als sonst?" },
      { key: "i", text: "Gedanken, dass Sie lieber tot wären oder sich Leid zufügen möchten" },
    ],
  },
  gad7: {
    title: "GAD-7",
    fullTitle: "Gesundheitsfragebogen für Patienten (GAD-7)",
    max: 21,
    prompt: "Wie oft fühlten Sie sich im Verlauf der letzten 2 Wochen durch die folgenden Beschwerden beeinträchtigt?",
    attribution: "Deutsche Version: © Prof. Dr. Bernd Löwe, 2015, Universitätsklinikum Hamburg-Eppendorf",
    items: [
      { key: "a", text: "Nervosität, Ängstlichkeit oder Anspannung" },
      { key: "b", text: "Nicht in der Lage sein, Sorgen zu stoppen oder zu kontrollieren" },
      { key: "c", text: "Übermäßige Sorgen bezüglich verschiedener Angelegenheiten" },
      { key: "d", text: "Schwierigkeiten zu entspannen" },
      { key: "e", text: "Rastlosigkeit, so dass Stillsitzen schwer fällt" },
      { key: "f", text: "Schnelle Verärgerung oder Gereiztheit" },
      { key: "g", text: "Gefühl der Angst, so als würde etwas Schlimmes passieren" },
    ],
  },
  gds: {
    title: "GDS",
    fullTitle: "GDS (Geriatrische Depressions-Skala)",
    max: 30,
    prompt: "Bitte jede Frage mit Ja oder Nein beantworten.",
    responseOptions: GDS_RESPONSE_OPTIONS,
    scoringMode: "keyed-binary",
    items: [
      { key: "1", text: "Sind Sie mit Ihrem Leben im Grunde zufrieden?", scoredAnswer: "no" },
      { key: "2", text: "Haben Sie viele Ihrer Aktivitäten und Interessen aufgegeben?", scoredAnswer: "yes" },
      { key: "3", text: "Glauben Sie, dass Ihr Leben sinnlos ist?", scoredAnswer: "yes" },
      { key: "4", text: "Langweilen Sie sich oft?", scoredAnswer: "yes" },
      { key: "5", text: "Blicken Sie voller Hoffnung in die Zukunft?", scoredAnswer: "no" },
      { key: "6", text: "Werden Sie durch Gedanken beunruhigt, die Ihnen nicht aus dem Kopf gehen wollen?", scoredAnswer: "yes" },
      { key: "7", text: "Sind Sie die meiste Zeit über guter Stimmung?", scoredAnswer: "no" },
      { key: "8", text: "Fürchten Sie, dass Ihnen etwas Schlechtes zustoßen könnte?", scoredAnswer: "yes" },
      { key: "9", text: "Fühlen Sie sich die meiste Zeit über glücklich?", scoredAnswer: "no" },
      { key: "10", text: "Fühlen Sie sich oft hilflos?", scoredAnswer: "yes" },
      { key: "11", text: "Werden Sie oft ruhelos oder nervös?", scoredAnswer: "yes" },
      { key: "12", text: "Bleiben Sie lieber zu Hause, anstatt auszugehen und neue Dinge zu erleben?", scoredAnswer: "yes" },
      { key: "13", text: "Machen Sie sich öfter Sorgen um die Zukunft?", scoredAnswer: "yes" },
      { key: "14", text: "Glauben Sie, dass Sie mit dem Gedächtnis mehr Schwierigkeiten haben als die meisten anderen?", scoredAnswer: "yes" },
      { key: "15", text: "Finden Sie es wunderbar, jetzt zu leben?", scoredAnswer: "no" },
      { key: "16", text: "Sind Sie oft niedergeschlagen und traurig?", scoredAnswer: "yes" },
      { key: "17", text: "Fühlen Sie sich unter den jetzigen Umständen als ziemlich wertlos?", scoredAnswer: "yes" },
      { key: "18", text: "Beunruhigt Sie die Vergangenheit sehr?", scoredAnswer: "yes" },
      { key: "19", text: "Finden Sie das Leben sehr aufregend?", scoredAnswer: "no" },
      { key: "20", text: "Fällt es Ihnen schwer, neue Aufgaben in Angriff zu nehmen?", scoredAnswer: "yes" },
      { key: "21", text: "Fühlen Sie sich energiegeladen?", scoredAnswer: "no" },
      { key: "22", text: "Halten Sie Ihre Situation für hoffnungslos?", scoredAnswer: "yes" },
      { key: "23", text: "Glauben Sie, dass es den meisten Menschen besser geht als Ihnen?", scoredAnswer: "yes" },
      { key: "24", text: "Ärgern Sie sich häufig über Kleinigkeiten?", scoredAnswer: "yes" },
      { key: "25", text: "Ist Ihnen häufig zum Weinen zumute?", scoredAnswer: "yes" },
      { key: "26", text: "Fällt es Ihnen schwer, sich zu konzentrieren?", scoredAnswer: "yes" },
      { key: "27", text: "Genießen Sie das morgendliche Aufstehen?", scoredAnswer: "no" },
      { key: "28", text: "Gehen Sie geselligen Veranstaltungen lieber aus dem Weg?", scoredAnswer: "yes" },
      { key: "29", text: "Können Sie sich leicht entscheiden?", scoredAnswer: "no" },
      { key: "30", text: "Sind Sie geistig so rege wie früher?", scoredAnswer: "no" },
    ],
  },
};

function getQuestionnaireResponse(data, definition, itemKey) {
  const value = data?.responses?.[itemKey];
  const options = definition.responseOptions || QUESTIONNAIRE_RESPONSE_OPTIONS;
  return options.some((option) => option.value === value) ? value : null;
}

function getQuestionnaireAnsweredCount(data, definition) {
  return definition.items.reduce(
    (count, item) => count + Number(getQuestionnaireResponse(data, definition, item.key) !== null),
    0
  );
}

function getQuestionnaireTotal(data, definition) {
  return definition.items.reduce(
    (sum, item) => {
      const response = getQuestionnaireResponse(data, definition, item.key);
      if (response === null) return sum;
      if (definition.scoringMode === "keyed-binary") {
        return sum + Number(response === item.scoredAnswer);
      }
      return sum + response;
    },
    0
  );
}

function isQuestionnaireManual(data) {
  if (data?.entry_mode === "manual") return true;
  if (data?.entry_mode === "items") return false;
  return Object.keys(data?.responses || {}).length === 0;
}

function getQuestionnaireManualTotal(data, definition) {
  const value = data?.manual_total;
  const max = definition.max;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
    ? value
    : null;
}

function getQuestionnaireEffectiveTotal(data, definition) {
  return isQuestionnaireManual(data)
    ? getQuestionnaireManualTotal(data, definition)
    : getQuestionnaireTotal(data, definition);
}

function normalizeMaterialEntry(item, fallbackKey) {
  if (item && typeof item === "object") {
    return {
      ...item,
      key: item.key || item.id || item.word || item.w || fallbackKey,
      label: item.label || item.word || item.w || item.key || fallbackKey,
    };
  }
  return {
    key: fallbackKey || item,
    label: item,
  };
}

const WORD_TRANSLATIONS = {
  en: {
    Trommel: "drum", Vorhang: "curtain", Glocke: "bell", Kaffee: "coffee", Schule: "school", Eltern: "parents", Mond: "moon", Garten: "garden", Hut: "hat", Bauer: "farmer", Nase: "nose", Truthahn: "turkey", Farbe: "color", Haus: "house", Fluss: "river",
    Geige: "violin", Fenster: "window", Lampe: "lamp", Museum: "museum", Tee: "tea", Reise: "trip", Sonne: "sun", Wiese: "meadow", Treppe: "stairs", Maurer: "bricklayer", Zunge: "tongue", Tiger: "tiger", Musik: "music", Stadt: "city", See: "lake",
    Horn: "horn", Tür: "door", Seil: "rope", Kakao: "cocoa", Gericht: "dish", Wagen: "carriage", Sterne: "stars", Baum: "tree", Mantel: "coat", Pfarrer: "pastor", Mund: "mouth", Gans: "goose", Form: "shape", Land: "country", Regen: "rain",
    Trompete: "trumpet", Regal: "shelf", Kamin: "fireplace", Suppe: "soup", Schwester: "sister", Messer: "knife", Jacke: "jacket", Wald: "forest", Aufzug: "elevator", Lager: "camp", Kinn: "chin", Leopard: "leopard", Tanz: "dance", Sand: "sand", Teich: "pond",
    Tisch: "table", Förster: "forester", Vogel: "bird", Schuh: "shoe", Ofen: "oven", Berg: "mountain", Handtuch: "towel", Brille: "glasses", Wolke: "cloud", Boot: "boat", Lamm: "lamb", Gewehr: "rifle", Bleistift: "pencil", Kirsche: "cherry", Arm: "arm",
    Vase: "vase", Lehrer: "teacher", Kuh: "cow", Fisch: "fish", Kuchen: "cake", Garbe: "sheaf", Maus: "mouse", Locke: "curl", Jäger: "hunter", Stille: "silence", Mut: "courage", Mauer: "wall", Bein: "leg", Schaf: "sheep", Warten: "waiting", Pauke: "kettledrum", Kinder: "children",
    Flöte: "flute", Riese: "giant", Licht: "light", Urlaub: "vacation", Gras: "grass", Neige: "slope", Klee: "clover", Wonne: "delight", Glas: "glass", Sieger: "winner", Rampe: "ramp", Stufe: "step", Löwe: "lion",
    Geweih: "antlers", Hund: "dog", Huhn: "chicken", Degen: "rapier", Milch: "milk", Hand: "hand", Gesicht: "face", Beil: "hatchet", Mandel: "almond", Norm: "norm", Auto: "car",
    Schornstein: "chimney", Tango: "tango", Lage: "position", legal: "legal", Stirn: "forehead", Wall: "rampart", Schuppe: "scale", Backe: "cheek", Bruder: "brother", Gabel: "fork",
    Butter: "butter", Strand: "beach", Brief: "letter", Königin: "queen", Hütte: "hut", Stange: "pole", Karte: "card", Motor: "engine", Kirche: "church", Dollar: "dollar", Fünf: "five", Hotel: "hotel", Pantoffel: "slipper", Dorf: "village", Band: "ribbon", Heer: "army",
  },
  tr: {
    Trommel: "davul", Vorhang: "perde", Glocke: "zil", Kaffee: "kahve", Schule: "okul", Eltern: "ebeveynler", Mond: "ay", Garten: "bahçe", Hut: "şapka", Bauer: "çiftçi", Nase: "burun", Truthahn: "hindi", Farbe: "renk", Haus: "ev", Fluss: "nehir",
    Geige: "keman", Fenster: "pencere", Lampe: "lamba", Museum: "müze", Tee: "çay", Reise: "seyahat", Sonne: "güneş", Wiese: "çayır", Treppe: "merdiven", Maurer: "duvarcı", Zunge: "dil", Tiger: "kaplan", Musik: "müzik", Stadt: "şehir", See: "göl",
    Horn: "boynuz", Tür: "kapı", Seil: "ip", Kakao: "kakao", Gericht: "yemek", Wagen: "araba", Sterne: "yıldızlar", Baum: "ağaç", Mantel: "palto", Pfarrer: "papaz", Mund: "ağız", Gans: "kaz", Form: "şekil", Land: "ülke", Regen: "yağmur",
    Trompete: "trompet", Regal: "raf", Kamin: "şömine", Suppe: "çorba", Schwester: "kız kardeş", Messer: "bıçak", Jacke: "ceket", Wald: "orman", Aufzug: "asansör", Lager: "kamp", Kinn: "çene", Leopard: "leopar", Tanz: "dans", Sand: "kum", Teich: "gölet",
    Tisch: "masa", Förster: "ormancı", Vogel: "kuş", Schuh: "ayakkabı", Ofen: "fırın", Berg: "dağ", Handtuch: "havlu", Brille: "gözlük", Wolke: "bulut", Boot: "tekne", Lamm: "kuzu", Gewehr: "tüfek", Bleistift: "kurşun kalem", Kirsche: "kiraz", Arm: "kol",
    Vase: "vazo", Lehrer: "öğretmen", Kuh: "inek", Fisch: "balık", Kuchen: "pasta", Garbe: "demet", Maus: "fare", Locke: "bukle", Jäger: "avcı", Stille: "sessizlik", Mut: "cesaret", Mauer: "duvar", Bein: "bacak", Schaf: "koyun", Warten: "bekleme", Pauke: "timpani", Kinder: "çocuklar",
    Flöte: "flüt", Riese: "dev", Licht: "ışık", Urlaub: "tatil", Gras: "çimen", Neige: "eğim", Klee: "yonca", Wonne: "sevinç", Glas: "bardak", Sieger: "kazanan", Rampe: "rampa", Stufe: "basamak", Löwe: "aslan",
    Geweih: "geyik boynuzu", Hund: "köpek", Huhn: "tavuk", Degen: "meç", Milch: "süt", Hand: "el", Gesicht: "yüz", Beil: "balta", Mandel: "badem", Norm: "norm", Auto: "otomobil",
    Schornstein: "baca", Tango: "tango", Lage: "konum", legal: "yasal", Stirn: "alın", Wall: "sur", Schuppe: "pul", Backe: "yanak", Bruder: "erkek kardeş", Gabel: "çatal",
    Butter: "tereyağı", Strand: "plaj", Brief: "mektup", Königin: "kraliçe", Hütte: "kulübe", Stange: "direk", Karte: "kart", Motor: "motor", Kirche: "kilise", Dollar: "dolar", Fünf: "beş", Hotel: "otel", Pantoffel: "terlik", Dorf: "köy", Band: "kurdele", Heer: "ordu",
  },
  ru: {
    Trommel: "барабан", Vorhang: "занавес", Glocke: "колокол", Kaffee: "кофе", Schule: "школа", Eltern: "родители", Mond: "луна", Garten: "сад", Hut: "шляпа", Bauer: "фермер", Nase: "нос", Truthahn: "индейка", Farbe: "цвет", Haus: "дом", Fluss: "река",
    Geige: "скрипка", Fenster: "окно", Lampe: "лампа", Museum: "музей", Tee: "чай", Reise: "поездка", Sonne: "солнце", Wiese: "луг", Treppe: "лестница", Maurer: "каменщик", Zunge: "язык", Tiger: "тигр", Musik: "музыка", Stadt: "город", See: "озеро",
    Horn: "рог", Tür: "дверь", Seil: "верёвка", Kakao: "какао", Gericht: "блюдо", Wagen: "повозка", Sterne: "звёзды", Baum: "дерево", Mantel: "пальто", Pfarrer: "священник", Mund: "рот", Gans: "гусь", Form: "форма", Land: "страна", Regen: "дождь",
    Trompete: "труба", Regal: "полка", Kamin: "камин", Suppe: "суп", Schwester: "сестра", Messer: "нож", Jacke: "куртка", Wald: "лес", Aufzug: "лифт", Lager: "лагерь", Kinn: "подбородок", Leopard: "леопард", Tanz: "танец", Sand: "песок", Teich: "пруд",
    Tisch: "стол", Förster: "лесник", Vogel: "птица", Schuh: "ботинок", Ofen: "печь", Berg: "гора", Handtuch: "полотенце", Brille: "очки", Wolke: "облако", Boot: "лодка", Lamm: "ягнёнок", Gewehr: "ружьё", Bleistift: "карандаш", Kirsche: "вишня", Arm: "рука",
    Vase: "ваза", Lehrer: "учитель", Kuh: "корова", Fisch: "рыба", Kuchen: "пирог", Garbe: "сноп", Maus: "мышь", Locke: "локон", Jäger: "охотник", Stille: "тишина", Mut: "смелость", Mauer: "стена", Bein: "нога", Schaf: "овца", Warten: "ожидание", Pauke: "литавра", Kinder: "дети",
    Flöte: "флейта", Riese: "великан", Licht: "свет", Urlaub: "отпуск", Gras: "трава", Neige: "наклон", Klee: "клевер", Wonne: "радость", Glas: "стакан", Sieger: "победитель", Rampe: "пандус", Stufe: "ступень", Löwe: "лев",
    Geweih: "рога", Hund: "собака", Huhn: "курица", Degen: "шпага", Milch: "молоко", Hand: "кисть", Gesicht: "лицо", Beil: "топорик", Mandel: "миндаль", Norm: "норма", Auto: "машина",
    Schornstein: "дымоход", Tango: "танго", Lage: "положение", legal: "легальный", Stirn: "лоб", Wall: "вал", Schuppe: "чешуйка", Backe: "щека", Bruder: "брат", Gabel: "вилка",
    Butter: "масло", Strand: "пляж", Brief: "письмо", Königin: "королева", Hütte: "хижина", Stange: "шест", Karte: "карта", Motor: "мотор", Kirche: "церковь", Dollar: "доллар", Fünf: "пять", Hotel: "отель", Pantoffel: "тапок", Dorf: "деревня", Band: "лента", Heer: "армия",
  },
  ar: {
    Trommel: "طبل", Vorhang: "ستارة", Glocke: "جرس", Kaffee: "قهوة", Schule: "مدرسة", Eltern: "والدان", Mond: "قمر", Garten: "حديقة", Hut: "قبعة", Bauer: "مزارع", Nase: "أنف", Truthahn: "ديك رومي", Farbe: "لون", Haus: "بيت", Fluss: "نهر",
    Geige: "كمان", Fenster: "نافذة", Lampe: "مصباح", Museum: "متحف", Tee: "شاي", Reise: "رحلة", Sonne: "شمس", Wiese: "مرج", Treppe: "درج", Maurer: "بنّاء", Zunge: "لسان", Tiger: "نمر", Musik: "موسيقى", Stadt: "مدينة", See: "بحيرة",
    Horn: "قرن", Tür: "باب", Seil: "حبل", Kakao: "كاكاو", Gericht: "طبق", Wagen: "عربة", Sterne: "نجوم", Baum: "شجرة", Mantel: "معطف", Pfarrer: "قس", Mund: "فم", Gans: "إوزة", Form: "شكل", Land: "بلد", Regen: "مطر",
    Trompete: "بوق", Regal: "رف", Kamin: "مدفأة", Suppe: "حساء", Schwester: "أخت", Messer: "سكين", Jacke: "سترة", Wald: "غابة", Aufzug: "مصعد", Lager: "مخيم", Kinn: "ذقن", Leopard: "فهد", Tanz: "رقص", Sand: "رمل", Teich: "بركة",
    Tisch: "طاولة", Förster: "حارس غابة", Vogel: "طائر", Schuh: "حذاء", Ofen: "فرن", Berg: "جبل", Handtuch: "منشفة", Brille: "نظارة", Wolke: "سحابة", Boot: "قارب", Lamm: "حمل", Gewehr: "بندقية", Bleistift: "قلم رصاص", Kirsche: "كرز", Arm: "ذراع",
    Vase: "مزهرية", Lehrer: "معلم", Kuh: "بقرة", Fisch: "سمكة", Kuchen: "كعكة", Garbe: "حزمة", Maus: "فأر", Locke: "خصلة شعر", Jäger: "صياد", Stille: "صمت", Mut: "شجاعة", Mauer: "جدار", Bein: "ساق", Schaf: "خروف", Warten: "انتظار", Pauke: "طبل كبير", Kinder: "أطفال",
    Flöte: "ناي", Riese: "عملاق", Licht: "ضوء", Urlaub: "إجازة", Gras: "عشب", Neige: "ميل", Klee: "برسيم", Wonne: "بهجة", Glas: "كأس", Sieger: "فائز", Rampe: "منحدر", Stufe: "درجة", Löwe: "أسد",
    Geweih: "قرون غزال", Hund: "كلب", Huhn: "دجاجة", Degen: "سيف", Milch: "حليب", Hand: "يد", Gesicht: "وجه", Beil: "بلطة", Mandel: "لوز", Norm: "معيار", Auto: "سيارة",
    Schornstein: "مدخنة", Tango: "تانغو", Lage: "موضع", legal: "قانوني", Stirn: "جبهة", Wall: "سور", Schuppe: "قشرة", Backe: "خد", Bruder: "أخ", Gabel: "شوكة",
    Butter: "زبدة", Strand: "شاطئ", Brief: "رسالة", Königin: "ملكة", Hütte: "كوخ", Stange: "عمود", Karte: "بطاقة", Motor: "محرك", Kirche: "كنيسة", Dollar: "دولار", Fünf: "خمسة", Hotel: "فندق", Pantoffel: "شبشب", Dorf: "قرية", Band: "شريط", Heer: "جيش",
  },
  uk: {
    Trommel: "барабан", Vorhang: "завіса", Glocke: "дзвін", Kaffee: "кава", Schule: "школа", Eltern: "батьки", Mond: "місяць", Garten: "сад", Hut: "капелюх", Bauer: "фермер", Nase: "ніс", Truthahn: "індик", Farbe: "колір", Haus: "дім", Fluss: "річка",
    Geige: "скрипка", Fenster: "вікно", Lampe: "лампа", Museum: "музей", Tee: "чай", Reise: "подорож", Sonne: "сонце", Wiese: "луг", Treppe: "сходи", Maurer: "муляр", Zunge: "язик", Tiger: "тигр", Musik: "музика", Stadt: "місто", See: "озеро",
    Horn: "ріг", Tür: "двері", Seil: "мотузка", Kakao: "какао", Gericht: "страва", Wagen: "віз", Sterne: "зірки", Baum: "дерево", Mantel: "пальто", Pfarrer: "священник", Mund: "рот", Gans: "гуска", Form: "форма", Land: "країна", Regen: "дощ",
    Trompete: "труба", Regal: "полиця", Kamin: "камін", Suppe: "суп", Schwester: "сестра", Messer: "ніж", Jacke: "куртка", Wald: "ліс", Aufzug: "ліфт", Lager: "табір", Kinn: "підборіддя", Leopard: "леопард", Tanz: "танець", Sand: "пісок", Teich: "ставок",
    Tisch: "стіл", Förster: "лісник", Vogel: "птах", Schuh: "черевик", Ofen: "піч", Berg: "гора", Handtuch: "рушник", Brille: "окуляри", Wolke: "хмара", Boot: "човен", Lamm: "ягня", Gewehr: "рушниця", Bleistift: "олівець", Kirsche: "вишня", Arm: "рука",
    Vase: "ваза", Lehrer: "учитель", Kuh: "корова", Fisch: "риба", Kuchen: "пиріг", Garbe: "сніп", Maus: "миша", Locke: "локон", Jäger: "мисливець", Stille: "тиша", Mut: "сміливість", Mauer: "стіна", Bein: "нога", Schaf: "вівця", Warten: "очікування", Pauke: "литавра", Kinder: "діти",
    Flöte: "флейта", Riese: "велетень", Licht: "світло", Urlaub: "відпустка", Gras: "трава", Neige: "нахил", Klee: "конюшина", Wonne: "радість", Glas: "склянка", Sieger: "переможець", Rampe: "пандус", Stufe: "сходинка", Löwe: "лев",
    Geweih: "роги", Hund: "собака", Huhn: "курка", Degen: "шпага", Milch: "молоко", Hand: "кисть", Gesicht: "обличчя", Beil: "топірець", Mandel: "мигдаль", Norm: "норма", Auto: "авто",
    Schornstein: "димар", Tango: "танго", Lage: "положення", legal: "легальний", Stirn: "лоб", Wall: "вал", Schuppe: "луска", Backe: "щока", Bruder: "брат", Gabel: "виделка",
    Butter: "масло", Strand: "пляж", Brief: "лист", Königin: "королева", Hütte: "хатина", Stange: "жердина", Karte: "картка", Motor: "мотор", Kirche: "церква", Dollar: "долар", Fünf: "п’ять", Hotel: "готель", Pantoffel: "капці", Dorf: "село", Band: "стрічка", Heer: "армія",
  },
  pl: {
    Trommel: "bęben", Vorhang: "zasłona", Glocke: "dzwon", Kaffee: "kawa", Schule: "szkoła", Eltern: "rodzice", Mond: "księżyc", Garten: "ogród", Hut: "kapelusz", Bauer: "rolnik", Nase: "nos", Truthahn: "indyk", Farbe: "kolor", Haus: "dom", Fluss: "rzeka",
    Geige: "skrzypce", Fenster: "okno", Lampe: "lampa", Museum: "muzeum", Tee: "herbata", Reise: "podróż", Sonne: "słońce", Wiese: "łąka", Treppe: "schody", Maurer: "murarz", Zunge: "język", Tiger: "tygrys", Musik: "muzyka", Stadt: "miasto", See: "jezioro",
    Horn: "róg", Tür: "drzwi", Seil: "lina", Kakao: "kakao", Gericht: "danie", Wagen: "wóz", Sterne: "gwiazdy", Baum: "drzewo", Mantel: "płaszcz", Pfarrer: "ksiądz", Mund: "usta", Gans: "gęś", Form: "kształt", Land: "kraj", Regen: "deszcz",
    Trompete: "trąbka", Regal: "regał", Kamin: "kominek", Suppe: "zupa", Schwester: "siostra", Messer: "nóż", Jacke: "kurtka", Wald: "las", Aufzug: "winda", Lager: "obóz", Kinn: "podbródek", Leopard: "lampart", Tanz: "taniec", Sand: "piasek", Teich: "staw",
    Tisch: "stół", Förster: "leśniczy", Vogel: "ptak", Schuh: "but", Ofen: "piec", Berg: "góra", Handtuch: "ręcznik", Brille: "okulary", Wolke: "chmura", Boot: "łódź", Lamm: "jagnię", Gewehr: "karabin", Bleistift: "ołówek", Kirsche: "wiśnia", Arm: "ręka",
    Vase: "wazon", Lehrer: "nauczyciel", Kuh: "krowa", Fisch: "ryba", Kuchen: "ciasto", Garbe: "snop", Maus: "mysz", Locke: "lok", Jäger: "myśliwy", Stille: "cisza", Mut: "odwaga", Mauer: "mur", Bein: "noga", Schaf: "owca", Warten: "czekanie", Pauke: "kocioł", Kinder: "dzieci",
    Flöte: "flet", Riese: "olbrzym", Licht: "światło", Urlaub: "urlop", Gras: "trawa", Neige: "nachylenie", Klee: "koniczyna", Wonne: "rozkosz", Glas: "szklanka", Sieger: "zwycięzca", Rampe: "rampa", Stufe: "stopień", Löwe: "lew",
    Geweih: "poroże", Hund: "pies", Huhn: "kura", Degen: "szpada", Milch: "mleko", Hand: "dłoń", Gesicht: "twarz", Beil: "siekierka", Mandel: "migdał", Norm: "norma", Auto: "samochód",
    Schornstein: "komin", Tango: "tango", Lage: "położenie", legal: "legalny", Stirn: "czoło", Wall: "wał", Schuppe: "łuska", Backe: "policzek", Bruder: "brat", Gabel: "widelec",
    Butter: "masło", Strand: "plaża", Brief: "list", Königin: "królowa", Hütte: "chata", Stange: "drążek", Karte: "karta", Motor: "silnik", Kirche: "kościół", Dollar: "dolar", Fünf: "pięć", Hotel: "hotel", Pantoffel: "pantofel", Dorf: "wieś", Band: "wstążka", Heer: "armia",
  },
};

function translateWord(language, word) {
  return WORD_TRANSLATIONS[normalizeTestLanguage(language)]?.[word] || word;
}

function translatedWordEntries(language, words) {
  return words.map((word) => ({ key: word, label: translateWord(language, word) }));
}

function translatedRecognitionEntries(language, items) {
  return items.map((item) => ({ key: item.w, label: translateWord(language, item.w), t: item.t }));
}

function getVlmtMaterials(language) {
  const normalized = normalizeTestLanguage(language);
  if (normalized === "de") {
    return { lists: VLMT_LISTS, interference: VLMT_INTERFERENCE, recognition: VLMT_RECOG };
  }
  return {
    lists: Object.fromEntries(
      Object.entries(VLMT_LISTS).map(([key, words]) => [key, translatedWordEntries(normalized, words)])
    ),
    interference: translatedWordEntries(normalized, VLMT_INTERFERENCE),
    recognition: Object.fromEntries(
      Object.entries(VLMT_RECOG).map(([key, items]) => [key, translatedRecognitionEntries(normalized, items)])
    ),
  };
}

function getCeradWordlistMaterials(language) {
  const normalized = normalizeTestLanguage(language);
  if (normalized === "de") {
    return { wordlist: CERAD_WORDLIST, recognitionItems: CERAD_WL_RECOG_ITEMS };
  }
  return {
    wordlist: translatedWordEntries(normalized, CERAD_WORDLIST),
    recognitionItems: CERAD_WL_RECOG_ITEMS.map((item) => ({
      key: item.word,
      label: translateWord(normalized, item.word),
      isOrig: item.isOrig,
    })),
  };
}

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
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Impressum</div>
          <Button
            type="button"
            onClick={onClose}
            size="sm"
            variant="secondary"
          >
            Schließen
          </Button>
        </div>
        <div className="text-sm space-y-2 leading-relaxed">
          <p><strong>Betreiber*in:</strong> Forschungsgruppe Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum</p>
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

function SystemUpdateReminder({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true" aria-labelledby="system-update-reminder-title">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg">
        <div id="system-update-reminder-title" className="text-lg font-semibold">iPadOS-Update prüfen</div>
        <p className="mt-2 text-sm text-zinc-700">
          Bitte prüfe vor Beginn der Testung, ob ein iPadOS-Update aussteht. Systemupdates sollten nur außerhalb laufender Testungen installiert werden.
        </p>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="primary" onClick={onClose}>Verstanden</Button>
        </div>
      </div>
    </div>
  );
}

function TestbereicheModal({ open, onClose, onOpenTest }) {
  const [openSections, setOpenSections] = useState({});
  if (!open) return null;
  const onOpen = (route) => {
    if (!onOpenTest || !route) return;
    onClose();
    onOpenTest(route);
  };
  const toggleSection = (key) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };
  const bereiche = [
    {
      titel: "Epileptologie – Lokalisationsdiagnostik, prächirurgische und Verlaufsdiagnostik + Neurochirurgie",
      items: [
        { name: "Strukturierte Anamnese einschl. psychiatrischer Screeningfragen", testRoute: null },
        { name: "VLMT", testRoute: "vlmt" },
        { name: "DCS-R", testRoute: "dcsr" },
        { name: "EpiTrack (TMT A & B, Interferenz,  Zahlenspanne rückwärts,  Labyrinth,    Wortflüssigkeit phonematisch [P, L])", testRoute: "epi" },
        { name: "Stroop (Farbwörter lesen, Farbstriche benennen, Farb-Wort Interferenz)", testRoute: "stroop" },
        { name: "Zahlenspanne vorwärts und rückwärts", testRoute: "spannen_menu" },
        { name: "Blockspanne vorwärts und rückwärts", testRoute: "spannen_menu" },
        { name: "Wortflüssigkeit phonematisch (P, G-R) und semantisch (Tier, Sportarten + Früchte)", testRoute: "rwt" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
        { name: "QOLIE-31", testRoute: null },
      ],
    },
    {
      titel: "Epileptologie – kognitives Screening zu Medikamentennebenwirkungen",
      items: [
        { name: "Strukturierte Anamnese einschl. psychiatrischer Screeningfragen", testRoute: null },
        { name: "EpiTrack (TMT A & B, Interferenz, Zahlenspanne rückwärts, Labyrinth, Wortflüssigkeit phonematisch)", testRoute: "epi" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
      ],
    },
    {
      titel: "Kognitives Leistungsprofil/Allgemeine Neurologie",
      items: [
        { name: "Strukturierte Anamnese einschl. Screening-Fragen Depression/Ängste", testRoute: null },
        { name: "VLMT", testRoute: "vlmt" },
        { name: "Rey-Figur – Copy", testRoute: null },
        { name: "TMT A & B", testRoute: "tmt_ab" },
        { name: "Zahlenspanne vorwärts und rückwärts", testRoute: "spannen_menu" },
        { name: "Stroop (Farbwörter lesen, Farben benennen, Farb-Wort Interferenz)", testRoute: "stroop" },
        { name: "Wortflüssigkeit phonematisch (P, G-R) und semantisch (Tier, Sportarten + Früchte)", testRoute: "rwt" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
      ],
    },
    {
      titel: "THS-Indikationsprüfung",
      items: [
        { name: "Strukturierte Anamnese einschl. Screening-Fragen Depression/Ängste", testRoute: null },
        { name: "ACE-III", testRoute: "ace" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
      ],
    },
    {
      titel: "Kognitiver Status/Orientierende Testung",
      items: [
        { name: "Strukturierte Anamnese einschl. psychiatrischer Screeningfragen und Abfrage der Orientierung", testRoute: null },
        { name: "ACE-III", testRoute: "ace" },
        { name: "MoCA", testRoute: "moca" },
      ],
    },
    {
      titel: "V. a. Normaldruckhydrozephalus (NPH)",
      subtitle: "Vor und nach Entlastungspunktion:",
      items: [
        { name: "Strukturierte Anamnese einschl. Screening-Fragen Depression/Ängste", testRoute: null },
        { name: "EpiTrack (TMT A & B, Interferenz, Zahlenspanne rückwärts,  Labyrinth,    Wortflüssigkeit phonematisch)", testRoute: "epi" },
        { name: "Grooved Pegboard", testRoute: "gp" },
        { name: "MoCA", testRoute: "moca" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
      ],
    },
    {
      titel: "Demenz-Diagnostik/Memory Clinic",
      items: [
        { name: "Strukturierte Anamnese einschl. Screening-Fragen Depression/Ängste und Abfrage der Orientierung", testRoute: null },
        { name: "CERAD+", testRoute: "cerad_menu" },
        { name: "Zahlenspanne vorwärts und rückwärts", testRoute: "spannen_menu" },
        { name: "Uhrentest", testRoute: "uhr" },
        { name: "PHQ-9 und GAD-7", testRoute: "frageboegen_menu" },
        { name: "GDS", testRoute: "gds" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg max-h-[85vh] overflow-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-lg font-semibold">Testungsaufbau für verschiedene Fragestellungen</div>
            <p className="text-sm text-zinc-600 mt-1">Direktstart verfügbarer Tests mit einem Klick. Nicht digital verfügbare Module sind hier abgelegt.</p>
          </div>
          <Button
            type="button"
            onClick={onClose}
            size="sm"
            variant="secondary"
            className="shrink-0"
          >
            Schließen
          </Button>
        </div>
        <div className="space-y-3 text-sm">
          {bereiche.map((bereich) => (
            <section
              key={bereich.titel}
              className="rounded-xl border border-zinc-200 bg-zinc-50"
            >
              <Button
                size="bare"
                className="w-full p-3 cursor-pointer flex items-center justify-between gap-2 border-b border-zinc-200"
                onClick={() => toggleSection(bereich.titel)}
              >
                <span className="text-left font-semibold leading-tight">{bereich.titel}</span>
                <span className="text-xs text-zinc-500">
                  {openSections[bereich.titel] ? "▾" : "▸"}
                </span>
              </Button>
              <div
                className="overflow-hidden transition-all duration-200"
                style={{ maxHeight: openSections[bereich.titel] ? "2000px" : "0px" }}
                aria-hidden={!openSections[bereich.titel]}
              >
                <div className="p-3 pt-2 space-y-2">
                  {bereich.subtitle && <p className="text-sm italic text-zinc-600">{bereich.subtitle}</p>}
                  {bereich.items.map((item) => (
                    <div
                      key={item.name}
                      className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <span>{item.name}</span>
                      <Button
                        type="button"
                        onClick={() => onOpen(item.testRoute)}
                        disabled={!item.testRoute}
                        size="sm"
                        variant={item.testRoute ? "primary" : "subtle"}
                        className="w-full sm:w-auto justify-self-start sm:justify-self-end text-xs sm:text-sm"
                      >
                        {item.testRoute ? "Test starten" : "Nicht digital verfügbar"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
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
      <Button size="bare"
        type="submit"
        className="w-full px-3 py-2 rounded-xl border bg-zinc-900 text-white disabled:opacity-60"
        disabled={submitting}
      >
        {submitting ? "Prüfen..." : "Anmelden"}
      </Button>
    </form>
  );
}

// Epi-Track: echte UI mit Stopwatches, Countdown und Span-Übernahme
function EpiTrackWire({ sessionData, onImportInv, onPersistTime, onAbort, onSendTmt }) {
  const subs = [
    { id: "zahlen_interferenz", label: "Zahleninterferenz", type: "stopwatch" },
    { id: "zahlen_verbinden", label: "Zahlen verbinden", type: "stopwatch", limit: 180_000 },
    { id: "zahlen_buchstaben", label: "Zahlen-Buchstaben", type: "stopwatch", limit: 300_000 },
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
                autoAbortMs={s.limit}
                onAutoAbort={(info) => {
                  onPersistTime && onPersistTime(s.id, s.limit);
                  onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: s.limit, at: info?.at || Date.now(), subtest: s.id });
                }}
              />
            )}
            {s.type === "stopwatch" && ["zahlen_verbinden", "zahlen_buchstaben"].includes(s.id) && (
              <div className="flex flex-wrap gap-2">
                <Button size="bare"
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
                </Button>
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
                  <Button size="bare"
                    type="button"
                    disabled={!longestFromZahlRev}
                    onClick={() => onImportInv && onImportInv(longestFromZahlRev)}
                    className={cls(
                      "px-3 py-2 rounded-xl border text-sm",
                      !longestFromZahlRev && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    aus Zahlenspanne rückwärts übernehmen
                  </Button>
                  <Button size="bare"
                    type="button"
                    onClick={() => onImportInv && onImportInv(0)}
                    className="px-3 py-2 rounded-xl border text-sm"
                    title="Feld leeren/zurücksetzen"
                  >
                    Eingabe leeren
                  </Button>
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

const DCSR_MAX_CORRECT_PER_TRIAL = 9;

const DCSR_RATINGS = [
  { key: "R", field: "richtig", label: "Richtig", variant: "success", className: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { key: "F", field: "falsch", label: "Falsch", variant: "danger", className: "bg-rose-50 border-rose-200 text-rose-800" },
  { key: "D", field: "gedreht", label: "Gedreht", variant: "warning", className: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "P", field: "perseveration", label: "Perseveration", variant: "info", className: "bg-sky-50 border-sky-200 text-sky-800" },
];

const DCSR_RATING_FIELDS = DCSR_RATINGS.reduce((acc, rating) => {
  acc[rating.key] = rating.field;
  return acc;
}, {});

const DCSR_RATING_LABELS = DCSR_RATINGS.reduce((acc, rating) => {
  acc[rating.key] = rating.label;
  return acc;
}, {});

const normalizeDcsrGalleryEntry = (entry) => {
  if (typeof entry === "string") return { key: entry, rating: null };
  if (!entry || typeof entry !== "object" || typeof entry.key !== "string") return null;
  return {
    key: entry.key,
    rating: DCSR_RATING_FIELDS[entry.rating] ? entry.rating : null,
  };
};

const normalizeDcsrGalleryEntries = (entries) => (
  Array.isArray(entries) ? entries.map(normalizeDcsrGalleryEntry).filter(Boolean) : []
);

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

async function loadDcsrFigureGalleries(sessionData) {
  const dcsr = sessionData?.dcsr || {};
  const galleryKeysByDg = Array.isArray(dcsr.drawingGalleryKeys) ? dcsr.drawingGalleryKeys : [];
  const out = Array.from({ length: 5 }, () => []);
  await Promise.all(out.map(async (_, dgIdx) => {
    const entries = normalizeDcsrGalleryEntries(galleryKeysByDg[dgIdx]);
    if (!entries.length) return;
    const data = await Promise.all(entries.map((entry) => idbGetDrawing(entry.key)));
    out[dgIdx] = entries
      .map((entry, idx) => {
        const val = data[idx];
        if (!val) return null;
        return {
          src: val instanceof Blob ? URL.createObjectURL(val) : val,
          rating: entry.rating,
        };
      })
      .filter(Boolean);
  }));
  return out;
}

// Build flat export row (CSV) with curated keys; skips große Blobs wie DCS-Zeichnungen
async function buildExportRow(sessionData, sessionUUID, opts = {}) {
  const s = sessionData || {};
  const row = { session_uuid: sessionUUID };
  const includeDrawings = !!opts.includeDrawings;
  const drawingsData = includeDrawings ? (opts.drawingsData || []) : [];
  const toSchoolLabel = (years) => {
    if (years === 9 || years === "9") return "Haupt-/Volksschulabschluss";
    if (years === 10 || years === "10") return "Realschulabschluss";
    if (years === 12 || years === "12") return "Fachhochschulreife";
    if (years === 13 || years === "13") return "Abitur/Hochschulreife";
    return "";
  };
  const toTrainingLabel = (code) => {
    if (code === "lehre_3") return "Ausbildung/Lehre: 3 Jahre";
    if (code === "bachelor") return "Bachelor";
    if (code === "master") return "Master (Bachelor+Master)";
    if (code === "promotion") return "Promotion";
    return "Keine";
  };

  const msToSec = (ms) => (typeof ms === "number" ? Math.round(ms / 1000) : null);

  // Basisdaten
  const demo = s.demographics || {};
  row.demographics_patient_initials = demo.patient_initials || "";
  row.demographics_patient_age = demo.patient_age || "";
  row.demographics_patient_gender = demo.patient_gender || "";
  row.demographics_examiner_initials = demo.examiner_initials || "";
  row.demographics_education_school_years = demo.education_school_years ?? "";
  row.demographics_education_school_label = demo.education_school_label || toSchoolLabel(demo.education_school_years);
  row.demographics_education_training_label = demo.education_training_label || toTrainingLabel(demo.education_training_code);
  row.demographics_education_dissertation_years = demo.education_dissertation_years ?? "";
  row.demographics_education_training_years = demo.education_training_years ?? "";
  row.demographics_education_years = demo.education_years ?? "";
  const startedAt = typeof s.testing_started_at === "number" ? s.testing_started_at : null;
  const startedDate = startedAt ? new Date(startedAt) : null;
  row.testing_start_date = startedDate ? startedDate.toLocaleDateString("de-DE") : "";
  row.testing_start_time = startedDate ? startedDate.toLocaleTimeString("de-DE") : "";

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
  const stroopGeneralNote = s.stroop_notes?.general || "";
  row.stroop_notes_woerter = stroopGeneralNote || s.stroop_notes?.woerter || "";
  row.stroop_notes_farbstriche = stroopGeneralNote || s.stroop_notes?.farbstriche || "";
  row.stroop_notes_interferenz = stroopGeneralNote || s.stroop_notes?.interferenz || "";

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

  // ACE-III — bewusst ganz am Ende angehängt, um bestehende CSV-Spaltenreihenfolge stabil zu halten
  const ace = s.ace || {};
  const aceScores = ace.scores || {};
  const hasAce = Object.keys(aceScores).length > 0 || Object.keys(ace.raw || {}).length > 0 || !!ace.notes || !!s.ace_aborted;
  ACE_SECTIONS.forEach((section) => {
    row[`ace_${section.key}_score`] = hasAce ? getAceSectionScore(ace, section) : null;
    section.items.forEach((item) => {
      row[`ace_${section.key}_${item.key}`] = hasAce ? getAceItemScore(ace, item) : null;
    });
  });
  row.ace_total = hasAce ? getAceTotal(ace) : null;
  row.ace_notes = ace.notes || "";
  row.ace_aborted = s.ace_aborted ? 1 : 0;
  row.ace_fluency_letter_raw = ace.raw?.letter_fluency?.count ?? "";
  row.ace_fluency_letter_transcript = ace.raw?.letter_fluency?.transcript || "";
  row.ace_fluency_animal_raw = ace.raw?.animal_fluency?.count ?? "";
  row.ace_fluency_animal_transcript = ace.raw?.animal_fluency?.transcript || "";

  // MoCA — ebenfalls nur anhängen, damit alle bestehenden Exportspalten unverändert bleiben
  const moca = s.moca || {};
  const mocaScores = moca.scores || {};
  const hasMoca = Object.keys(mocaScores).length > 0 || Object.keys(moca.raw || {}).length > 0 || !!moca.notes || !!s.moca_aborted;
  const mocaLanguage = normalizeTestLanguage(moca.language || s.demographics?.test_language);
  const mocaVariant = getMocaVariant(mocaLanguage, moca.version);
  row.moca_version = hasMoca ? mocaVariant.exportVersion : "";
  MOCA_SECTIONS.forEach((section) => {
    row[`moca_${section.key}_score`] = hasMoca ? getMocaSectionScore(moca, section) : null;
    section.items.forEach((item) => {
      row[`moca_${section.key}_${item.key}`] = hasMoca ? getMocaItemScore(moca, item) : null;
    });
  });
  row.moca_raw_total = hasMoca ? getMocaRawTotal(moca) : null;
  // Aus Kompatibilitätsgründen bleiben die beiden bereits angehängten Spalten leer.
  // Eine Bildungskorrektur wird für den MoCA in dieser App nicht berechnet.
  row.moca_education_years = "";
  row.moca_education_correction = "";
  row.moca_total = hasMoca ? getMocaTotal(moca) : null;
  row.moca_learning_trial_1 = hasMoca ? countMocaMarks(moca.raw?.learning?.runs?.[0]?.marks) : null;
  row.moca_learning_trial_2 = hasMoca ? countMocaMarks(moca.raw?.learning?.runs?.[1]?.marks) : null;
  row.moca_vigilance_errors = moca.raw?.vigilance?.errors ?? "";
  row.moca_fluency_raw = moca.raw?.letter_fluency?.count ?? "";
  row.moca_fluency_transcript = moca.raw?.letter_fluency?.transcript || "";
  row.moca_delayed_recall_cues = moca.raw?.delayed_recall?.cues
    ? JSON.stringify(moca.raw.delayed_recall.cues)
    : "";
  row.moca_notes = moca.notes || "";
  row.moca_aborted = s.moca_aborted ? 1 : 0;

  // Fragebögen — am Ende angehängt, damit die bestehende Exportstruktur stabil bleibt
  Object.entries(QUESTIONNAIRE_DEFINITIONS).forEach(([key, definition]) => {
    const data = s[key] || {};
    const manualMode = isQuestionnaireManual(data);
    const manualTotal = getQuestionnaireManualTotal(data, definition);
    const answeredCount = getQuestionnaireAnsweredCount(data, definition);
    const hasQuestionnaire = data.entry_mode === "manual" || manualTotal !== null || answeredCount > 0 || !!data.notes || !!s[`${key}_aborted`];
    row[`${key}_entry_mode`] = hasQuestionnaire ? (manualMode ? "manual" : "items") : "";
    definition.items.forEach((item) => {
      row[`${key}_item_${item.key}`] = hasQuestionnaire && !manualMode
        ? getQuestionnaireResponse(data, definition, item.key)
        : null;
    });
    row[`${key}_answered_count`] = hasQuestionnaire && !manualMode ? answeredCount : null;
    row[`${key}_manual_total`] = hasQuestionnaire && manualMode ? manualTotal : null;
    row[`${key}_completed`] = hasQuestionnaire
      ? Number(manualMode ? manualTotal !== null : answeredCount === definition.items.length)
      : null;
    row[`${key}_total`] = hasQuestionnaire ? getQuestionnaireEffectiveTotal(data, definition) : null;
    row[`${key}_notes`] = data.notes || "";
    row[`${key}_aborted`] = s[`${key}_aborted`] ? 1 : 0;
  });

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
          <input
            className="flex-1 rounded-xl border p-2"
            value={comment}
            onChange={(e) => {
              const next = e.target.value;
              setComment(next);
              onPersistNote && onPersistNote(next);
            }}
            aria-label="Notiz"
            placeholder="Notiz"
          />
        </div>
      </div>
    </section>
  );
}

const OptBtn = ({ selected, ok, onSelect, children, testid }) => (
  <Button size="bare"
    type="button"
    data-testid={testid}
    onClick={() => { onSelect && onSelect("click"); }}
    className={cls(
      "px-4 py-2 rounded-xl border text-base select-none inline-flex items-center gap-2 touch-manipulation",
      selected ? (ok ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200") : "bg-white border-zinc-300"
    )}
  >
    <span>{children}</span>
  </Button>
);

function AttemptsRow({ title, seq1, seq2, val, onChange, stacked = false }) {
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
      <div className={cls(stacked ? "flex flex-col gap-3" : "flex items-center justify-between gap-6")}>
        {renderSegment("v1", seq1)}
        <div className={cls(stacked ? "h-px w-full bg-zinc-300/70" : "w-px self-stretch bg-zinc-300/70")} />
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
          <Button size="bare"
            type="button"
            onClick={onBackToSpanMenu}
            onTouchEnd={(e) => { e.preventDefault(); onBackToSpanMenu && onBackToSpanMenu(); }}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur Auswahl
          </Button>
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
          <Button size="bare" onClick={()=> onExtraAction && onExtraAction(longest)} className="px-3 py-2 rounded-xl border">{extraActionLabel}</Button>
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
          <Button size="bare"
            type="button"
            onClick={onBackToSpanMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur Auswahl
          </Button>
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

const ACE_VERSION_OPTIONS = ["A", "B", "C"];
const ACE_VERSION_MATERIALS = {
  A: {
    words: ["Zitrone", "Schlüssel", "Ball"],
    nameAddress: ["Peter Müller", "Dorf Straße 73", "Wolfsburg", "Niedersachsen"],
    addressScoreItems: ["Peter", "Müller", "Dorf", "Straße", "73", "Wolfsburg", "Niedersachsen"],
    recognitionChoices: [
      { key: "name", label: "Name", recallItems: ["Peter", "Müller"], options: ["Hans Müller", "Peter Müller", "Peter Schmidt"], correct: "Peter Müller" },
      { key: "number", label: "Hausnummer", recallItems: ["73"], options: ["37", "73", "76"], correct: "73" },
      { key: "street", label: "Straße", recallItems: ["Dorf", "Straße"], options: ["Dorf Gasse", "Land Straße", "Dorf Straße"], correct: "Dorf Straße" },
      { key: "city", label: "Ort", recallItems: ["Wolfsburg"], options: ["Kassel", "Wolfsburg", "Braunschweig"], correct: "Wolfsburg" },
      { key: "state", label: "Bundesland", recallItems: ["Niedersachsen"], options: ["Niedersachsen", "Sachsen-Anhalt", "Baden-Württemberg"], correct: "Niedersachsen" },
    ],
  },
  B: {
    words: ["Apfel", "Münze", "Stuhl"],
    nameAddress: ["Karin Schmidt", "Lindenallee 59", "Freiburg", "Baden-Württemberg"],
    addressScoreItems: ["Karin", "Schmidt", "Linden", "Allee", "59", "Freiburg", "Baden-Württemberg"],
    recognitionChoices: [
      { key: "name", label: "Name", recallItems: ["Karin", "Schmidt"], options: ["Karin Schmidt", "Sarah Müller", "Karin Schuster"], correct: "Karin Schmidt" },
      { key: "number", label: "Hausnummer", recallItems: ["59"], options: ["39", "52", "59"], correct: "59" },
      { key: "street", label: "Straße", recallItems: ["Linden", "Allee"], options: ["Lindenallee", "Gartenallee", "Lindenstraße"], correct: "Lindenallee" },
      { key: "city", label: "Ort", recallItems: ["Freiburg"], options: ["Freiburg", "Stuttgart", "Frankfurt"], correct: "Freiburg" },
      { key: "state", label: "Bundesland", recallItems: ["Baden-Württemberg"], options: ["Niedersachsen", "Sachsen-Anhalt", "Baden-Württemberg"], correct: "Baden-Württemberg" },
    ],
  },
  C: {
    words: ["Schuh", "Fahne", "Baum"],
    nameAddress: ["Robert Meier", "Marktstraße 24", "München", "Bayern"],
    addressScoreItems: ["Robert", "Meier", "Markt", "Straße", "24", "München", "Bayern"],
    recognitionChoices: [
      { key: "name", label: "Name", recallItems: ["Robert", "Meier"], options: ["Robert Schmidt", "Robert Meier", "Rolf Meier"], correct: "Robert Meier" },
      { key: "number", label: "Hausnummer", recallItems: ["24"], options: ["42", "28", "24"], correct: "24" },
      { key: "street", label: "Straße", recallItems: ["Markt", "Straße"], options: ["Marktstraße", "Hauptstraße", "Marktplatz"], correct: "Marktstraße" },
      { key: "city", label: "Ort", recallItems: ["München"], options: ["München", "Bremen", "Dortmund"], correct: "München" },
      { key: "state", label: "Bundesland", recallItems: ["Bayern"], options: ["Rheinland-Pfalz", "Bayern", "Sachsen"], correct: "Bayern" },
    ],
  },
};
const ACE_NAME_ADDRESS_PART_LABELS = [
  "Vorname",
  "Nachname",
  "Straßenname – Teil 1",
  "Straßenname – Teil 2",
  "Hausnummer",
  "Ort",
  "Region/Bundesland",
];
const ACE_RETROGRADE_QUESTIONS = [
  "Name des/der amtierenden Bundeskanzlers/in",
  "Name des/der amtierenden Bundespräsidenten/in",
  "Name des/der amtierenden Präsidenten/in der USA",
  "Name des US-amerikanischen Präsidenten, der in den 1960ern ermordet wurde",
];
const ACE_FIGURE_SCORING = {
  infinity: [
    "Zwei Unendlichkeitssymbole sind vorhanden, überschneiden sich und sehen nicht wie einfache Kreise aus",
  ],
  cube: [
    "Allgemeine dreidimensionale Würfelform ist erhalten",
    "Alle 12 Linien sind vorhanden",
  ],
};

const ACE_GUIDELINE_SCORE_OPTIONS = {
  sentence_writing: [
    {
      score: 0,
      label: "Kein Satz oder nur ein Satz mit Grammatik- und/oder Rechtschreibfehlern",
    },
    {
      score: 1,
      label: "Ein fehlerfreier vollständiger Satz oder zwei vollständige Sätze mit Grammatik- und/oder Rechtschreibfehlern",
    },
    {
      score: 2,
      label: "Zwei grammatikalisch und orthografisch korrekte vollständige Sätze",
    },
  ],
};

const ACE_LANGUAGE_NEUTRAL_MATERIAL_PREFIXES = {
  registration: "Wort",
  retrograde_memory: "Frage",
  recall_words: "Wort",
  recall_name_address: "Adressbestandteil",
  comprehension: "Anweisung",
  repetition_words: "Wort",
  repetition_sentences: "Satz",
  naming: "Bild",
  semantic_association: "Aufgabe",
  reading: "Wort",
};

function getTestLanguageLabel(language) {
  const normalized = normalizeTestLanguage(language);
  return TEST_LANGUAGE_OPTIONS.find((option) => option.code === normalized)?.label || "Deutsch";
}

function normalizeAceVersion(version) {
  return ACE_VERSION_OPTIONS.includes(version) ? version : "A";
}

function getAceVersionMaterials(version) {
  return ACE_VERSION_MATERIALS[normalizeAceVersion(version)];
}

function getAceItemMaterials(item, aceVersion) {
  const versionMaterials = getAceVersionMaterials(aceVersion);
  if (item.key === "registration" || item.key === "recall_words") return versionMaterials.words;
  if (item.key === "anterograde_memory" || item.key === "recall_name_address") return versionMaterials.addressScoreItems;
  return Array.isArray(item.materials) ? item.materials : [];
}

function getAceMaterialEntries(item, testLanguage, aceVersion) {
  const materials = getAceItemMaterials(item, aceVersion);
  const normalizedLanguage = normalizeTestLanguage(testLanguage);
  if (item.key === "serial_subtraction") {
    return materials.map((material, index) => ({
      key: material,
      label: `${index + 1}. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: ${material}`,
    }));
  }
  if (normalizedLanguage === "de") {
    return materials.map((material) => ({ key: material, label: material }));
  }

  if (item.key === "letter_fluency" || item.key === "animal_fluency") {
    return materials.map((material) => ({
      key: material,
      label: "Vorgabe gemäß gedruckter Sprachversion",
    }));
  }

  if (item.key === "recall_name_address") {
    return materials.map((material, index) => ({
      key: material,
      label: ACE_NAME_ADDRESS_PART_LABELS[index] || `Adressbestandteil ${index + 1}`,
    }));
  }

  const prefix = ACE_LANGUAGE_NEUTRAL_MATERIAL_PREFIXES[item.key];
  if (!prefix) return materials.map((material) => ({ key: material, label: material }));
  return materials.map((material, index) => ({ key: material, label: `${prefix} ${index + 1}` }));
}

function AceMaterialHeading({ children }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</div>;
}

function AceMaterial({ item, testLanguage }) {
  const type = item.materialType;
  if (!type) return null;
  const usePrintedLanguageVersion = normalizeTestLanguage(testLanguage) !== "de";

  if (type === "name-address") return null;
  if (type === "retrograde") return null;
  if (type === "recognition") return null;
  if (usePrintedLanguageVersion && (type === "comprehension" || type === "writing")) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        Anweisung aus der gedruckten ACE-III-Version in {getTestLanguageLabel(testLanguage)} verwenden.
      </div>
    );
  }
  if (type === "comprehension") return <div className="rounded-xl border bg-zinc-50 p-3 text-sm"><span className="font-semibold">Probe:</span> „Heben Sie den Stift auf und dann das Blatt Papier.“ Bei korrekter Ausführung mit den drei bewerteten Anweisungen fortfahren und Stift sowie Papier jeweils neu vorlegen.</div>;
  if (type === "writing") return <div className="rounded-xl border bg-zinc-50 p-3 text-sm">Bitte schreiben Sie zwei vollständige Sätze. Inhalt frei wählbar; jeder Satz benötigt Subjekt und Verb.</div>;
  if (type === "repetition-words" || type === "repetition-sentences") return null;
  if (type === "naming") return null;
  if (type === "reading") return null;
  if (["infinity", "cube", "clock", "dots", "letters"].includes(type)) return null;
  return null;
}

const ACE_SECTIONS = [
  {
    key: "attention",
    title: "Aufmerksamkeit",
    max: 18,
    items: [
      {
        key: "orientation_time",
        label: "Orientierung – Zeit",
        max: 5,
        prompt: "Fragen zu Wochentag, Datum, Monat, Jahr und Jahreszeit stellen.",
        hint: "Datum: ± 2 Tage zulässig. Beim Jahreszeitenwechsel kann nach einer möglichen anderen Jahreszeit gefragt werden.",
        materials: ["Wochentag", "Datum", "Monat", "Jahr", "Jahreszeit"],
      },
      {
        key: "orientation_place",
        label: "Orientierung – Ort",
        max: 5,
        prompt: "Fragen zum aktuellen Ort stellen.",
        hint: "In der Wohnumgebung gleichwertige Ortsmerkmale verwenden. Bei auswärtigen Personen kann eine passende benachbarte Ortsangabe großzügig bewertet werden.",
        materials: ["Zimmer/Etage", "Straße/Krankenhaus", "Stadt", "Bundesland", "Land"],
      },
      {
        key: "registration",
        label: "Einprägen / Wiederholen",
        max: 3,
        prompt: "Drei Wörter vorlesen, nachsprechen lassen und für später merken lassen. Nur der erste Versuch wird bewertet.",
        hint: "Bei Bedarf bis zu drei Versuche durchführen; ausschließlich den ersten Versuch markieren.",
        materials: ACE_VERSION_MATERIALS.A.words,
      },
      {
        key: "serial_subtraction",
        label: "Aufmerksamkeit / serielles Rechnen",
        max: 5,
        prompt: "Von 100 fortlaufend 7 abziehen lassen; nach fünf Subtraktionen stoppen.",
        hint: "Nach einem Fehler nicht korrigieren oder unterbrechen. Jeden folgenden Rechenschritt ausgehend von der unmittelbar vorherigen Antwort bewerten.",
        materials: ["93", "86", "79", "72", "65"],
      },
    ],
  },
  {
    key: "memory",
    title: "Gedächtnis",
    max: 26,
    items: [
      { key: "recall_words", label: "Wörter erinnern", max: 3, prompt: "Welche drei Wörter hatte ich Sie gebeten zu wiederholen und sich zu merken?", materials: ACE_VERSION_MATERIALS.A.words },
      { key: "anterograde_memory", label: "Name und Adresse einprägen", max: 7, prompt: "Name und Adresse vorlesen und dreimal wiederholen lassen. Der dritte Versuch wird bewertet.", materialType: "name-address", materials: ACE_VERSION_MATERIALS.A.addressScoreItems },
      { key: "retrograde_memory", label: "Retrogrades Gedächtnis", max: 4, prompt: "Allgemeinwissensbezogene Gedächtnisfragen stellen.", hint: "Der korrekte Nachname genügt. Bei einem kürzlichen Amtswechsel auch den vorherigen Amtsinhaber erfragen.", materialType: "retrograde", materials: ACE_RETROGRADE_QUESTIONS },
      { key: "recall_name_address", label: "Abruf Name und Adresse", max: 7, prompt: "Name und Adresse, die am Anfang wiederholt wurden, frei abrufen lassen.", materialType: "name-address", materials: ACE_VERSION_MATERIALS.A.addressScoreItems },
      { key: "recognition", label: "Wiedererkennen", max: 5, prompt: "Nur durchführen, wenn mindestens ein Item beim freien Abruf nicht genannt wurde.", materialType: "recognition" },
    ],
  },
  {
    key: "fluency",
    title: "Wortflüssigkeit",
    max: 14,
    items: [
      { key: "letter_fluency", label: "Phonematische Wortflüssigkeit", max: 7, prompt: "Eine Minute Wörter mit dem vorgegebenen Buchstaben nennen lassen.", hint: "Als korrekt zählen keine Wiederholungen, Flexionsvarianten desselben Wortes, Falschnennungen, Eigennamen oder Pluralvarianten.", materials: ["Buchstabe: P"], timed: true, fluencyType: "letter" },
      { key: "animal_fluency", label: "Semantische Wortflüssigkeit", max: 7, prompt: "Eine Minute lang so viele Tiere wie möglich nennen lassen.", hint: "Oberkategorie plus genannte Arten sowie verschiedene Geschlechter derselben Tierart jeweils nur einmal zählen. Insekten, Menschen, ausgestorbene und mythische Tiere sind zulässig.", materials: ["Kategorie: Tiere"], timed: true, fluencyType: "animal" },
    ],
  },
  {
    key: "language",
    title: "Sprache",
    max: 26,
    items: [
      { key: "comprehension", label: "Verstehen / Handlungsanweisungen", max: 3, prompt: "Stift und Papier bereitlegen und die Anweisungen durchführen lassen.", materialType: "comprehension", materials: ["Blatt Papier auf den Stift legen", "Stift anheben, aber nicht das Blatt Papier", "Stift reichen, nachdem das Blatt Papier berührt wurde"] },
      { key: "sentence_writing", label: "Sätze schreiben", max: 2, prompt: "Patient:in schreibt die Sätze auf Papier; hier anhand der Kriterien bewerten.", materialType: "writing" },
      { key: "repetition_words", label: "Wörter nachsprechen", max: 2, prompt: "Die vier Wörter einzeln vorlesen und Nachsprechen bewerten.", hint: "Nur der erste Versuch wird bewertet. Stockende, forcierte oder undeutliche Aussprache gilt als falsch.", materialType: "repetition-words", materials: ["Butterblume", "Exzentriker", "unentzifferbar", "Statistiker"], scoringMode: "all-or-three" },
      { key: "repetition_sentences", label: "Sätze nachsprechen", max: 2, prompt: "Die beiden Sätze vorlesen und Nachsprechen bewerten.", hint: "Je vollständig korrekt wiederholtem Sprichwort 1 Punkt; teilweise korrekte Wiederholungen zählen nicht.", materialType: "repetition-sentences", materials: ["Es ist nicht alles Gold, was glänzt.", "Der frühe Vogel fängt den Wurm."] },
      {
        key: "naming",
        label: "Benennen",
        max: 12,
        prompt: "Gedrucktes Testmaterial zeigen und jede korrekte Benennung markieren.",
        hint: "Akzeptiert werden auch: Kamel oder Dromedar; Fass oder Tonne; Krokodil oder Alligator; Ziehharmonika, Akkordeon, Handharmonika oder Quetschkommode.",
        materialType: "naming",
        materials: ["Löffel", "Buch", "Känguru", "Pinguin", "Anker", "Kamel/Dromedar", "Harfe", "Nashorn", "Fass/Tonne", "Krone", "Krokodil", "Ziehharmonika"],
      },
      { key: "semantic_association", label: "Semantisches Wissen", max: 4, prompt: "Mit Hilfe der gezeigten Bilder passende Zuordnungen erfragen.", hint: "Je korrekter Bildauswahl 1 Punkt. Selbstverbesserungen sind erlaubt; keine Rückmeldung zur Wortbedeutung geben.", materials: ["Wird mit Monarchie in Verbindung gebracht", "Stellt ein Beuteltier dar", "Kann in der Antarktis gefunden werden", "Hat einen Bezug zur Seefahrt"] },
      {
        key: "reading",
        label: "Wörter lesen",
        max: 1,
        prompt: "Gedrucktes Testmaterial zeigen und jedes korrekt gelesene Wort markieren. Ein Punkt wird nur vergeben, wenn alle fünf Wörter korrekt sind.",
        materialType: "reading",
        materials: ["Uhr", "Maß", "fort", "platt", "Schrank"],
        scoringMode: "all-or-none",
      },
    ],
  },
  {
    key: "visuospatial",
    title: "Visuell-räumliche Fähigkeiten",
    max: 16,
    items: [
      { key: "infinity", label: "Unendlichkeitssymbol abzeichnen", max: 1, hint: "Patient:in zeichnet auf Papier; hier nur Punkte vergeben.", materialType: "infinity" },
      { key: "cube", label: "Würfel abzeichnen", max: 2, hint: "Patient:in zeichnet auf Papier; hier nur Punkte vergeben.", materialType: "cube" },
      { key: "clock", label: "Uhr zeichnen", max: 5, hint: "Patient:in zeichnet auf Papier; hier nur Punkte vergeben.", materialType: "clock" },
      {
        key: "dots",
        label: "Punkte zählen",
        max: 4,
        prompt: "Gedrucktes Testmaterial zeigen und jede korrekte Antwort markieren.",
        hint: "Die Punkte dürfen nicht mit dem Finger abgezählt werden. Bei Aphasie ist eine schriftliche Antwort zulässig.",
        materialType: "dots",
        materials: ["1. Feld: 8 Punkte", "2. Feld: 10 Punkte", "3. Feld: 7 Punkte", "4. Feld: 9 Punkte"],
      },
      {
        key: "letters",
        label: "Buchstaben identifizieren",
        max: 4,
        prompt: "Gedrucktes Testmaterial zeigen und jeden korrekt identifizierten Buchstaben markieren.",
        hint: "Zeigen mit dem Finger ist erlaubt. Bei Aphasie sind eine schriftliche Antwort oder der entsprechende Laut zulässig.",
        materialType: "letters",
        materials: ["K", "M", "A", "T"],
      },
    ],
  },
];

const ACE_TEST_FLOW = [
  { sectionKey: "attention", itemKeys: ["orientation_time", "orientation_place", "registration", "serial_subtraction"] },
  { sectionKey: "memory", itemKeys: ["recall_words"] },
  { sectionKey: "fluency", itemKeys: ["letter_fluency", "animal_fluency"] },
  { sectionKey: "memory", itemKeys: ["anterograde_memory", "retrograde_memory"] },
  { sectionKey: "language", itemKeys: ["comprehension", "sentence_writing", "repetition_words", "repetition_sentences", "naming", "semantic_association", "reading"] },
  { sectionKey: "visuospatial", itemKeys: ["infinity", "cube", "clock", "dots", "letters"] },
  { sectionKey: "memory", itemKeys: ["recall_name_address", "recognition"] },
];

function getAceSectionScore(ace, section) {
  return section.items.reduce((sum, item) => sum + getAceItemScore(ace, item), 0);
}

function getAceTotal(ace) {
  return ACE_SECTIONS.reduce((sum, section) => sum + getAceSectionScore(ace, section), 0);
}

function isAceRecognitionAutomatic(ace) {
  return Number(ace?.scores?.recall_name_address || 0) >= 7;
}

function getAceRecallAddressMarks(ace) {
  const versionMaterials = getAceVersionMaterials(ace?.version);
  const storedMarks = ace?.raw?.recall_name_address?.marks;
  if (storedMarks && Object.keys(storedMarks).length > 0) return storedMarks;
  const score = Math.max(0, Math.min(7, Number(ace?.scores?.recall_name_address) || 0));
  return Object.fromEntries(versionMaterials.addressScoreItems.slice(0, score).map((material) => [material, 1]));
}

function getAceRecognitionScore(ace) {
  if (isAceRecognitionAutomatic(ace)) return 5;
  const recognitionChoices = getAceVersionMaterials(ace?.version).recognitionChoices;
  const recallMarks = getAceRecallAddressMarks(ace);
  const responses = ace?.raw?.recognition?.responses || {};
  return recognitionChoices.reduce((score, group) => {
    const recalled = group.recallItems.every((material) => !!recallMarks[material]);
    const recognized = responses[group.key] === group.correct;
    return score + (recalled || recognized ? 1 : 0);
  }, 0);
}

function getAceItemScore(ace, item) {
  const score = item.key === "recognition"
    ? getAceRecognitionScore(ace)
    : Number(ace?.scores?.[item.key] || 0);
  return Math.max(0, Math.min(item.max, score));
}

function scoreAceFluency(type, count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (type === "letter") {
    if (n >= 18) return 7;
    if (n >= 14) return 6;
    if (n >= 11) return 5;
    if (n >= 8) return 4;
    if (n >= 6) return 3;
    if (n >= 4) return 2;
    if (n >= 2) return 1;
    return 0;
  }
  if (n >= 22) return 7;
  if (n >= 17) return 6;
  if (n >= 14) return 5;
  if (n >= 11) return 4;
  if (n >= 9) return 3;
  if (n >= 7) return 2;
  if (n >= 5) return 1;
  return 0;
}

function RWTModeMenu({ onSelect }) {
  return (
    <Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Button size="bare" onClick={() => onSelect("phon_simple")} className="h-28 rounded-2xl border bg-white">Einfache phonematische Wortflüssigkeit</Button>
        <Button size="bare" onClick={() => onSelect("phon_complex")} className="h-28 rounded-2xl border bg-white">Komplexe phonematische Wortflüssigkeit</Button>
        <Button size="bare" onClick={() => onSelect("sem_simple")} className="h-28 rounded-2xl border bg-white">Einfache semantische Wortflüssigkeit</Button>
        <Button size="bare" onClick={() => onSelect("sem_complex")} className="h-28 rounded-2xl border bg-white">Komplexe semantische Wortflüssigkeit</Button>
      </div>
    </Card>
  );
}

function RWTTestPanel({ meta, modeKey, sessionData, onPersist, onClose }) {
  const persisted = (sessionData?.rwt || {})[modeKey] || {};
  const [opt, setOpt] = useState(persisted.version || "");
  const [notes, setNotes] = useState(persisted.notes || "");
  const [sum, setSum] = useState(typeof persisted.sum === "number" ? persisted.sum : (persisted.sum || ""));

  useEffect(() => {
    const p = (sessionData?.rwt || {})[modeKey] || {};
    const frameId = requestAnimationFrame(() => {
      setOpt(p.version || "");
      setNotes(p.notes || "");
      setSum(typeof p.sum === "number" ? p.sum : (p.sum || ""));
    });
    return () => cancelAnimationFrame(frameId);
  }, [modeKey, sessionData]);

  const persist = (patch) => onPersist && onPersist(modeKey, patch);
  const versionSelected = !!opt;
  const setWordCount = (updater) => {
    if (!versionSelected) return;
    const current = Number(sum) || 0;
    const val = updater(current);
    const clamped = Math.max(0, val);
    setSum(clamped);
    persist({ sum: clamped });
  };

  return (
    <Card>
      <div className="text-center text-2xl font-semibold mb-2">{meta.title}</div>
      {!versionSelected && (
        <div className="mb-2 text-center text-sm text-zinc-600">Bitte zuerst eine Version wählen.</div>
      )}
      <div className="flex items-center justify-center gap-4 mb-3">
        {meta.options.map((o) => (
          <Button size="bare"
            key={o}
            onClick={() => { setOpt(o); persist({ version: o }); }}
            className={cls("px-5 py-2 rounded-xl border text-lg", opt === o ? "bg-zinc-100 border-zinc-300" : "bg-white border-zinc-300")}
          >
            {o}
          </Button>
        ))}
      </div>
      <div className={cls(
        "mt-4 grid md:grid-cols-2 gap-4 items-start rounded-2xl border p-3",
        versionSelected ? "bg-white border-zinc-200" : "bg-zinc-50 border-zinc-200 opacity-50"
      )}>
        <div className="space-y-3 md:col-span-1">
          <Countdown60 disabled={!versionSelected} />
        </div>
        <div className="space-y-2 md:col-span-1">
          <label className="block text-sm">Summe Wörter</label>
          <div className="flex items-stretch gap-3">
            <Button size="bare"
            type="button"
            onClick={() => setWordCount((v) => v + 1)}
            disabled={!versionSelected}
              className={cls(
                "px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16",
                !versionSelected && "cursor-not-allowed opacity-60"
              )}
            >
              +1 Wort
            </Button>
            <input
              className={cls(
                "w-32 rounded-xl border px-3 text-lg h-16",
                !versionSelected && "cursor-not-allowed bg-zinc-100 opacity-60"
              )}
              placeholder="0"
              inputMode="numeric"
              value={sum}
              disabled={!versionSelected}
                onChange={(e) => {
                  if (!versionSelected) return;
                  const v = e.target.value;
                  const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                  setSum(n);
                  persist({ sum: n === "" ? null : Number(n) });
                }}
            />
            <Button size="bare"
            type="button"
            onClick={() => setWordCount((v) => v - 1)}
            disabled={!versionSelected}
              className={cls(
                "px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16",
                !versionSelected && "cursor-not-allowed opacity-60"
              )}
            >
              -1 Wort
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <textarea
          className={cls(
            "w-full rounded-xl border p-2 h-52",
            !versionSelected && "cursor-not-allowed bg-zinc-100 opacity-60"
          )}
          value={notes}
          aria-label="Notiz"
          placeholder="Notiz"
          disabled={!versionSelected}
          onChange={(e) => {
            const next = e.target.value;
            setNotes(next);
            if (versionSelected) persist({ notes: next });
          }}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="bare" onClick={onClose} className="px-4 py-2.5 rounded-xl border bg-zinc-900 text-white text-sm">Fertig</Button>
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

const CLOCK_SCORE_PARTS = [
  { key: "kreis" },
  { key: "nummern1" },
  { key: "nummern2" },
  { key: "zeiger1" },
  { key: "zeiger2" },
];

const CLOCK_SCORE_GROUPS = [
  {
    key: "kreis",
    title: "Kreis",
    max: 1,
    options: [
      { score: 0, label: "Kein akzeptabler Kreis" },
      { score: 1, label: "Akzeptabler Kreis" },
    ],
  },
  {
    key: "nummern",
    title: "Zahlen",
    max: 2,
    options: [
      { score: 0, label: "Nicht alle Zahlen vorhanden" },
      { score: 1, label: "Alle Zahlen vorhanden, aber außerhalb oder unregelmäßig verteilt" },
      { score: 2, label: "Alle Zahlen gleichmäßig innerhalb des Kreises verteilt (leichte Gesamtdrehung zulässig)" },
    ],
  },
  {
    key: "zeiger",
    title: "Zeiger",
    max: 2,
    options: [
      { score: 0, label: "Nur ein Zeiger oder keine der Bedingungen für einen Zeigerpunkt erfüllt" },
      { score: 1, label: "Beide Zeiger vorhanden: richtige Uhrzeit bei falschem Längenverhältnis oder nur ein Zeiger zeigt mit richtiger Länge die richtige Zeit" },
      { score: 2, label: "Beide Zeiger zeigen mit korrektem Längenverhältnis die richtige Uhrzeit" },
    ],
  },
];

const scoreClockParts = (parts = {}) => CLOCK_SCORE_PARTS.reduce(
  (sum, part) => sum + (parts[part.key] ? 1 : 0),
  0
);

const deriveClockPartsFromScore = (value) => {
  const score = typeof value === "number" ? Math.max(0, Math.min(5, value)) : 0;
  return Object.fromEntries(CLOCK_SCORE_PARTS.map((part, index) => [part.key, index < score]));
};

const normalizeClockParts = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  if (["nummern1", "nummern2", "zeiger1", "zeiger2"].some((key) => key in raw)) {
    return Object.fromEntries(CLOCK_SCORE_PARTS.map((part) => [part.key, !!raw[part.key]]));
  }
  if (["nummern", "zeiger"].some((key) => key in raw)) {
    return {
      kreis: !!raw.kreis,
      nummern1: !!raw.nummern,
      nummern2: !!raw.nummern,
      zeiger1: !!raw.zeiger,
      zeiger2: !!raw.zeiger,
    };
  }
  return null;
};

function ClockScoreButtons({ parts, onToggle }) {
  const groupScore = (group) => {
    if (group.key === "kreis") return parts.kreis ? 1 : 0;
    return Number(!!parts[`${group.key}1`]) + Number(!!parts[`${group.key}2`]);
  };
  const selectGroupScore = (group, score) => {
    const next = { ...parts };
    if (group.key === "kreis") {
      next.kreis = score === 1;
    } else {
      next[`${group.key}1`] = score >= 1;
      next[`${group.key}2`] = score >= 2;
    }
    onToggle(next);
  };

  return (
    <div className="grid gap-3">
      {CLOCK_SCORE_GROUPS.map((group) => (
        <div key={group.key} className="rounded-xl border bg-zinc-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
            <span>{group.title}</span>
            <span>{groupScore(group)} / {group.max}</span>
          </div>
          <div className="grid gap-2" role="radiogroup" aria-label={`${group.title} bewerten`}>
            {group.options.map((option) => {
              const selected = groupScore(group) === option.score;
              return (
                <Button
                  size="bare"
                  key={option.score}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectGroupScore(group, option.score)}
                  className={cls(
                    "w-full min-h-11 rounded-xl border px-3 py-2 text-left text-sm",
                    selected
                      ? option.score > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-400 bg-zinc-100 text-zinc-800"
                      : "border-zinc-300 bg-white text-zinc-800"
                  )}
                >
                  <span className="font-semibold">{option.score} {option.score === 1 ? "Punkt" : "Punkte"}</span>
                  <span className="ml-2">{option.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AceScoreInput({ item, value, onChange }) {
  const numericValue = value ?? 0;
  const isSinglePoint = item.max === 1;
  return (
    <div>
      {isSinglePoint ? (
        <Button
          type="button"
          variant={numericValue ? "success" : "secondary"}
          className="w-full justify-between"
          onClick={() => onChange(numericValue ? 0 : 1)}
        >
          <span>Korrekt</span>
          <span>{numericValue ? "✔️" : "✖️"}</span>
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={numericValue <= 0}
            onClick={() => onChange(Math.max(0, numericValue - 1))}
          >
            −
          </Button>
          <div className="w-10 text-center text-2xl font-semibold tabular-nums">{numericValue}</div>
          <div className="text-2xl font-semibold tabular-nums text-zinc-500">/ {item.max}</div>
          <Button
            variant="secondary"
            size="sm"
            disabled={numericValue >= item.max}
            onClick={() => onChange(Math.min(item.max, numericValue + 1))}
          >
            +1
          </Button>
        </div>
      )}
    </div>
  );
}

function AceGuidelineScoreButtons({ options, value, onChange }) {
  return (
    <div className="grid gap-2" role="radiogroup" aria-label="Bewertung nach Auswertungskriterien">
      {options.map((option) => {
        const selected = Number(value) === option.score;
        return (
          <Button
            size="bare"
            key={option.score}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.score)}
            className={cls(
              "w-full min-h-12 rounded-xl border px-3 py-2 text-left text-sm",
              selected
                ? option.score > 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-zinc-400 bg-zinc-100 text-zinc-800"
                : "border-zinc-300 bg-white text-zinc-800"
            )}
          >
            <span className="font-semibold">{option.score} {option.score === 1 ? "Punkt" : "Punkte"}</span>
            <span className="ml-2">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}

function AceFigureScoreButtons({ item, value, raw, onScoreChange, onRawChange }) {
  const criteria = ACE_FIGURE_SCORING[item.key] || [];
  const selected = Array.isArray(raw.criteria)
    ? criteria.map((_, index) => !!raw.criteria[index])
    : criteria.map((_, index) => index < (Number(value) || 0));

  const toggleCriterion = (index) => {
    const next = selected.slice();
    next[index] = !next[index];
    if (item.key === "cube" && index === 1 && next[1]) next[0] = true;
    if (item.key === "cube" && index === 0 && !next[0]) next[1] = false;
    const nextScore = Math.min(item.max, next.filter(Boolean).length);
    onRawChange({ ...raw, criteria: next });
    onScoreChange(nextScore);
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {criteria.map((criterion, index) => (
          <Button
            size="bare"
            key={criterion}
            type="button"
            aria-pressed={!!selected[index]}
            onClick={() => toggleCriterion(index)}
            className={cls(
              "w-full rounded-xl border px-3 py-2 text-left text-sm",
              selected[index] ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-300 bg-white"
            )}
          >
            {criterion} (1 Punkt)
          </Button>
        ))}
      </div>
    </div>
  );
}

function AceClockScoreButtons({ item, value, raw, onScoreChange, onRawChange }) {
  const parts = normalizeClockParts(raw.parts) || deriveClockPartsFromScore(value);
  const updateParts = (next) => {
    onRawChange({ ...raw, parts: next });
    onScoreChange(Math.min(item.max, scoreClockParts(next)));
  };

  return (
    <div>
      <ClockScoreButtons parts={parts} onToggle={updateParts} />
    </div>
  );
}

function AceRecognitionChoices({ ace, item, raw, testLanguage, onScoreChange, onRawChange }) {
  const responses = raw.responses && typeof raw.responses === "object" ? raw.responses : {};
  const usePrintedLanguageVersion = normalizeTestLanguage(testLanguage) !== "de";
  const recognitionChoices = getAceVersionMaterials(ace?.version).recognitionChoices;
  const recallMarks = getAceRecallAddressMarks(ace);
  const missingGroups = recognitionChoices.filter(
    (group) => !group.recallItems.every((material) => !!recallMarks[material])
  );

  const selectResponse = (group, option) => {
    const nextResponses = {
      ...responses,
      [group.key]: responses[group.key] === option ? null : option,
    };
    const nextAce = {
      ...ace,
      raw: {
        ...(ace?.raw || {}),
        recognition: { ...raw, responses: nextResponses },
      },
    };
    onRawChange({ ...raw, responses: nextResponses });
    onScoreChange(Math.min(item.max, getAceRecognitionScore(nextAce)));
  };

  return (
    <div className="space-y-3">
      <AceMaterialHeading>Antwort der Patientin bzw. des Patienten auswählen</AceMaterialHeading>
      {missingGroups.map((group, index) => (
        <div key={group.key} className="rounded-xl border bg-zinc-50 p-3">
          <div className="mb-2 text-sm font-semibold">{index + 1}. {group.label}</div>
          {usePrintedLanguageVersion && (
            <div className="mb-2 text-xs text-zinc-500">Antwortoptionen aus der gedruckten Sprachversion verwenden und hier bewerten.</div>
          )}
          <div className={cls("grid gap-2", usePrintedLanguageVersion ? "sm:grid-cols-2" : "sm:grid-cols-3")} role="radiogroup" aria-label={group.label}>
            {(usePrintedLanguageVersion
              ? [
                { value: group.correct, label: "Richtig gewählt", correct: true },
                { value: "__incorrect__", label: "Falsch gewählt", correct: false },
              ]
              : group.options.map((option) => ({ value: option, label: option, correct: option === group.correct }))
            ).map((option) => {
              const selected = responses[group.key] === option.value;
              const correct = option.correct;
              return (
                <Button
                  size="bare"
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => selectResponse(group, option.value)}
                  className={cls(
                    "flex min-h-12 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm",
                    selected
                      ? correct
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-zinc-300 bg-white text-zinc-800"
                  )}
                >
                  <span>{option.label}</span>
                  {selected && (
                    <span className="rounded-lg border bg-white px-2 py-0.5 text-xs">
                      {correct ? "Richtig" : "Falsch"}
                    </span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AceNameAddressTrials({ item, value, raw, testLanguage, aceVersion, onScoreChange, onRawChange }) {
  const [activeRun, setActiveRun] = useState(0);
  const touchStartX = useRef(null);
  const usePrintedLanguageVersion = normalizeTestLanguage(testLanguage) !== "de";
  const versionMaterials = getAceVersionMaterials(aceVersion);
  const materialEntries = versionMaterials.addressScoreItems.map((material, index) => ({
    key: material,
    label: usePrintedLanguageVersion ? ACE_NAME_ADDRESS_PART_LABELS[index] : material,
  }));
  const storedRuns = Array.isArray(raw.runs) ? raw.runs : [];
  const legacyMarks = raw.marks || Object.fromEntries(
    versionMaterials.addressScoreItems.slice(0, Number(value) || 0).map((material) => [material, 1])
  );
  const runs = Array.from({ length: 3 }, (_, index) => ({
    ...(storedRuns[index] || {}),
    marks: storedRuns[index]?.marks || (storedRuns.length === 0 && index === 2 ? legacyMarks : {}),
  }));

  const selectRun = (index) => setActiveRun(Math.max(0, Math.min(2, index)));
  const toggleMaterial = (material) => {
    const nextRuns = runs.map((run, index) => {
      if (index !== activeRun) return run;
      const marks = { ...run.marks };
      marks[material] = marks[material] ? 0 : 1;
      return {
        ...run,
        marks: Object.fromEntries(Object.entries(marks).filter(([, checked]) => checked)),
      };
    });
    const nextRaw = { ...raw, runs: nextRuns };
    delete nextRaw.marks;
    onRawChange(nextRaw);
    if (activeRun === 2) onScoreChange(Object.keys(nextRuns[2].marks).length);
  };

  const activeMarks = runs[activeRun].marks;
  const activeCount = Object.keys(activeMarks).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Einprägedurchgänge">
        {runs.map((run, index) => {
          const count = Object.keys(run.marks).length;
          const selected = activeRun === index;
          return (
            <Button
              key={index}
              type="button"
              size="bare"
              role="tab"
              aria-selected={selected}
              onClick={() => selectRun(index)}
              className={cls(
                "rounded-xl border px-2 py-2 text-sm",
                selected ? "border-indigo-700 bg-indigo-700 text-white" : "border-zinc-300 bg-white text-zinc-700"
              )}
            >
              <span className="block font-semibold">Durchgang {index + 1}</span>
              <span className={cls("block text-xs", selected ? "text-zinc-300" : "text-zinc-500")}>{count}/{item.max}</span>
            </Button>
          );
        })}
      </div>

      <div
        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 touch-pan-y"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) < 45) return;
          selectRun(activeRun + (delta < 0 ? 1 : -1));
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <AceMaterialHeading>Durchgang {activeRun + 1} von 3</AceMaterialHeading>
            {usePrintedLanguageVersion ? (
              <div className="mt-2 max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-950">
                Name und Adresse aus der gedruckten ACE-III-Version in {getTestLanguageLabel(testLanguage)} vorlesen.
              </div>
            ) : (
              <div className="mt-2 text-xl font-semibold leading-relaxed">
                {versionMaterials.nameAddress.map((line) => <div key={line}>{line}</div>)}
              </div>
            )}
          </div>
          <div className={cls(
            "shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold",
            activeRun === 2 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-zinc-200 bg-white text-zinc-600"
          )}>
            {activeRun === 2 ? `Gewertet: ${activeCount}/${item.max}` : "Ohne Wertung"}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {materialEntries.map(({ key, label }) => {
            const checked = !!activeMarks[key];
            return (
              <Button
                size="bare"
                key={key}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleMaterial(key)}
                className={cls(
                  "flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 text-left",
                  checked ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white"
                )}
              >
                <span>{label}</span>
                <span>{checked ? "✔️" : "✖️"}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" disabled={activeRun === 0} onClick={() => selectRun(activeRun - 1)}>
          ← Vorheriger Durchgang
        </Button>
        <div className="text-xs text-zinc-500">Auf der Karte nach links oder rechts wischen</div>
        <Button type="button" variant="primary" size="sm" disabled={activeRun === 2} onClick={() => selectRun(activeRun + 1)}>
          Nächster Durchgang →
        </Button>
      </div>
    </div>
  );
}

function AceTaskCard({ ace, item, value, raw = {}, testLanguage, aceVersion, onScoreChange, onRawChange }) {
  const isFluency = !!item.fluencyType;
  const isNameAddressLearning = item.key === "anterograde_memory";
  const hasFigureCriteria = !!ACE_FIGURE_SCORING[item.key];
  const isClockScoring = item.key === "clock";
  const isRecognition = item.key === "recognition";
  const isComprehension = item.key === "comprehension";
  const guidelineScoreOptions = ACE_GUIDELINE_SCORE_OPTIONS[item.key];
  const materialEntries = getAceMaterialEntries(item, testLanguage, aceVersion);
  const prompt = normalizeTestLanguage(testLanguage) !== "de" && item.key === "animal_fluency"
    ? "Eine Minute lang Wörter gemäß der Vorgabe in der gedruckten Sprachversion nennen lassen."
    : item.prompt;
  const hasScorableMaterials = materialEntries.length > 0 && (materialEntries.length === item.max || !!item.scoringMode);
  const count = raw.count ?? "";
  const transcript = raw.transcript || "";
  const comprehensionPractice = raw.practice || (
    Number(value) > 0 || Object.keys(raw.marks || {}).length > 0 ? "passed" : null
  );
  const updateCount = (nextCount) => {
    const normalized = nextCount === "" ? "" : Math.max(0, Math.floor(Number(nextCount) || 0));
    onRawChange({ ...raw, count: normalized });
    onScoreChange(scoreAceFluency(item.fluencyType, normalized));
  };
  const materialMarks = raw.marks || (hasScorableMaterials && !item.scoringMode
    ? Object.fromEntries(materialEntries.slice(0, Number(value) || 0).map(({ key }) => [key, 1]))
    : hasScorableMaterials && item.scoringMode === "all-or-none" && Number(value) === item.max
      ? Object.fromEntries(materialEntries.map(({ key }) => [key, 1]))
      : {});
  const toggleMaterial = (material) => {
    const marks = { ...materialMarks };
    marks[material] = marks[material] ? 0 : 1;
    const nextMarks = Object.fromEntries(Object.entries(marks).filter(([, checked]) => checked));
    onRawChange({ ...raw, marks: nextMarks });
    const correctCount = Object.keys(nextMarks).length;
    if (item.scoringMode === "all-or-three") {
      onScoreChange(correctCount === 4 ? 2 : correctCount === 3 ? 1 : 0);
    } else if (item.scoringMode === "all-or-none") {
      onScoreChange(correctCount === materialEntries.length ? item.max : 0);
    } else {
      onScoreChange(correctCount);
    }
  };
  const setComprehensionPractice = (practice) => {
    if (practice === "failed") {
      onRawChange({ ...raw, practice, marks: {} });
      onScoreChange(0);
      return;
    }
    onRawChange({ ...raw, practice });
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold">{item.label}</div>
          {prompt && <p className="mt-1 text-sm text-zinc-600">{prompt}</p>}
          {item.hint && <p className="mt-1 text-xs text-zinc-500">{item.hint}</p>}
        </div>
        <div className="shrink-0 text-sm text-zinc-600">
          Punkte: <span className="font-semibold tabular-nums text-zinc-900">{value ?? 0} / {item.max}</span>
        </div>
      </div>
      {!isNameAddressLearning && <AceMaterial item={item} testLanguage={testLanguage} />}
      {isComprehension && (
        <div className="rounded-xl border bg-zinc-50 p-3">
          <div className="mb-2 text-sm font-semibold">Probe vor den drei bewerteten Anweisungen</div>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Ergebnis der Verständnisprobe">
            {[
              { value: "passed", label: "Probe korrekt – fortfahren", positive: true },
              { value: "failed", label: "Probe nicht korrekt – Abschnitt beenden (0 Punkte)", positive: false },
            ].map((option) => {
              const selected = comprehensionPractice === option.value;
              return (
                <Button
                  size="bare"
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setComprehensionPractice(option.value)}
                  className={cls(
                    "min-h-12 rounded-xl border px-3 py-2 text-left text-sm",
                    selected
                      ? option.positive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                      : "border-zinc-300 bg-white text-zinc-800"
                  )}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {isNameAddressLearning && (
        <AceNameAddressTrials
          item={item}
          value={value}
          raw={raw}
          testLanguage={testLanguage}
          aceVersion={aceVersion}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}
      {hasFigureCriteria && (
        <AceFigureScoreButtons
          item={item}
          value={value}
          raw={raw}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}
      {isClockScoring && (
        <AceClockScoreButtons
          item={item}
          value={value}
          raw={raw}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}
      {isRecognition && (
        <AceRecognitionChoices
          ace={ace}
          item={item}
          raw={raw}
          testLanguage={testLanguage}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}
      {guidelineScoreOptions && (
        <AceGuidelineScoreButtons
          options={guidelineScoreOptions}
          value={value}
          onChange={onScoreChange}
        />
      )}
      {materialEntries.length > 0 && !hasScorableMaterials && (
        <div className="rounded-xl border bg-zinc-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Material / Zielantworten</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {materialEntries.map(({ key, label }) => (
              <span key={key} className="rounded-lg border bg-white px-3 py-1 text-sm">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      {hasScorableMaterials && !isNameAddressLearning && (!isComprehension || comprehensionPractice === "passed") && (
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            {materialEntries.map(({ key, label }) => {
              const checked = !!materialMarks[key];
              return (
                <Button size="bare"
                  key={key}
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleMaterial(key)}
                  className={cls(
                    "flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 text-left",
                    checked ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white"
                  )}
                >
                  <span>{label}</span>
                  <span>{checked ? "✔️" : "✖️"}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
      {isFluency && (
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <Countdown60 />
          <div className="space-y-2">
            <label className="block text-sm font-medium">Korrekte Wörter</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => updateCount((Number(count) || 0) + 1)}>+1 Wort</Button>
              <input
                className="h-11 w-28 rounded-xl border px-3 text-lg"
                inputMode="numeric"
                value={count}
                onChange={(e) => updateCount(e.target.value)}
                placeholder="0"
              />
              <Button variant="secondary" disabled={(Number(count) || 0) <= 0} onClick={() => updateCount((Number(count) || 0) - 1)}>-1 Wort</Button>
            </div>
            <textarea
              className="h-24 w-full rounded-xl border p-2 text-sm"
              value={transcript}
              onChange={(e) => onRawChange({ ...raw, transcript: e.target.value })}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
        </div>
      )}
      {!hasScorableMaterials && !isFluency && !hasFigureCriteria && !isClockScoring && !isRecognition && !guidelineScoreOptions && <AceScoreInput item={item} value={value} onChange={onScoreChange} />}
    </Card>
  );
}

function AceVersionSelection({ testLanguage, onSelect, onBack }) {
  const languageLabel = getTestLanguageLabel(testLanguage);
  return (
    <section className="py-6">
      <Header
        title="ACE-III"
        subtitle={`Testsprache: ${languageLabel}`}
      />
      <Card className="space-y-4">
        <div>
          <div className="text-xl font-semibold">ACE-Version auswählen</div>
          <p className="mt-1 text-sm text-zinc-600">Welche Parallelversion soll für diese Testung verwendet werden?</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {ACE_VERSION_OPTIONS.map((version) => (
            <Button
              size="bare"
              key={version}
              type="button"
              onClick={() => onSelect(version)}
              className="min-h-28 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4 text-left text-indigo-950 shadow-sm hover:bg-indigo-100"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-indigo-600">ACE-III</span>
              <span className="mt-1 block text-2xl font-semibold">Version {version}</span>
              <span className="mt-2 block text-sm text-indigo-700">Version verwenden →</span>
            </Button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => onBack && onBack()}>
            Zurück zum Hauptmenü
          </Button>
        </div>
      </Card>
    </section>
  );
}

function AceWire({ sessionData, testLanguage, onPersist, onAbort, onDone }) {
  const ace = sessionData?.ace || {};
  const normalizedLanguage = normalizeTestLanguage(testLanguage);
  const languageLabel = getTestLanguageLabel(normalizedLanguage);
  const scores = ace.scores || {};
  const raw = ace.raw || {};
  const notes = ace.notes || "";
  const hasLegacyAceData = Object.keys(scores).length > 0 || Object.keys(raw).length > 0 || !!notes;
  const storedVersion = ACE_VERSION_OPTIONS.includes(ace.version) ? ace.version : null;
  const aceVersion = storedVersion || (hasLegacyAceData ? "A" : null);

  if (!aceVersion) {
    return (
      <AceVersionSelection
        testLanguage={normalizedLanguage}
        onSelect={(version) => onPersist && onPersist({ version })}
        onBack={onDone}
      />
    );
  }

  const total = getAceTotal(ace);
  const persistScore = (key, max, value) => {
    const clamped = Math.max(0, Math.min(max, Number(value) || 0));
    onPersist && onPersist({ scores: { ...scores, [key]: clamped } });
  };
  const persistRaw = (key, value) => {
    onPersist && onPersist({ raw: { ...raw, [key]: value } });
  };

  return (
    <section className="py-6">
      <Header
        title="ACE-III"
        subtitle={`Version ${aceVersion} · Testsprache: ${languageLabel} · Durchführung mit gedrucktem Testmaterial`}
        right={<div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-2 text-3xl font-semibold tabular-nums shadow-sm">{total} / 100</div>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <AbortButton onAbort={onAbort} />
        {!hasLegacyAceData && storedVersion && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onPersist && onPersist({ version: null })}
          >
            Version ändern
          </Button>
        )}
      </div>
      <Card className="mb-4">
        <div className="text-sm text-zinc-700">
          Gedrucktes Testmaterial verwenden. Antworten und Bewertung werden hier erfasst; Zeichnungsaufgaben erfolgen auf Papier.
        </div>
        {normalizedLanguage !== "de" && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Für die Durchführung die offizielle ACE-III-Sprachversion in {languageLabel} verwenden. Sprachabhängige Inhalte werden in der App neutral nach Wort, Bild, Satz oder Aufgabe nummeriert; die Bewertungslogik und Exportfelder bleiben identisch.
          </div>
        )}
      </Card>
      <div className="space-y-4">
        {ACE_TEST_FLOW.map((flowStep, flowIndex) => {
          const section = ACE_SECTIONS.find(({ key }) => key === flowStep.sectionKey);
          const items = section?.items.filter((item) => (
            flowStep.itemKeys.includes(item.key) &&
            !(item.key === "recognition" && isAceRecognitionAutomatic(ace))
          )) || [];
          if (!section || items.length === 0) return null;
          const sectionScore = getAceSectionScore(ace, section);
          return (
            <section key={`${section.key}-${flowIndex}`} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>{section.title}</SectionTitle>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1 text-lg font-semibold tabular-nums text-indigo-950">
                  {sectionScore} / {section.max}
                </div>
              </div>
              <div className="grid gap-3">
                {items.map((item) => (
                  <AceTaskCard
                    key={item.key}
                    ace={ace}
                    item={item}
                    value={getAceItemScore(ace, item)}
                    raw={raw[item.key] || {}}
                    testLanguage={normalizedLanguage}
                    aceVersion={aceVersion}
                    onScoreChange={(value) => persistScore(item.key, item.max, value)}
                    onRawChange={(value) => persistRaw(item.key, value)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        <Card className="space-y-2">
          <SectionTitle>Allgemeine Notiz</SectionTitle>
          <textarea
            className="h-28 w-full rounded-xl border p-2"
            value={notes}
            onChange={(e) => onPersist && onPersist({ notes: e.target.value })}
            aria-label="Notiz"
            placeholder="Notiz"
          />
        </Card>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={() => onDone && onDone()}>
            Fertig
          </Button>
        </div>
      </div>
    </section>
  );
}

const MOCA_GERMAN_VERSION_OPTIONS = ["A", "B", "C"];

const MOCA_VARIANTS = {
  de: {
    A: {
      displayLabel: "Deutsche Version A",
      exportVersion: "A",
      figure: { label: "Würfel abzeichnen", button: "Würfel erfüllt alle Kriterien" },
      clock: { label: "Uhr zeichnen – zehn nach elf", prompt: "Eine Uhr mit allen Zahlen und der Zeit zehn nach elf zeichnen lassen." },
      naming: ["Löwe", "Nashorn", "Kamel"],
      memoryWords: ["Gesicht", "Samt", "Kirche", "Tulpe", "Rot"],
      digitForward: "2 – 1 – 8 – 5 – 4",
      digitBackward: "7 – 4 – 2",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 100,
      serialExpected: [93, 86, 79, 72, 65],
      sentences: [
        "Ich weiß lediglich, dass Hans heute an der Reihe ist zu helfen.",
        "Die Katze versteckte sich immer unter der Couch, wenn die Hunde im Zimmer waren.",
      ],
      fluencyLetter: "F",
      abstractionPractice: { text: "Banane – Orange", answer: "Beispiel: sind Früchte" },
      abstractionTasks: [
        { key: "train_bicycle", text: "Eisenbahn – Fahrrad", correctLabel: "Korrekt (sind Fahrzeuge/sind aus Metall)" },
        { key: "watch_ruler", text: "Uhr – Lineal", correctLabel: "Korrekt (sind Messinstrumente/haben Zahlen)" },
      ],
      orientation: ["Datum", "Monat", "Jahr", "Wochentag", "Ort", "Stadt"],
    },
    B: {
      displayLabel: "Deutsche Alternative Version 2",
      exportVersion: "B",
      figure: { label: "Quader nachzeichnen", button: "Quader erfüllt alle Kriterien" },
      clock: { label: "Uhr zeichnen – fünf nach vier", prompt: "Eine Uhr mit allen Zahlen und der Zeit fünf nach vier zeichnen lassen." },
      naming: ["Giraffe", "Bär", "Nilpferd"],
      memoryWords: ["Lastwagen", "Banane", "Geige", "Tisch", "Grün"],
      digitForward: "3 – 2 – 9 – 6 – 5",
      digitBackward: "8 – 5 – 2",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 90,
      serialExpected: [83, 76, 69, 62, 55],
      sentences: [
        "Ein Vogel kann in geschlossene Fenster fliegen, wenn es dunkel und windig ist.",
        "Die liebevolle Großmutter schickte Lebensmittel vor über einer Woche.",
      ],
      fluencyLetter: "K",
      abstractionPractice: { text: "Banane – Apfelsine", answer: "Beispiel: sind Früchte" },
      abstractionTasks: [
        { key: "diamond_ruby", text: "Diamant – Rubin", correctLabel: "Korrekt (sind Edelsteine/sind wertvoll)" },
        { key: "cannon_rifle", text: "Kanone – Gewehr", correctLabel: "Korrekt (sind Waffen/können schießen)" },
      ],
      orientation: ["Datum", "Monat", "Jahr", "Wochentag", "Ort", "Stadt"],
    },
    C: {
      displayLabel: "Deutsche Alternative Version 3",
      exportVersion: "C",
      figure: { label: "Zylinder nachzeichnen", button: "Zylinder erfüllt alle Kriterien" },
      clock: { label: "Uhr zeichnen – zehn nach neun", prompt: "Eine Uhr mit allen Zahlen und der Zeit zehn nach neun zeichnen lassen." },
      naming: ["Esel", "Schwein", "Känguru"],
      memoryWords: ["Zug", "Ei", "Hut", "Stuhl", "Blau"],
      digitForward: "5 – 4 – 1 – 8 – 7",
      digitBackward: "1 – 7 – 4",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 80,
      serialExpected: [73, 66, 59, 52, 45],
      sentences: [
        "Sie hörte, sein Rechtsanwalt war derjenige, der nach dem Unfall klagte.",
        "Die kleinen Mädchen, denen zu viele Süßigkeiten gegeben wurden, bekamen Magenschmerzen.",
      ],
      fluencyLetter: "M",
      abstractionPractice: { text: "Banane – Apfelsine", answer: "Beispiel: sind Früchte" },
      abstractionTasks: [
        { key: "eye_ear", text: "Auge – Ohr", correctLabel: "Korrekt (sind Sinnesorgane/Körperteile)" },
        { key: "trumpet_piano", text: "Trompete – Klavier", correctLabel: "Korrekt (sind Musikinstrumente/machen Musik)" },
      ],
      orientation: ["Datum", "Monat", "Jahr", "Wochentag", "Ort", "Stadt"],
    },
  },
  en: {
    A: {
      displayLabel: "English Version 7.1 Original",
      exportVersion: "7.1",
      figure: { label: "Copy cube", button: "Cube fulfils all criteria" },
      clock: { label: "Draw a clock – ten past eleven", prompt: "Draw a clock, put in all the numbers, and set the time to ten past eleven." },
      naming: ["Lion", "Rhinoceros", "Camel"],
      memoryWords: ["Face", "Velvet", "Church", "Daisy", "Red"],
      digitForward: "2 – 1 – 8 – 5 – 4",
      digitBackward: "7 – 4 – 2",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 100,
      serialExpected: [93, 86, 79, 72, 65],
      sentences: [
        "I only know that John is the one to help today.",
        "The cat always hid under the couch when dogs were in the room.",
      ],
      fluencyLetter: "F",
      abstractionPractice: { text: "Banana – orange", answer: "Example: fruit" },
      abstractionTasks: [
        { key: "train_bicycle", text: "Train – bicycle", correctLabel: "Correct (means of transportation/made of metal)" },
        { key: "watch_ruler", text: "Watch – ruler", correctLabel: "Correct (measuring instruments/have numbers)" },
      ],
      orientation: ["Date", "Month", "Year", "Day", "Place", "City"],
    },
  },
  pl: {
    A: {
      displayLabel: "Polska wersja 8.1",
      exportVersion: "8.1",
      figure: { label: "Skopiuj sześcian", button: "Sześcian spełnia wszystkie kryteria" },
      clock: { label: "Narysuj zegar – dziesięć po jedenastej", prompt: "Narysuj zegar ze wszystkimi liczbami i ustaw godzinę dziesięć po jedenastej." },
      naming: ["Lew", "Nosorożec", "Wielbłąd"],
      memoryWords: ["Twarz", "Aksamit", "Kościół", "Stokrotka", "Czerwony"],
      digitForward: "2 – 1 – 8 – 5 – 4",
      digitBackward: "7 – 4 – 2",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 100,
      serialExpected: [93, 86, 79, 72, 65],
      sentences: [
        "Wiem tylko, że to Jan ma dzisiaj pomagać.",
        "Kot zawsze chował się pod kanapą, gdy psy były w pokoju.",
      ],
      fluencyLetter: "F",
      abstractionPractice: { text: "Banan – pomarańcza", answer: "Przykład: owoce" },
      abstractionTasks: [
        { key: "train_bicycle", text: "Pociąg – rower", correctLabel: "Prawidłowo (środki transportu/są z metalu)" },
        { key: "watch_ruler", text: "Zegarek – linijka", correctLabel: "Prawidłowo (przyrządy pomiarowe/mają liczby)" },
      ],
      orientation: ["Data", "Miesiąc", "Rok", "Dzień", "Miejsce", "Miasto"],
    },
  },
  ru: {
    A: {
      displayLabel: "Русская версия 7.1 (2010)",
      exportVersion: "7.1 (2010)",
      figure: { label: "Скопируйте куб", button: "Куб соответствует всем критериям" },
      clock: { label: "Нарисуйте часы – десять минут двенадцатого", prompt: "Нарисуйте часы со всеми цифрами и установите время десять минут двенадцатого." },
      naming: ["Лев", "Носорог", "Верблюд"],
      memoryWords: ["Лицо", "Бархат", "Церковь", "Фиалка", "Красный"],
      digitForward: "2 – 1 – 8 – 5 – 4",
      digitBackward: "7 – 4 – 2",
      vigilanceTarget: "А",
      vigilanceSequence: "ФБАВМНААЖКЛБАФАКДЕАААЖАМОФААБ",
      serialStart: 100,
      serialExpected: [93, 86, 79, 72, 65],
      sentences: [
        "Я знаю только одно, что Иван – это тот, кто может сегодня помочь.",
        "Кошка всегда пряталась под диваном, когда собаки были в комнате.",
      ],
      fluencyLetter: "Л",
      abstractionPractice: { text: "Банан – яблоко", answer: "Пример: фрукты" },
      abstractionTasks: [
        { key: "train_bicycle", text: "Поезд – велосипед", correctLabel: "Верно (транспортные средства/сделаны из металла)" },
        { key: "watch_ruler", text: "Часы – линейка", correctLabel: "Верно (измерительные приборы/имеют цифры)" },
      ],
      orientation: ["Дата", "Месяц", "Год", "День недели", "Место", "Город"],
    },
  },
  tr: {
    A: {
      displayLabel: "Türkçe versiyon 2009",
      exportVersion: "2009",
      figure: { label: "Küp kopyalama", button: "Küp tüm kriterleri karşılıyor" },
      clock: { label: "Saat çizme – on biri on geçe", prompt: "Tüm rakamları içeren ve on biri on geçeyi gösteren bir saat çizin." },
      naming: ["Aslan", "Gergedan", "Deve"],
      memoryWords: ["Burun", "Kadife", "Cami", "Papatya", "Mor"],
      digitForward: "2 – 1 – 8 – 5 – 4",
      digitBackward: "7 – 4 – 2",
      vigilanceTarget: "A",
      vigilanceSequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
      serialStart: 100,
      serialExpected: [93, 86, 79, 72, 65],
      sentences: [
        "Tek bildiğim bugün yardıma ihtiyacı olan kişinin Ahmet olduğudur.",
        "Köpekler odadayken kedi hep kanapenin altında saklanırdı.",
      ],
      fluencyLetter: "K",
      abstractionPractice: { text: "Muz – portakal", answer: "Örnek: meyve" },
      abstractionTasks: [
        { key: "train_bicycle", text: "Tren – bisiklet", correctLabel: "Doğru (taşıttır/metalden yapılmıştır)" },
        { key: "watch_ruler", text: "Saat – cetvel", correctLabel: "Doğru (ölçüm aracıdır/rakamları vardır)" },
      ],
      orientation: ["Gün", "Ay", "Yıl", "Gün adı", "Yer", "Şehir"],
    },
  },
};

const MOCA_MEMORY_WORDS = MOCA_VARIANTS.de.A.memoryWords;

function normalizeMocaGermanVersion(version) {
  return MOCA_GERMAN_VERSION_OPTIONS.includes(version) ? version : "A";
}

function getMocaVariant(testLanguage, version) {
  const language = normalizeTestLanguage(testLanguage);
  const availableVariants = MOCA_VARIANTS[language];
  const versionKey = language === "de" ? normalizeMocaGermanVersion(version) : "A";
  const available = !!availableVariants?.[versionKey];
  const materials = available ? availableVariants[versionKey] : MOCA_VARIANTS.de.A;
  return {
    ...materials,
    displayLabel: available ? materials.displayLabel : `Externe MoCA-Version (${getTestLanguageLabel(language)})`,
    exportVersion: available ? materials.exportVersion : "extern",
    language,
    versionKey,
    available,
  };
}

const MOCA_SECTIONS = [
  {
    key: "visuospatial_executive",
    title: "Visuell-räumlich / Exekutiv",
    max: 5,
    items: [
      {
        key: "trail",
        label: "Alternierender Pfad",
        max: 1,
        prompt: "Aufgabe auf dem gedruckten Testbogen durchführen und das Ergebnis hier bewerten.",
        hint: "1 Punkt nur für die vollständig korrekte Folge ohne gekreuzte Linien. Ein unmittelbar selbst korrigierter Fehler ist zulässig.",
        materials: ["Pfad vollständig korrekt"],
      },
      {
        key: "cube",
        label: "Würfel abzeichnen",
        max: 1,
        prompt: "Patient:in zeichnet den Würfel auf dem Testbogen; hier nur die Bewertung erfassen.",
        hint: "Dreidimensional, alle Linien vorhanden, keine zusätzlichen Linien und annähernd parallele Seiten.",
        materials: ["Würfel erfüllt alle Kriterien"],
      },
      {
        key: "clock",
        label: "Uhr zeichnen – zehn nach elf",
        max: 3,
        prompt: "Eine Uhr mit allen Zahlen und der Zeit zehn nach elf zeichnen lassen.",
        hint: "Je 1 Punkt für Kontur, Zahlen und Zeiger. Die Kontur muss als geschlossener Kreis erkennbar sein.",
        materials: ["Kontur korrekt", "Zahlen korrekt", "Zeiger korrekt"],
      },
    ],
  },
  {
    key: "naming",
    title: "Benennen",
    max: 3,
    items: [
      {
        key: "naming",
        label: "Tiere benennen",
        max: 3,
        prompt: "Die drei Abbildungen auf dem gedruckten Testbogen zeigen und jede korrekte Benennung markieren.",
        materials: ["Löwe", "Nashorn", "Kamel"],
        neutralPrefix: "Bild",
      },
    ],
  },
  {
    key: "attention",
    title: "Aufmerksamkeit",
    max: 6,
    items: [
      {
        key: "digit_span",
        label: "Zahlenspanne",
        max: 2,
        prompt: "Ziffern mit einer Ziffer pro Sekunde vorlesen und zunächst in gleicher, anschließend in umgekehrter Reihenfolge wiederholen lassen.",
        scoringMode: "digit-span",
      },
      {
        key: "vigilance",
        label: "Vigilanz – Zielbuchstabe A",
        max: 1,
        prompt: "Die Buchstabenfolge mit einem Buchstaben pro Sekunde vorlesen; bei jedem A klopfen lassen.",
        hint: "1 Punkt bei höchstens einem Fehler. Als Fehler zählen ausgelassene A und Reaktionen auf andere Buchstaben.",
        sequence: "FBACMNAAJKLBAFAKDEAAAJAMOFAAB",
        scoringMode: "errors",
      },
      {
        key: "serial_subtraction",
        label: "Serielles Rechnen",
        max: 3,
        prompt: "Von 100 fünfmal nacheinander 7 im Kopf abziehen lassen.",
        hint: "Jeden Rechenschritt unabhängig bewerten: Nach einem Fehler kann die nächste korrekte Subtraktion wieder zählen. 4–5 korrekte Subtraktionen = 3 Punkte, 2–3 = 2 Punkte, 1 = 1 Punkt, keine = 0 Punkte.",
        materials: ["1. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: 93", "2. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: 86", "3. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: 79", "4. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: 72", "5. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: 65"],
        scoringMode: "serial-seven",
      },
    ],
  },
  {
    key: "language",
    title: "Sprache",
    max: 3,
    items: [
      {
        key: "sentence_repetition",
        label: "Sätze nachsprechen",
        max: 2,
        prompt: "Jeden Satz genau einmal vorlesen und vollständig nachsprechen lassen.",
        hint: "Je wortgetreu wiederholtem Satz 1 Punkt.",
        materials: [
          "Ich weiß lediglich, dass Hans heute an der Reihe ist zu helfen.",
          "Die Katze versteckte sich immer unter der Couch, wenn die Hunde im Zimmer waren.",
        ],
        neutralPrefix: "Satz",
      },
      {
        key: "letter_fluency",
        label: "Phonematische Wortflüssigkeit",
        max: 1,
        prompt: "Eine Minute lang möglichst viele Wörter mit F nennen lassen.",
        hint: "Mindestens 11 zulässige Wörter ergeben 1 Punkt. Eigennamen sowie Varianten desselben Wortstamms nicht zählen.",
        scoringMode: "fluency",
      },
    ],
  },
  {
    key: "abstraction",
    title: "Abstraktion",
    max: 2,
    items: [
      {
        key: "abstraction",
        label: "Gemeinsamkeiten",
        max: 2,
        prompt: "Nach der Gemeinsamkeit der beiden Begriffe fragen.",
        scoringMode: "abstraction",
        tasks: [
          { key: "train_bicycle", text: "Eisenbahn – Fahrrad", correctLabel: "Korrekt (sind Fahrzeuge/sind aus Metall)" },
          { key: "watch_ruler", text: "Uhr – Lineal", correctLabel: "Korrekt (sind Messinstrumente/haben Zahlen)" },
        ],
      },
    ],
  },
  {
    key: "delayed_recall",
    title: "Verzögerter Abruf",
    max: 5,
    items: [
      {
        key: "delayed_recall",
        label: "Wörter frei abrufen",
        max: 5,
        prompt: "Die fünf zuvor eingeprägten Wörter ohne Hinweis frei abrufen lassen.",
        hint: "Nur der freie Abruf zählt. Kategoriehinweise und Mehrfachauswahl anschließend nur bei nicht frei erinnerten Wörtern dokumentieren.",
        materials: MOCA_MEMORY_WORDS,
        neutralPrefix: "Wort",
        scoringMode: "delayed-recall",
      },
    ],
  },
  {
    key: "orientation",
    title: "Orientierung",
    max: 6,
    items: [
      {
        key: "orientation",
        label: "Zeit und Ort",
        max: 6,
        prompt: "Nach Datum, Monat, Jahr, Wochentag, Ort und Stadt fragen.",
        hint: "Je korrekter Antwort 1 Punkt. Beim Datum ist kein Toleranzbereich vorgesehen.",
        materials: ["Datum", "Monat", "Jahr", "Wochentag", "Ort", "Stadt"],
        neutralPrefix: "Orientierungsfrage",
      },
    ],
  },
];

function getMocaVariantItem(item, variant) {
  const materialsLocalized = variant.available;
  if (item.key === "cube") {
    return {
      ...item,
      label: materialsLocalized ? variant.figure.label : "Figur abzeichnen",
      materials: [materialsLocalized ? variant.figure.button : "Figur erfüllt alle Kriterien"],
      materialsLocalized,
    };
  }
  if (item.key === "clock") {
    return {
      ...item,
      label: materialsLocalized ? variant.clock.label : "Uhr zeichnen",
      prompt: materialsLocalized ? variant.clock.prompt : "Uhrzeit gemäß der offiziellen gedruckten Sprachversion zeichnen lassen.",
      materialsLocalized,
    };
  }
  if (item.key === "naming") {
    return { ...item, materials: variant.naming, materialsLocalized };
  }
  if (item.key === "digit_span") {
    return {
      ...item,
      digitForward: variant.digitForward,
      digitBackward: variant.digitBackward,
      materialsLocalized,
    };
  }
  if (item.key === "vigilance") {
    return {
      ...item,
      label: materialsLocalized ? `Vigilanz – Zielbuchstabe ${variant.vigilanceTarget}` : "Vigilanz – Zielbuchstabe laut Druckversion",
      prompt: materialsLocalized
        ? `Die Buchstabenfolge mit einem Buchstaben pro Sekunde vorlesen; bei jedem ${variant.vigilanceTarget} klopfen lassen.`
        : "Buchstabenfolge und Zielbuchstabe aus der offiziellen gedruckten Sprachversion verwenden.",
      sequence: materialsLocalized ? variant.vigilanceSequence : null,
      materialsLocalized,
    };
  }
  if (item.key === "serial_subtraction") {
    return {
      ...item,
      prompt: `Von ${variant.serialStart} fünfmal nacheinander 7 im Kopf abziehen lassen.`,
      materials: variant.serialExpected.map((expected, index) => `${index + 1}. Subtraktion korrekt · Sollwert bei fehlerfreier Reihe: ${expected}`),
      materialsLocalized,
    };
  }
  if (item.key === "sentence_repetition") {
    return { ...item, materials: variant.sentences, materialsLocalized };
  }
  if (item.key === "letter_fluency") {
    return {
      ...item,
      prompt: materialsLocalized
        ? `Eine Minute lang möglichst viele Wörter mit ${variant.fluencyLetter} nennen lassen.`
        : "Eine Minute lang möglichst viele Wörter mit dem Buchstaben der offiziellen gedruckten Sprachversion nennen lassen.",
      fluencyLetter: variant.fluencyLetter,
      materialsLocalized,
    };
  }
  if (item.key === "abstraction") {
    return {
      ...item,
      practice: variant.abstractionPractice,
      tasks: variant.abstractionTasks,
      materialsLocalized,
    };
  }
  if (item.key === "delayed_recall") {
    return { ...item, materials: variant.memoryWords, materialsLocalized };
  }
  if (item.key === "orientation") {
    return { ...item, materials: variant.orientation, materialsLocalized };
  }
  return { ...item, materialsLocalized };
}

function countMocaMarks(marks) {
  if (!marks || typeof marks !== "object") return 0;
  return Object.values(marks).filter(Boolean).length;
}

function getMocaItemScore(moca, item) {
  const score = Number(moca?.scores?.[item.key] || 0);
  return Math.max(0, Math.min(item.max, score));
}

function getMocaSectionScore(moca, section) {
  return section.items.reduce((sum, item) => sum + getMocaItemScore(moca, item), 0);
}

function getMocaRawTotal(moca) {
  return MOCA_SECTIONS.reduce((sum, section) => sum + getMocaSectionScore(moca, section), 0);
}

function getMocaTotal(moca) {
  return getMocaRawTotal(moca);
}

function scoreMocaSerialSeven(correctCount) {
  if (correctCount >= 4) return 3;
  if (correctCount >= 2) return 2;
  if (correctCount >= 1) return 1;
  return 0;
}

function getMocaMaterialEntries(item, testLanguage) {
  const materials = Array.isArray(item.materials) ? item.materials : [];
  if (item.materialsLocalized || normalizeTestLanguage(testLanguage) === "de" || !item.neutralPrefix) {
    return materials.map((material) => ({ key: material, label: material }));
  }
  return materials.map((material, index) => ({ key: material, label: `${item.neutralPrefix} ${index + 1}` }));
}

function MocaLearningTrials({ raw = {}, testLanguage, variant, onRawChange }) {
  const [activeRun, setActiveRun] = useState(0);
  const touchStartX = useRef(null);
  const usePrintedLanguageVersion = !variant.available;
  const storedRuns = Array.isArray(raw.runs) ? raw.runs : [];
  const runs = Array.from({ length: 2 }, (_, index) => ({
    ...(storedRuns[index] || {}),
    marks: storedRuns[index]?.marks || {},
  }));
  const entries = variant.memoryWords.map((word, index) => ({
    key: word,
    label: usePrintedLanguageVersion ? `Wort ${index + 1}` : word,
  }));
  const selectRun = (index) => setActiveRun(Math.max(0, Math.min(1, index)));
  const toggleWord = (word) => {
    const nextRuns = runs.map((run, index) => {
      if (index !== activeRun) return run;
      const marks = { ...run.marks, [word]: !run.marks[word] };
      return { ...run, marks: Object.fromEntries(Object.entries(marks).filter(([, checked]) => checked)) };
    });
    onRawChange({ ...raw, runs: nextRuns });
  };
  const activeMarks = runs[activeRun].marks;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Wörter einprägen</div>
          <p className="mt-1 text-sm text-zinc-600">Fünf Wörter vorlesen und nachsprechen lassen; anschließend einen zweiten Durchgang durchführen.</p>
          <p className="mt-1 text-xs text-zinc-500">Beide Durchgänge werden dokumentiert, aber nicht bepunktet. Nach dem zweiten Durchgang auf den späteren Abruf hinweisen.</p>
        </div>
        <div className="shrink-0 rounded-lg border bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-600">Ohne Wertung</div>
      </div>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Einprägedurchgänge">
        {runs.map((run, index) => {
          const selected = activeRun === index;
          return (
            <Button
              key={index}
              size="bare"
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectRun(index)}
              className={cls(
                "rounded-xl border px-2 py-2 text-sm",
                selected ? "border-indigo-700 bg-indigo-700 text-white" : "border-zinc-300 bg-white text-zinc-700"
              )}
            >
              <span className="block font-semibold">Durchgang {index + 1}</span>
              <span className={cls("block text-xs", selected ? "text-indigo-100" : "text-zinc-500")}>{countMocaMarks(run.marks)}/5 nachgesprochen</span>
            </Button>
          );
        })}
      </div>
      <div
        className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 touch-pan-y"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
          const delta = endX - touchStartX.current;
          touchStartX.current = null;
          if (Math.abs(delta) >= 45) selectRun(activeRun + (delta < 0 ? 1 : -1));
        }}
      >
        {usePrintedLanguageVersion && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Wörter aus der offiziellen gedruckten MoCA-Version in {getTestLanguageLabel(testLanguage)} verwenden.
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {entries.map(({ key, label }) => {
            const checked = !!activeMarks[key];
            return (
              <Button
                key={key}
                size="bare"
                type="button"
                aria-pressed={checked}
                onClick={() => toggleWord(key)}
                className={cls(
                  "flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 text-left",
                  checked ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white"
                )}
              >
                <span>{label}</span><span>{checked ? "✔️" : "✖️"}</span>
              </Button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" disabled={activeRun === 0} onClick={() => selectRun(activeRun - 1)}>← Vorheriger Durchgang</Button>
        <div className="text-xs text-zinc-500">Karte nach links oder rechts wischen</div>
        <Button type="button" variant="primary" size="sm" disabled={activeRun === 1} onClick={() => selectRun(activeRun + 1)}>Nächster Durchgang →</Button>
      </div>
    </Card>
  );
}

function MocaDelayedRecallCues({ item, raw, materialMarks, testLanguage, onRawChange }) {
  const entries = getMocaMaterialEntries(item, testLanguage).filter(({ key }) => !materialMarks[key]);
  if (entries.length === 0) return null;
  const cues = raw.cues && typeof raw.cues === "object" ? raw.cues : {};
  const setCue = (word, outcome) => {
    const nextCues = { ...cues, [word]: cues[word] === outcome ? null : outcome };
    onRawChange({ ...raw, cues: Object.fromEntries(Object.entries(nextCues).filter(([, value]) => value)) });
  };
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <div className="text-sm font-semibold text-amber-950">Nicht frei erinnerte Wörter – optionale Hinweise ohne Punkte</div>
      {entries.map(({ key, label }) => (
        <div key={key} className="rounded-xl border border-amber-200 bg-white p-3">
          <div className="mb-2 text-sm font-medium">{label}</div>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label={`Hinweisergebnis ${label}`}>
            {[
              { value: "category", label: "Nach Kategoriehinweis erinnert", positive: true },
              { value: "choice", label: "Nach Mehrfachauswahl erkannt", positive: true },
              { value: "missed", label: "Auch mit Hinweisen nicht erinnert", positive: false },
            ].map((option) => {
              const selected = cues[key] === option.value;
              return (
                <Button
                  key={option.value}
                  size="bare"
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCue(key, option.value)}
                  className={cls(
                    "min-h-11 rounded-xl border px-3 py-2 text-left text-sm",
                    selected
                      ? option.positive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                      : "border-zinc-300 bg-white"
                  )}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function MocaDigitSpan({ item, value, raw, onScoreChange, onRawChange }) {
  const legacyForwardKey = "Vorwärts korrekt: 2 – 1 – 8 – 5 – 4";
  const legacyBackwardKey = "Rückwärts korrekt: 2 – 4 – 7";
  const hasLegacyMarks = raw.marks && typeof raw.marks === "object";
  const vals = raw.vals && typeof raw.vals === "object"
    ? raw.vals
    : {
        v1: hasLegacyMarks ? (raw.marks[legacyForwardKey] ? 1 : null) : Number(value) >= 1 ? 1 : null,
        v2: hasLegacyMarks ? (raw.marks[legacyBackwardKey] ? 1 : null) : Number(value) >= 2 ? 1 : null,
      };
  const update = (nextVals) => {
    onRawChange({ ...raw, vals: nextVals });
    onScoreChange(Number(nextVals.v1 === 1) + Number(nextVals.v2 === 1));
  };

  return (
    <AttemptsRow
      title="MoCA – Zahlenspanne"
      seq1={item.materialsLocalized ? `Vorwärts: ${item.digitForward}` : "Vorwärts: gemäß offizieller Druckversion"}
      seq2={item.materialsLocalized ? `Rückwärts: ${item.digitBackward}` : "Rückwärts: gemäß offizieller Druckversion"}
      val={vals}
      onChange={update}
      stacked
    />
  );
}

function MocaAbstraction({ item, value, raw, onScoreChange, onRawChange }) {
  const usePrintedLanguageVersion = !item.materialsLocalized;
  const tasks = Array.isArray(item.tasks) ? item.tasks : [];
  const practice = item.practice || MOCA_VARIANTS.de.A.abstractionPractice;
  const marks = raw.marks || Object.fromEntries(tasks.slice(0, Number(value) || 0).map((task) => [task.key, 1]));
  const toggleTask = (taskKey) => {
    const nextMarks = { ...marks, [taskKey]: !marks[taskKey] };
    const cleanedMarks = Object.fromEntries(Object.entries(nextMarks).filter(([, checked]) => checked));
    onRawChange({ ...raw, marks: cleanedMarks });
    onScoreChange(countMocaMarks(cleanedMarks));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">Probe</span>
          <span className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-amber-900">Ohne Wertung</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-lg font-semibold text-amber-950">{usePrintedLanguageVersion ? "Begriffspaar der offiziellen Probe" : practice.text}</span>
          <div className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-950">
            {usePrintedLanguageVersion ? "Beispielantwort gemäß gedruckter Sprachversion" : practice.answer}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map((task, index) => {
          const selected = !!marks[task.key];
          return (
            <div key={task.key} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-lg font-semibold text-zinc-900">{usePrintedLanguageVersion ? `Begriffspaar ${index + 1}` : task.text}</span>
              <Button
                size="bare"
                type="button"
                aria-pressed={selected}
                onClick={() => toggleTask(task.key)}
                className={cls(
                  "min-h-11 rounded-xl border px-3 py-2 text-left text-sm",
                  selected ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white"
                )}
              >
                {usePrintedLanguageVersion ? "Korrekt" : task.correctLabel}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MocaTaskCard({ item, value, raw = {}, testLanguage, onScoreChange, onRawChange }) {
  const entries = getMocaMaterialEntries(item, testLanguage);
  const isErrors = item.scoringMode === "errors";
  const isSerial = item.scoringMode === "serial-seven";
  const isFluency = item.scoringMode === "fluency";
  const isDelayedRecall = item.scoringMode === "delayed-recall";
  const isDigitSpan = item.scoringMode === "digit-span";
  const isAbstraction = item.scoringMode === "abstraction";
  const inferredCount = isSerial
    ? ({ 0: 0, 1: 1, 2: 2, 3: 4 }[Number(value) || 0] || 0)
    : Number(value) || 0;
  const materialMarks = raw.marks || Object.fromEntries(entries.slice(0, inferredCount).map(({ key }) => [key, 1]));
  const usePrintedLanguageVersion = !item.materialsLocalized;

  const toggleMaterial = (material) => {
    const nextMarks = { ...materialMarks, [material]: !materialMarks[material] };
    const cleanedMarks = Object.fromEntries(Object.entries(nextMarks).filter(([, checked]) => checked));
    const nextRaw = { ...raw, marks: cleanedMarks };
    if (isDelayedRecall && cleanedMarks[material]) {
      const nextCues = { ...(raw.cues || {}) };
      delete nextCues[material];
      nextRaw.cues = nextCues;
    }
    onRawChange(nextRaw);
    const correctCount = countMocaMarks(cleanedMarks);
    onScoreChange(isSerial ? scoreMocaSerialSeven(correctCount) : correctCount);
  };

  const updateErrors = (nextValue) => {
    const normalized = nextValue === "" ? "" : Math.max(0, Math.floor(Number(nextValue) || 0));
    onRawChange({ ...raw, errors: normalized });
    onScoreChange(normalized !== "" && normalized <= 1 ? 1 : 0);
  };
  const updateFluency = (nextValue) => {
    const normalized = nextValue === "" ? "" : Math.max(0, Math.floor(Number(nextValue) || 0));
    onRawChange({ ...raw, count: normalized });
    onScoreChange(normalized !== "" && normalized >= 11 ? 1 : 0);
  };

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold">{item.label}</div>
          {item.prompt && <p className="mt-1 text-sm text-zinc-600">{usePrintedLanguageVersion && item.key === "letter_fluency" ? "Aufgabe gemäß der offiziellen gedruckten Sprachversion durchführen." : item.prompt}</p>}
          {item.hint && <p className="mt-1 text-xs text-zinc-500">{item.hint}</p>}
        </div>
        <div className="shrink-0 text-sm text-zinc-600">Punkte: <span className="font-semibold tabular-nums text-zinc-900">{value ?? 0} / {item.max}</span></div>
      </div>

      {isDigitSpan && (
        <MocaDigitSpan
          item={item}
          value={value}
          raw={raw}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}

      {isAbstraction && (
        <MocaAbstraction
          item={item}
          value={value}
          raw={raw}
          onScoreChange={onScoreChange}
          onRawChange={onRawChange}
        />
      )}

      {entries.length > 0 && !isErrors && !isFluency && !isDigitSpan && !isAbstraction && (
        <div className="grid gap-2 md:grid-cols-2">
          {entries.map(({ key, label }) => {
            const checked = !!materialMarks[key];
            return (
              <Button
                key={key}
                size="bare"
                type="button"
                aria-pressed={checked}
                onClick={() => toggleMaterial(key)}
                className={cls(
                  "flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 text-left",
                  checked ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-zinc-300 bg-white"
                )}
              >
                <span>{label}</span><span>{checked ? "✔️" : "✖️"}</span>
              </Button>
            );
          })}
        </div>
      )}

      {isErrors && (
        <div className="space-y-3">
          {item.sequence && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-4" aria-label="Buchstabenfolge für die Vigilanzaufgabe">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-indigo-700">Buchstabenfolge</div>
              <div className="break-words font-mono text-xl font-semibold leading-relaxed tracking-[0.22em] text-indigo-950 sm:text-2xl">
                {item.sequence.split("").join(" ")}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => updateErrors((Number(raw.errors) || 0) + 1)}>+1 Fehler</Button>
            <input
              className="h-11 w-28 rounded-xl border px-3 text-lg"
              inputMode="numeric"
              aria-label="Anzahl Fehler"
              value={raw.errors ?? ""}
              onChange={(event) => updateErrors(event.target.value)}
              placeholder="Fehler"
            />
            <Button variant="secondary" disabled={(Number(raw.errors) || 0) <= 0} onClick={() => updateErrors((Number(raw.errors) || 0) - 1)}>−1 Fehler</Button>
          </div>
        </div>
      )}

      {isFluency && (
        <div className="grid gap-3 md:grid-cols-[260px_1fr]">
          <Countdown60 />
          <div className="space-y-2">
            <label className="block text-sm font-medium">Korrekte Wörter</label>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => updateFluency((Number(raw.count) || 0) + 1)}>+1 Wort</Button>
              <input
                className="h-11 w-28 rounded-xl border px-3 text-lg"
                inputMode="numeric"
                value={raw.count ?? ""}
                onChange={(event) => updateFluency(event.target.value)}
                placeholder="0"
                aria-label="Korrekte Wörter"
              />
              <Button variant="secondary" disabled={(Number(raw.count) || 0) <= 0} onClick={() => updateFluency((Number(raw.count) || 0) - 1)}>−1 Wort</Button>
            </div>
            <textarea
              className="h-24 w-full rounded-xl border p-2 text-sm"
              value={raw.transcript || ""}
              onChange={(event) => onRawChange({ ...raw, transcript: event.target.value })}
              aria-label="Wortflüssigkeitsnotiz"
              placeholder="Nennungen / Notiz"
            />
          </div>
        </div>
      )}

      {isDelayedRecall && (
        <MocaDelayedRecallCues
          item={item}
          raw={raw}
          materialMarks={materialMarks}
          testLanguage={testLanguage}
          onRawChange={onRawChange}
        />
      )}
    </Card>
  );
}

function MocaVersionSelection({ onSelect, onBack }) {
  const options = [
    { key: "A", label: "A" },
    { key: "B", label: "B" },
    { key: "C", label: "C" },
  ];
  return (
    <section className="py-6">
      <Header title="MoCA" subtitle="Testsprache: Deutsch" />
      <Card className="space-y-4">
        <div>
          <div className="text-xl font-semibold">Deutsche MoCA-Version auswählen</div>
          <p className="mt-1 text-sm text-zinc-600">Welche Parallelversion soll für diese Testung verwendet werden?</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {options.map((option) => (
            <Button
              key={option.key}
              size="bare"
              type="button"
              onClick={() => onSelect(option.key)}
              className="min-h-28 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-left text-blue-950 shadow-sm hover:bg-blue-100"
            >
              <span className="block text-xs font-semibold uppercase tracking-wide text-blue-600">MoCA</span>
              <span className="mt-1 block text-xl font-semibold">{option.label}</span>
              <span className="mt-2 block text-sm text-blue-700">Version verwenden →</span>
            </Button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={onBack}>Zurück zum Hauptmenü</Button>
        </div>
      </Card>
    </section>
  );
}

function MocaWire({ sessionData, testLanguage, onPersist, onReset, onAbort, onDone }) {
  const moca = sessionData?.moca || {};
  const scores = moca.scores || {};
  const raw = moca.raw || {};
  const requestedLanguage = normalizeTestLanguage(testLanguage);
  const storedLanguage = moca.language ? normalizeTestLanguage(moca.language) : null;
  const hasMocaData = Object.keys(scores).length > 0 || Object.keys(raw).length > 0 || !!moca.notes || !!sessionData?.moca_aborted;
  const languageChangeRequiresReset = !!storedLanguage && hasMocaData && storedLanguage !== requestedLanguage;
  const normalizedLanguage = languageChangeRequiresReset ? storedLanguage : requestedLanguage;
  const storedGermanVersion = MOCA_GERMAN_VERSION_OPTIONS.includes(moca.version) ? moca.version : null;
  const germanVersion = storedGermanVersion || (hasMocaData ? "A" : null);

  const resetForRequestedLanguage = () => {
    if (!onReset) return;
    const confirmed = window.confirm(
      `Die vorhandene MoCA-Testung in ${getTestLanguageLabel(normalizedLanguage)} wird vollständig gelöscht. MoCA anschließend in ${getTestLanguageLabel(requestedLanguage)} neu beginnen?`
    );
    if (confirmed) onReset(requestedLanguage);
  };

  if (normalizedLanguage === "de" && !germanVersion) {
    return (
      <MocaVersionSelection
        onSelect={(version) => onPersist({ version, language: "de" })}
        onBack={onDone}
      />
    );
  }

  const variant = getMocaVariant(normalizedLanguage, germanVersion || "A");
  const total = getMocaTotal(moca);
  const persistWithMetadata = (patch) => onPersist({
    version: variant.versionKey,
    language: normalizedLanguage,
    ...patch,
  });
  const persistScore = (key, max, value) => {
    const clamped = Math.max(0, Math.min(max, Number(value) || 0));
    persistWithMetadata({ scores: { ...scores, [key]: clamped } });
  };
  const persistRaw = (key, value) => persistWithMetadata({ raw: { ...raw, [key]: value } });

  return (
    <section className="py-6">
      <Header
        title="MoCA"
        subtitle={`${variant.displayLabel} · Testsprache: ${getTestLanguageLabel(normalizedLanguage)} · Durchführung mit gedrucktem Testmaterial`}
        right={<div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-2 text-3xl font-semibold tabular-nums shadow-sm">{total} / 30</div>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <AbortButton onAbort={onAbort} />
        {normalizedLanguage === "de" && storedGermanVersion && !hasMocaData && (
          <Button type="button" variant="secondary" size="sm" onClick={() => onPersist({ version: null })}>Version ändern</Button>
        )}
      </div>
      <Card className="mb-4">
        <div className="text-sm text-zinc-700">Gedrucktes Testmaterial verwenden. Abbildungen und Zeichnungsvorlagen werden nicht in der App angezeigt; Antworten, Kriterien und Punkte werden hier erfasst.</div>
        {languageChangeRequiresReset && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <div className="font-semibold">Die Testsprache der vorhandenen MoCA-Testung bleibt {getTestLanguageLabel(normalizedLanguage)}.</div>
            <div className="mt-1">
              In den Basisdaten ist jetzt {getTestLanguageLabel(requestedLanguage)} ausgewählt. Für den Sprachwechsel muss die vorhandene MoCA-Testung ausdrücklich zurückgesetzt werden.
            </div>
            <Button type="button" variant="warning" size="sm" className="mt-3" onClick={resetForRequestedLanguage}>
              MoCA zurücksetzen und Sprache wechseln
            </Button>
          </div>
        )}
        {!variant.available && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Für {getTestLanguageLabel(normalizedLanguage)} wurde keine MoCA-Fassung bereitgestellt. Bitte die entsprechende offizielle Druckversion verwenden; sprachabhängige Inhalte werden hier neutral dargestellt.
          </div>
        )}
      </Card>
      <div className="space-y-4">
        {MOCA_SECTIONS.map((section, sectionIndex) => (
          <React.Fragment key={section.key}>
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle>{section.title}</SectionTitle>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1 text-lg font-semibold tabular-nums text-indigo-950">
                  {getMocaSectionScore(moca, section)} / {section.max}
                </div>
              </div>
              <div className="grid gap-3">
                {section.items.map((baseItem) => {
                  const item = getMocaVariantItem(baseItem, variant);
                  return (
                    <MocaTaskCard
                      key={item.key}
                      item={item}
                      value={getMocaItemScore(moca, item)}
                      raw={raw[item.key] || {}}
                      testLanguage={normalizedLanguage}
                      onScoreChange={(value) => persistScore(item.key, item.max, value)}
                      onRawChange={(value) => persistRaw(item.key, value)}
                    />
                  );
                })}
              </div>
            </section>
            {sectionIndex === 1 && (
              <section className="space-y-2">
                <SectionTitle>Gedächtnis – Einprägen</SectionTitle>
                <MocaLearningTrials
                  raw={raw.learning || {}}
                  testLanguage={normalizedLanguage}
                  variant={variant}
                  onRawChange={(value) => persistRaw("learning", value)}
                />
              </section>
            )}
          </React.Fragment>
        ))}
        <Card>
          <div className="flex items-center justify-between gap-3">
            <SectionTitle>Auswertung</SectionTitle>
            <div className="text-lg font-semibold tabular-nums">{total} / 30</div>
          </div>
        </Card>
        <Card className="space-y-2">
          <SectionTitle>Allgemeine Notizen</SectionTitle>
          <textarea
            className="h-28 w-full rounded-xl border p-2"
            value={moca.notes || ""}
            onChange={(event) => persistWithMetadata({ notes: event.target.value })}
            aria-label="MoCA Notiz"
            placeholder="Allgemeine Notiz"
          />
        </Card>
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onDone}>Fertig</Button>
        </div>
      </div>
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

  const initialFails = useMemo(
    () => sessionData?.stroop_notes?.interferenz_fails || {},
    [sessionData?.stroop_notes?.interferenz_fails]
  );
  const generalNote = sessionData?.stroop_notes?.general
    ?? sessionData?.stroop_notes?.woerter
    ?? sessionData?.stroop_notes?.farbstriche
    ?? sessionData?.stroop_notes?.interferenz
    ?? "";
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

  const interferenzTimerRef = useRef(null);

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
          </div>
        ))}
      </div>
      <div className="mt-3">
        <div className="p-3 rounded-2xl border bg-white space-y-3">
          <div className="font-medium mb-1">Interferenz</div>
          <div className="space-y-3">
            <div className="md:w-80">
              <Stopwatch
                ref={interferenzTimerRef}
                persisted={sessionData?.stroop?.interferenz ?? null}
                onPersist={(ms) => onPersistTime && onPersistTime("interferenz", ms)}
              />
            </div>
            <div className="rounded-xl border bg-zinc-50 p-2 text-xs text-zinc-700">
              <div className="grid grid-cols-3 gap-x-8 gap-y-2">
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
                      <div key={key} className="grid grid-cols-[4rem_44px] items-center gap-2 px-1 py-1">
                        <span className="font-mono text-right">{w}</span>
                        <Button size="bare"
                          type="button"
                          className={`shrink-0 px-2 py-0.5 rounded-md border text-[11px] ${clsBtn}`}
                          onClick={() => toggleFail(key)}
                          title="Fehl-Nennung markieren/korrigieren"
                        >
                          {label}
                        </Button>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="bare"
                type="button"
                onClick={() => interferenzTimerRef.current?.stop?.()}
                className="px-3 py-2 rounded-xl border bg-white"
              >
                Timer stoppen
              </Button>
            </div>
          </div>
        </div>
      </div>
      <textarea
        className="mt-3 h-20 w-full rounded-xl border p-2"
        value={generalNote}
        onChange={(e) => onPersistNote && onPersistNote("general", e.target.value)}
        aria-label="Notiz"
        placeholder="Notiz"
      />
    </section>
  );
}

function GroovedPegboardWire({ sessionData, onPersistPanel, onAbort }) {
  const gp = sessionData?.gp || {};
  const [domHand, setDomHand] = useState(gp.dom_hand || "rechts"); // "links"|"rechts"
  useEffect(() => {
    const frameId = requestAnimationFrame(() => setDomHand(gp.dom_hand || "rechts"));
    return () => cancelAnimationFrame(frameId);
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
            <Button size="bare"
              key={h}
              onClick={() => {
                setDomHand(h);
                onPersistPanel && onPersistPanel("meta", { dom_hand: h });
              }}
              className={cls("px-3 py-1.5 rounded-xl border text-sm", domHand === h ? "bg-emerald-50 border-emerald-200" : "bg-white")}
            >
              {h}
            </Button>
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
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={gp[panel.key + "_note"] || ""}
                onChange={(e) => persistHand(panel.key, { note: e.target.value })}
                aria-label="Notiz"
                placeholder="Notiz"
              />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

function QuestionnaireMenu({ statusMap, onOpen }) {
  const items = Object.entries(QUESTIONNAIRE_DEFINITIONS).map(([key, definition]) => ({
    key,
    label: definition.title,
  }));
  return (
    <section className="py-6">
      <Header title="Fragebögen" subtitle="Fragebogen auswählen" />
      <Card className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Button
            key={item.key}
            size="bare"
            type="button"
            onClick={() => onOpen?.(item.key)}
            className="flex h-24 items-center justify-between rounded-2xl border bg-white px-4 text-left shadow-sm hover:bg-zinc-50"
          >
            <div>
              <div className="text-lg font-medium">{item.label}</div>
              {statusMap?.[item.key] && <StatusBadges status={statusMap[item.key]} />}
            </div>
            <span className="text-lg">→</span>
          </Button>
        ))}
      </Card>
    </section>
  );
}

function QuestionnaireWire({ questionnaireKey, sessionData, onPersist, onAbort, onDone, onBack }) {
  const definition = QUESTIONNAIRE_DEFINITIONS[questionnaireKey];
  if (!definition) return null;
  const data = sessionData?.[questionnaireKey] || {};
  const responses = data.responses || {};
  const manualMode = isQuestionnaireManual(data);
  const answeredCount = getQuestionnaireAnsweredCount(data, definition);
  const max = definition.max;
  const responseOptions = definition.responseOptions || QUESTIONNAIRE_RESPONSE_OPTIONS;
  const manualTotal = getQuestionnaireManualTotal(data, definition);
  const total = getQuestionnaireEffectiveTotal(data, definition);
  const complete = manualMode ? manualTotal !== null : answeredCount === definition.items.length;
  const setResponse = (itemKey, value) => {
    onPersist?.({ responses: { ...responses, [itemKey]: value } });
  };
  const setManualTotal = (value) => {
    if (value === "") {
      onPersist?.({ entry_mode: "manual", manual_total: null });
      return;
    }
    const normalized = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    onPersist?.({ entry_mode: "manual", manual_total: normalized });
  };

  return (
    <section className="py-6">
      <Header
        title={definition.title}
        subtitle={definition.fullTitle}
        right={<div className="rounded-2xl border border-indigo-100 bg-white/90 px-4 py-2 text-3xl font-semibold tabular-nums shadow-sm">{total ?? "–"} / {max}</div>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <AbortButton onAbort={onAbort} />
        <Button type="button" variant="secondary" size="sm" onClick={onBack}>Zur Fragebogenauswahl</Button>
      </div>
      <Card className="mb-4">
        <div className="text-sm font-medium text-zinc-800">
          {definition.prompt}
        </div>
      </Card>
      <div className="space-y-3">
        <Card className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-zinc-300 accent-indigo-700"
              checked={manualMode}
              onChange={(event) => onPersist?.({ entry_mode: event.target.checked ? "manual" : "items" })}
            />
            <span className="font-medium">Gesamtscore händisch eingeben</span>
          </label>
          {manualMode && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <label className="block text-sm font-medium text-indigo-950" htmlFor={`${questionnaireKey}-manual-total`}>
                Gesamtscore (0–{max})
              </label>
              <input
                id={`${questionnaireKey}-manual-total`}
                className="mt-2 h-12 w-32 rounded-xl border border-indigo-200 bg-white px-3 text-xl font-semibold tabular-nums"
                type="number"
                inputMode="numeric"
                min="0"
                max={max}
                step="1"
                value={manualTotal ?? ""}
                onChange={(event) => setManualTotal(event.target.value)}
                placeholder={`0–${max}`}
              />
            </div>
          )}
        </Card>
        {!manualMode && definition.items.map((item, index) => {
          const selectedValue = getQuestionnaireResponse(data, definition, item.key);
          return (
            <Card key={item.key} className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">
                  {index + 1}
                </span>
                <div className="text-base font-medium leading-relaxed text-zinc-900">{item.text}</div>
              </div>
              <div className={cls("grid gap-2", responseOptions.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")} role="radiogroup" aria-label={item.text}>
                {responseOptions.map((option) => {
                  const selected = selectedValue === option.value;
                  return (
                    <Button
                      key={option.value}
                      size="bare"
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setResponse(item.key, option.value)}
                      className={cls(
                        "min-h-14 rounded-xl border px-3 py-2 text-left text-sm",
                        selected
                          ? "border-indigo-300 bg-indigo-50 text-indigo-950 shadow-sm"
                          : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"
                      )}
                    >
                      {typeof option.value === "number" && <span className="block font-semibold">{option.value}</span>}
                      <span className={cls("block", typeof option.value !== "number" && "font-semibold")}>{option.label}</span>
                    </Button>
                  );
                })}
              </div>
            </Card>
          );
        })}
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle>Auswertung</SectionTitle>
            <div className="text-lg font-semibold tabular-nums">Gesamtwert: {total ?? "–"} / {max}</div>
          </div>
          <div className={cls(
            "rounded-xl border px-3 py-2 text-sm",
            complete
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          )}>
            {manualMode
              ? complete
                ? "Gesamtscore händisch erfasst"
                : "Bitte Gesamtscore eingeben"
              : complete
                ? `Vollständig beantwortet (${answeredCount}/${definition.items.length})`
                : `${answeredCount}/${definition.items.length} Fragen beantwortet`}
          </div>
        </Card>
        <Card className="space-y-2">
          <SectionTitle>Allgemeine Notizen</SectionTitle>
          <textarea
            className="h-28 w-full rounded-xl border p-2"
            value={data.notes || ""}
            onChange={(event) => onPersist?.({ notes: event.target.value })}
            aria-label={`${definition.title} Notiz`}
            placeholder="Allgemeine Notiz"
          />
        </Card>
        {definition.attribution && <div className="text-xs text-zinc-500">{definition.attribution}</div>}
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={onDone}>Fertig</Button>
        </div>
      </div>
    </section>
  );
}

function StatusBadges({ status, centered = false }) {
  const labels = Array.isArray(status) ? status : [status];
  return (
    <div className={cls("mt-1 flex flex-wrap gap-1", centered && "justify-center")}>
      {labels.map((label) => (
        <span
          key={label}
          className={cls(
            "inline-block px-2 py-0.5 rounded-full text-xs border",
            label.includes("abgebrochen") || label.includes("Subtest")
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : label === "fällig"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
          )}
        >
          {label}
        </span>
      ))}
    </div>
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
          <Button size="bare"
            key={i.key}
            onClick={() => onOpen && onOpen(i.key)}
            className="h-20 rounded-2xl border bg-white hover:bg-zinc-50 shadow-sm px-3 text-left flex items-center justify-between"
          >
            <div>
              <div className="font-medium">{i.label}</div>
              {statusMap && statusMap[i.key] && (
                <StatusBadges status={statusMap[i.key]} />
              )}
            </div>
            <span className="text-lg">→</span>
          </Button>
        ))}
      </Card>
    </section>
  );
}

function UhrentestWire({ sessionData, onPersist, onAbort }) {
  const data = sessionData?.uhr || {};
  const [parts, setParts] = useState(() => normalizeClockParts(data.parts) || deriveClockPartsFromScore(data.score));
  const [score, setScore] = useState(() => {
    if (typeof data.score === "number") return data.score;
    const partsFromData = normalizeClockParts(data.parts) || deriveClockPartsFromScore(data.score);
    return scoreClockParts(partsFromData);
  });
  const [note, setNote] = useState(data.note || "");
  useEffect(() => {
    const nextParts = normalizeClockParts(data.parts) || deriveClockPartsFromScore(data.score);
    const nextScore = typeof data.score === "number"
      ? data.score
      : scoreClockParts(nextParts);
    const frameId = requestAnimationFrame(() => {
      setParts(nextParts);
      setScore(nextScore);
      setNote(data.note || "");
    });
    return () => cancelAnimationFrame(frameId);
  }, [data.score, data.note, data.parts]);

  const updateParts = (next) => {
    const nextScore = scoreClockParts(next);
    setParts(next);
    setScore(nextScore);
    onPersist && onPersist({ score: nextScore, parts: next, note });
  };
  return (
    <section className="py-6">
      <Header title="Uhrentest" />
      <div className="mb-3">
        <AbortButton onAbort={onAbort} />
      </div>
      <div className="p-3 rounded-2xl border bg-white max-w-md space-y-3">
        <div className="text-sm text-zinc-700">Punkte: <span className="font-semibold">{score}</span> / 5</div>
        <ClockScoreButtons parts={parts} onToggle={updateParts} />
        <input
          className="w-full rounded-xl border p-2"
          value={note}
          onChange={(e) => {
            const next = e.target.value;
            setNote(next);
            onPersist && onPersist({ score, note: next });
          }}
          aria-label="Notiz"
          placeholder="Notiz"
        />
      </div>
    </section>
  );
}

function CERADMenu({ onOpen }) {
  const items = [
    { key: "cerad_mmst", label: "CERAD MMST" },
    { key: "cerad_wf", label: "Wortflüssigkeit" },
    { key: "cerad_benennen", label: "Boston Naming Test" },
    { key: "cerad_wl", label: "CERAD Verbalgedächtnis" },
    { key: "cerad_fig", label: "Visuokonstruktion / Figuralgedächtnis" },
    { key: "cerad_tmt", label: "CERAD TMT A/B" },
  ];
  return (
    <section className="py-6">
      <Header title="CERAD – Auswahl"/>
      <Card className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((i) => (
          <Button size="bare"
            key={i.key}
            onClick={() => onOpen && onOpen(i.key)}
            className="px-3 py-2 rounded-xl border text-left hover:bg-zinc-50"
          >
            {i.label}
          </Button>
        ))}
      </Card>
    </section>
  );
}

function CERADWFWire({ sessionData, onPersist, onAbort, onDone, onBackToMenu }) {
  const base = sessionData?.cerad_wf || {};
  const [semCount, setSemCount] = useState(base.semantic_count ?? "");
  const [semNote, setSemNote] = useState(base.semantic_note || "");
  const [phonCount, setPhonCount] = useState(base.phonemic_count ?? "");
  const [phonNote, setPhonNote] = useState(base.phonemic_note || "");

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setSemCount(base.semantic_count ?? "");
      setSemNote(base.semantic_note || "");
      setPhonCount(base.phonemic_count ?? "");
      setPhonNote(base.phonemic_note || "");
    });
    return () => cancelAnimationFrame(frameId);
  }, [base.semantic_count, base.semantic_note, base.phonemic_count, base.phonemic_note]);

  const persist = (patch) => onPersist && onPersist(patch);
  const bumpCount = (key, delta) => {
    const current = key === "sem" ? Number(semCount) || 0 : Number(phonCount) || 0;
    const next = Math.max(0, current + delta);
    if (key === "sem") {
      setSemCount(next);
      persist({ semantic_count: next });
    } else {
      setPhonCount(next);
      persist({ phonemic_count: next });
    }
  };

  return (
    <section className="py-6">
      <Header title="CERAD – Wortflüssigkeit" />
      {onBackToMenu && (
        <div className="mb-2">
          <Button size="bare"
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
              <Button size="bare"
                type="button"
                onClick={() => bumpCount("sem", 1)}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                +1 Wort
              </Button>
              <input
                className="w-32 rounded-xl border px-3 text-lg h-16"
                placeholder="0"
                inputMode="numeric"
                value={semCount}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                  setSemCount(n);
                  persist({ semantic_count: n === "" ? null : Number(n) });
                }}
              />
              <Button size="bare"
                type="button"
                onClick={() => bumpCount("sem", -1)}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                -1 Wort
              </Button>
            </div>
          </div>
          <div>
              <textarea
              className="w-full rounded-xl border px-3 py-2 h-20"
              value={semNote}
              onChange={(e) => {
                const next = e.target.value;
                setSemNote(next);
                persist({ semantic_note: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
        </Card>

        <Card className="space-y-3">
          <div className="text-lg font-semibold">Phonematisch – Buchstabe S (60s)</div>
          <Countdown60 />
          <div>
            <label className="block text-sm text-zinc-700">Summe Wörter</label>
            <div className="flex items-stretch gap-3 mt-1">
              <Button size="bare"
                type="button"
                onClick={() => bumpCount("phon", 1)}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                +1 Wort
              </Button>
              <input
                className="w-32 rounded-xl border px-3 text-lg h-16"
                placeholder="0"
                inputMode="numeric"
                value={phonCount}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);
                  setPhonCount(n);
                  persist({ phonemic_count: n === "" ? null : Number(n) });
                }}
              />
              <Button size="bare"
                type="button"
                onClick={() => bumpCount("phon", -1)}
                className="px-8 py-4 rounded-xl border text-lg bg-zinc-50 h-16"
              >
                -1 Wort
              </Button>
            </div>
          </div>
          <div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 h-20"
              value={phonNote}
              onChange={(e) => {
                const next = e.target.value;
                setPhonNote(next);
                persist({ phonemic_note: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
        </Card>
      </div>


      <div className="mt-4">
        <Button size="bare"
          type="button"
          onClick={() => onDone && onDone()}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </Button>
      </div>
    </section>
  );
}

// Timer model (doc comment only)
// type Timer = { id, label, type: "global_reminder"|"subtest_stopwatch", startTs, durationMs?, pausedMs?, pausedAt?, endedAt? }

// ---------- App Shell ----------
export default function App() {
  const authDisabled = import.meta.env?.VITE_DISABLE_AUTH === "true";
  const [designTheme, setDesignTheme] = useState(() => (
    localStorage.getItem("npt_design_theme") === "legacy" ? "legacy" : "modern"
  ));
  const [showSystemUpdateReminder, setShowSystemUpdateReminder] = useState(false);
  const systemUpdateReminderHandledRef = useRef(false);
  const [authOK, setAuthOK] = useState(() => {
    if (typeof window === "undefined") return false;
    if (authDisabled) return true;
    return localStorage.getItem("auth_ok") === "true" || sessionStorage.getItem("auth_temp_ok") === "true";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = designTheme;
    localStorage.setItem("npt_design_theme", designTheme);
  }, [designTheme]);

  useEffect(() => {
    const handleFirstInteraction = (event) => {
      if (systemUpdateReminderHandledRef.current) return;

      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (localStorage.getItem("system_update_reminder_shown_on") === today) {
        systemUpdateReminderHandledRef.current = true;
        return;
      }
      localStorage.setItem("system_update_reminder_shown_on", today);

      systemUpdateReminderHandledRef.current = true;
      event.preventDefault();
      event.stopPropagation();
      setShowSystemUpdateReminder(true);
    };

    window.addEventListener("pointerdown", handleFirstInteraction, true);
    window.addEventListener("keydown", handleFirstInteraction, true);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction, true);
      window.removeEventListener("keydown", handleFirstInteraction, true);
    };
  }, []);

  const [authError, setAuthError] = useState("");
  const [showImpressum, setShowImpressum] = useState(false);
  const [showTestbereiche, setShowTestbereiche] = useState(false);
  const [editingDemographics, setEditingDemographics] = useState(false);
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
  const [hydrated, setHydrated] = useState(false);
  const latestStateRef = useRef({ screen, globalTimers, sessionData, sessionUUID });

  useLayoutEffect(() => {
    latestStateRef.current = { screen, globalTimers, sessionData, sessionUUID };
    if (!hydrated) return;
    localStorage.setItem(SESSION_BACKUP_STORAGE_KEY, JSON.stringify({
      screen,
      globalTimers,
      sessionData,
      sessionUUID,
      lastUpdated: Date.now(),
    }));
  }, [hydrated, screen, globalTimers, sessionData, sessionUUID]);

  const persistNow = useCallback(() => {
    const { screen: s, globalTimers: g, sessionData: sd, sessionUUID: id } = latestStateRef.current;
    const snapshot = { screen: s, globalTimers: g, sessionData: sd, sessionUUID: id, lastUpdated: Date.now() };
    localStorage.setItem(SESSION_BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
    idbSet(id, snapshot).catch((e) => {
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
        const backupRaw = localStorage.getItem(SESSION_BACKUP_STORAGE_KEY);
        const backup = backupRaw ? JSON.parse(backupRaw) : null;
        const validBackup = backup?.sessionUUID === sessionUUID ? backup : null;
        const latest = validBackup && (!saved || (validBackup.lastUpdated || 0) > (saved.lastUpdated || 0)) ? validBackup : saved;
        if (latest) {
          if (latest.screen) setScreen(normalizeScreen(latest.screen));
          if (latest.globalTimers) setGlobalTimers(latest.globalTimers);
          setSessionData(latest.sessionData || {});
        }
      } catch (e) {
        console.error("Persistenz laden fehlgeschlagen", e);
      } finally {
        setHydrated(true);
      }
    })();
  }, [sessionUUID]);

  // Prune stale drawing blobs (keep only current session namespace)
  useEffect(() => {
    idbPruneDrawingsExcept([`${sessionUUID}:`]).catch((e) => console.error("Prune drawings failed", e));
  }, [sessionUUID]);
  // persist on changes (debounced)
  useEffect(() => {
    if (!hydrated) return;
    const h = setTimeout(persistNow, 300);
    return () => clearTimeout(h);
  }, [hydrated, persistNow, sessionUUID, screen, globalTimers, sessionData]);

  // flush immediately when the tab is hidden or closed to reduce data loss risk
  useEffect(() => {
    if (!hydrated) return;
    const flush = () => persistNow();
    window.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [hydrated, persistNow]);

  // Set once when the first actual test screen is opened.
  useEffect(() => {
    if (sessionData?.testing_started_at) return;
    const name = screen?.name;
    if (!name) return;
    if (name === "menu" || name === "cerad_menu" || name === "spannen_menu") return;
    setSessionData((s) => (s?.testing_started_at ? s : { ...s, testing_started_at: Date.now() }));
  }, [screen?.name, sessionData?.testing_started_at]);

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-slate-900">
      <div className="w-full max-w-md p-6 rounded-3xl border border-indigo-100 bg-white/90 shadow-[0_16px_45px_rgba(30,64,175,0.13)] backdrop-blur-sm">
        <div className="theme-modern-only mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Digitale Neuropsychologie</div>
        <div className="mb-3 text-xl font-semibold">Zugang</div>
        <p className="text-sm text-zinc-600 mb-3">Bitte Passwort eingeben, um die Tests zu öffnen.</p>
        <PasswordPrompt onSubmit={handleAuth} error={authError} />
      </div>
      <Button size="bare"
        type="button"
        onClick={() => setShowImpressum(true)}
        className="mt-4 text-sm underline underline-offset-4"
      >
        Impressum
      </Button>
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
    const startedAt = typeof sessionData?.testing_started_at === "number" ? sessionData.testing_started_at : Date.now();
    const started = new Date(startedAt);
    const yyyy = started.getFullYear();
    const mm = String(started.getMonth() + 1).padStart(2, "0");
    const dd = String(started.getDate()).padStart(2, "0");
    const hh = String(started.getHours()).padStart(2, "0");
    const min = String(started.getMinutes()).padStart(2, "0");
    a.download = `${yyyy}-${mm}-${dd}_${hh}-${min}_${pat}_${sessionUUID}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerPdfExport = async () => {
    const pat = (sessionData?.demographics?.patient_initials || "Pat").replace(/[^A-Za-z0-9_-]/g, "");
    const startedAt = typeof sessionData?.testing_started_at === "number" ? sessionData.testing_started_at : Date.now();
    const started = new Date(startedAt);
    const yyyy = started.getFullYear();
    const mm = String(started.getMonth() + 1).padStart(2, "0");
    const dd = String(started.getDate()).padStart(2, "0");
    const hh = String(started.getHours()).padStart(2, "0");
    const min = String(started.getMinutes()).padStart(2, "0");
    const filename = `${yyyy}-${mm}-${dd}_${hh}-${min}_${pat}_${sessionUUID}`;
    // iPad/Safari may block popups if window.open happens after awaited work.
    const win = window.open("", "_blank");
    if (!win) {
      window.alert("PDF-Export konnte nicht geöffnet werden. Bitte Pop-ups für diese Seite erlauben.");
      return;
    }
    win.document.write(`
      <html>
        <head><title>${filename}.pdf</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">PDF-Export wird vorbereitet…</body>
      </html>
    `);
    win.document.close();

    try {
      const row = await buildExportRow(sessionData, sessionUUID, { includeDrawings: false });
      const drawingsData = await loadDcsrDrawings(sessionUUID, sessionData);
      const figureGalleries = await loadDcsrFigureGalleries(sessionData);
      const dcsrByDg = Array.from({ length: 5 }, (_, idx) => {
        const main = drawingsData[idx] ? { src: drawingsData[idx], rating: null } : null;
        const gallery = Array.isArray(figureGalleries[idx]) ? figureGalleries[idx].filter(Boolean) : [];
        const images = [main, ...gallery].filter(Boolean);
        return { dg: idx + 1, images };
      }).filter((x) => x.images.length > 0);
      // Simple HTML print view
    const style = `
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      h2 { font-size: 16px; margin-top: 16px; margin-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      .meta { font-size: 12px; color: #555; margin-bottom: 12px; }
      .draw-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
      .draw-card { border: 1px solid #ccc; padding: 8px; }
      .dg-label { font-size: 14px; font-weight: 700; margin-top: 12px; margin-bottom: 6px; }
      img { max-width: 100%; height: auto; border: 1px solid #ddd; }
    `;
    const formatValue = (v) => (v === null || v === undefined ? "" : v);
    const demoRows = Object.entries(row)
      .filter(([k]) => k.startsWith("demographics_"));
    const dataRows = Object.entries(row)
      .filter(([k]) => !k.startsWith("demographics_"));
    const demoRowsHtml = demoRows
      .map(([k, v]) => `<tr><td>${k}</td><td>${formatValue(v)}</td></tr>`)
      .join("");
    const rowsHtml = dataRows
      .map(([k, v]) => `<tr><td>${k}</td><td>${v === null || v === undefined ? "" : v}</td></tr>`)
      .join("");
    const dcsrHtml = dcsrByDg
      .map(({ dg, images }) => {
        const cards = images
          .map((figure, figIdx) => {
            const ratingText = figure.rating ? DCSR_RATING_LABELS[figure.rating] : "ohne Bewertung";
            return `<div class="draw-card"><div style="font-size:12px;margin-bottom:4px;">DG${dg} – Zeichnung ${figIdx + 1} · ${ratingText}</div><img src="${figure.src}" alt="DCS-R DG${dg} Zeichnung ${figIdx + 1}"/></div>`;
          })
          .join("");
        return `<div class="dg-label">DG${dg}</div><div class="draw-grid">${cards}</div>`;
      })
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>${filename}.pdf</title>
          <style>${style}</style>
        </head>
        <body>
          <div style="margin-bottom:12px;">
            <button onclick="window.print()" style="padding:8px 12px;">Drucken / Als PDF sichern</button>
          </div>
          <h1>Neuropsychologische Testung</h1>
          <div class="meta">Export: ${new Date().toLocaleString()} · Session: ${sessionUUID}</div>
          <h2>Basisdaten</h2>
          <table><tbody>${demoRowsHtml}</tbody></table>
          <h2>Messwerte</h2>
          <table><tbody>${rowsHtml}</tbody></table>
          ${dcsrHtml ? `<h2>DCS-R Zeichnungen</h2>${dcsrHtml}` : ""}
          <script>
            window.onload = function(){
              try { setTimeout(function(){ window.print(); }, 50); } catch (e) {}
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
    } catch (e) {
      console.error("PDF-Export fehlgeschlagen", e);
      try {
        win.document.open();
        win.document.write(`
          <html>
            <head><title>${filename}.pdf</title></head>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
              <h1>PDF-Export fehlgeschlagen</h1>
              <p>Bitte erneut versuchen. Wenn das Problem auf dem iPad bleibt, Seite neu laden und Pop-ups erlauben.</p>
            </body>
          </html>
        `);
        win.document.close();
      } catch {
        // ignore secondary rendering errors
      }
    }
  };

  const statusMap = useMemo(() => {
    const m = {};
    const s = sessionData || {};
    const set = (k, l) => { m[k] = l; };
    const setSubtestAborts = (key, count) => {
      m[key] = ["erfasst", `${count} ${count === 1 ? "Subtest" : "Subtests"} abgebrochen`];
    };

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
    const spanAbortCount = spanAborts.filter(Boolean).length;
    if (spanAbortCount) setSubtestAborts("spannen_menu", spanAbortCount);
    else if (spanStates.some(Boolean)) set("spannen_menu", "erfasst");

    // TMT (kombiniert)
    const anyMainTmt = typeof s.tmt_a === 'number' || typeof s.tmt_b === 'number';
    const mainTmtAbortCount = [s.tmt_a_aborted, s.tmt_b_aborted].filter(Boolean).length;
    if (s.tmt_aborted && !s.tmt_aborted.part) set("tmt_ab", "abgebrochen");
    else if (mainTmtAbortCount || s.tmt_aborted?.part) setSubtestAborts("tmt_ab", mainTmtAbortCount || 1);
    else if (anyMainTmt) set("tmt_ab", "erfasst");

    // Stroop (erfasst wenn mind. eine Zeit gespeichert)
    const stroopTimes = s.stroop || {};
    const anyStroop = Object.keys(stroopTimes).some((k) => typeof stroopTimes[k] === 'number');
    const stroopAbortCount = Object.values(s.stroop_aborted || {}).filter(Boolean).length;
    if (stroopAbortCount) setSubtestAborts("stroop", stroopAbortCount);
    else if (anyStroop) set("stroop","erfasst");

    // Epi-Track
    const epiAborts = s.epi_aborted;
    if (epiAborts?.subtest) setSubtestAborts("epi", 1);
    else if (epiAborts?.reason || epiAborts?.at) set("epi", "abgebrochen");
    else if (epiAborts && typeof epiAborts === "object") setSubtestAborts("epi", Object.values(epiAborts).filter(Boolean).length);
    else if (s.epi && (s.epi.times || s.epi.inv_spanne)) set("epi", "erfasst");

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

    // ACE-III
    if (s.ace_aborted) set("ace", "abgebrochen");
    else if (s.ace && (Object.keys(s.ace.scores || {}).length > 0 || Object.keys(s.ace.raw || {}).length > 0 || s.ace.notes)) set("ace", "erfasst");

    // MoCA
    if (s.moca_aborted) set("moca", "abgebrochen");
    else if (s.moca && (Object.keys(s.moca.scores || {}).length > 0 || Object.keys(s.moca.raw || {}).length > 0 || s.moca.notes)) set("moca", "erfasst");

    // Fragebögen
    const questionnaireKeys = Object.keys(QUESTIONNAIRE_DEFINITIONS);
    const hasQuestionnaireData = (key) => {
      const data = s[key] || {};
      const definition = QUESTIONNAIRE_DEFINITIONS[key];
      return data.entry_mode === "manual" || getQuestionnaireManualTotal(data, definition) !== null || Object.keys(data.responses || {}).length > 0 || !!data.notes;
    };
    questionnaireKeys.forEach((key) => {
      if (s[`${key}_aborted`]) set(key, "abgebrochen");
      else if (hasQuestionnaireData(key)) set(key, "erfasst");
    });
    const questionnaireAbortCount = questionnaireKeys.filter((key) => !!s[`${key}_aborted`]).length;
    const questionnaireAny = questionnaireKeys.some(hasQuestionnaireData);
    if (questionnaireAbortCount) {
      set("frageboegen_menu", [
        ...(questionnaireAny ? ["erfasst"] : []),
        `${questionnaireAbortCount} ${questionnaireAbortCount === 1 ? "Fragebogen" : "Fragebögen"} abgebrochen`,
      ]);
    } else if (questionnaireAny) {
      set("frageboegen_menu", "erfasst");
    }

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
    const ceradAbortCount = [
      s.cerad_wl_aborted,
      s.cerad_mmst_aborted,
      s.cerad_benennen_aborted,
      s.cerad_wf_aborted,
      s.cerad_fig_aborted,
      s.cerad_tmt_a_aborted,
      s.cerad_tmt_b_aborted,
    ].filter(Boolean).length + (() => {
      const tmtAborts = s.cerad_tmt_aborted;
      if (!tmtAborts) return 0;
      if (tmtAborts.part) return 1;
      if (tmtAborts.reason || tmtAborts.at) return 1;
      if (typeof tmtAborts === "object") return Object.values(tmtAborts).filter(Boolean).length;
      return 1;
    })();
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
    if (ceradAbortCount) setSubtestAborts("cerad_menu", ceradAbortCount);
    else if (ceradAny) set("cerad_menu", "erfasst");

    return m;
  }, [sessionData, globalTimers]);

  if (!authOK) return <>{authScreen}<SystemUpdateReminder open={showSystemUpdateReminder} onClose={() => setShowSystemUpdateReminder(false)} /></>;

  return (
    <ErrorBoundary onReset={() => setScreen({ name: "menu" })}>
      <div className="min-h-screen font-sans antialiased text-slate-900">
        <TopBar
          onBackToMenu={() => setScreen({ name: "menu" })}
          globalTimers={globalTimers}
          onClearTimer={clearGlobalTimer}
          onOpenTimer={(t) => { setScreen(t.nav || { name: "menu" }); clearGlobalTimer(t.id); }}
          onNewSession={newSession}
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
        onExportPdf={triggerPdfExport}
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
            saved={!!sessionData?.demographics_saved && !editingDemographics}
            onSave={(payload) => {
              setSessionData((s) => ({
                ...s,
                demographics: { ...(s.demographics || {}), ...payload },
                demographics_saved: true,
              }));
              setEditingDemographics(false);
            }}
          />
        )}

          {screen.name === "vlmt" && (
            <VLMTWire
              addGlobalReminder={addGlobalReminder}
              route={screen}
              savedState={sessionData?.vlmt}
              testLanguage={sessionData?.demographics?.test_language}
              onDone={() => setScreen({ name: "menu" })}
              onStateChange={(data)=> setSessionData((s)=>({ ...s, vlmt: data }))}
              onAbort={(payload)=> setSessionData((s)=>({ ...s, vlmt_aborted: payload }))}
            />
          )}
        {screen.name === "ace" && (
          <AceWire
            sessionData={sessionData}
            testLanguage={sessionData?.demographics?.test_language}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                ace: { ...(s.ace || {}), ...patch },
              }))
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                ace_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "menu" })}
          />
        )}
        {screen.name === "moca" && (
          <MocaWire
            sessionData={sessionData}
            testLanguage={sessionData?.demographics?.test_language}
            onPersist={(patch) =>
              setSessionData((s) => ({
                ...s,
                moca: { ...(s.moca || {}), ...patch },
              }))
            }
            onReset={(language) =>
              setSessionData((s) => {
                const next = {
                  ...s,
                  moca: { language: normalizeTestLanguage(language) },
                };
                delete next.moca_aborted;
                return next;
              })
            }
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                moca_aborted: payload,
              }))
            }
            onDone={() => setScreen({ name: "menu" })}
          />
        )}
        {screen.name === "frageboegen_menu" && (
          <QuestionnaireMenu
            statusMap={statusMap}
            onOpen={(name) => setScreen({ name })}
          />
        )}
        {screen.name === "phq9" && (
          <QuestionnaireWire
            questionnaireKey="phq9"
            sessionData={sessionData}
            onPersist={(patch) => setSessionData((s) => ({
              ...s,
              phq9: { ...(s.phq9 || {}), ...patch },
            }))}
            onAbort={(payload) => setSessionData((s) => ({ ...s, phq9_aborted: payload }))}
            onDone={() => setScreen({ name: "frageboegen_menu" })}
            onBack={() => setScreen({ name: "frageboegen_menu" })}
          />
        )}
        {screen.name === "gad7" && (
          <QuestionnaireWire
            questionnaireKey="gad7"
            sessionData={sessionData}
            onPersist={(patch) => setSessionData((s) => ({
              ...s,
              gad7: { ...(s.gad7 || {}), ...patch },
            }))}
            onAbort={(payload) => setSessionData((s) => ({ ...s, gad7_aborted: payload }))}
            onDone={() => setScreen({ name: "frageboegen_menu" })}
            onBack={() => setScreen({ name: "frageboegen_menu" })}
          />
        )}
        {screen.name === "gds" && (
          <QuestionnaireWire
            questionnaireKey="gds"
            sessionData={sessionData}
            onPersist={(patch) => setSessionData((s) => ({
              ...s,
              gds: { ...(s.gds || {}), ...patch },
            }))}
            onAbort={(payload) => setSessionData((s) => ({ ...s, gds_aborted: payload }))}
            onDone={() => setScreen({ name: "frageboegen_menu" })}
            onBack={() => setScreen({ name: "frageboegen_menu" })}
          />
        )}
        {screen.name === "dcsr" && (
          <DCSRWire
            addGlobalReminder={addGlobalReminder}
            route={screen}
            savedState={sessionData?.dcsr}
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
              testLanguage={sessionData?.demographics?.test_language}
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
            onAbort={(payload) =>
              setSessionData((s) => ({
                ...s,
                epi_aborted: payload.subtest
                  ? {
                      ...((s.epi_aborted && !s.epi_aborted.subtest) ? s.epi_aborted : {}),
                      [payload.subtest]: payload,
                    }
                  : payload,
              }))
            }
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
            onAfterDraw={() => setScreen({ name: "cerad_wl", go: "dg4" })}
            onAfterRecall={() => {
              setSessionData((s) => ({
                ...s,
                cerad_fig: { ...(s.cerad_fig || {}), recall_pending: false },
              }));
              setScreen({ name: "cerad_tmt" });
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
                cerad_tmt_aborted: payload.part
                  ? {
                      ...((s.cerad_tmt_aborted && !s.cerad_tmt_aborted.part) ? s.cerad_tmt_aborted : {}),
                      [payload.part]: payload,
                    }
                  : payload,
              }))
            }
            onDone={() => setScreen({ name: "cerad_menu" })}
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
      <div className="max-w-5xl mx-auto px-4 pb-6 -mt-4 flex flex-col items-start gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setScreen({ name: "menu" });
              setEditingDemographics(true);
            }}
          >
            Basisdaten bearbeiten
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowTestbereiche(true)}
          >
            Testungsaufbau für verschiedene Fragestellungen
          </Button>
          <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-100 bg-white/90 px-3 text-sm shadow-sm cursor-pointer select-none">
            <span className={cls("font-medium", designTheme === "legacy" ? "text-zinc-900" : "text-zinc-500")}>
              Ruhiger Modus
            </span>
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={designTheme === "modern"}
              onChange={() => setDesignTheme((theme) => (theme === "modern" ? "legacy" : "modern"))}
              aria-label="Zwischen ruhigem und farbenfrohem Design umschalten"
            />
            <span className="relative h-6 w-11 rounded-full bg-zinc-300 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-3 peer-focus-visible:ring-indigo-300">
              <span className={cls(
                "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                designTheme === "modern" && "translate-x-5"
              )} />
            </span>
            <span className={cls("font-medium", designTheme === "modern" ? "text-indigo-700" : "text-zinc-500")}>
              Party-Modus
            </span>
          </label>
        </div>
        <Button size="bare"
          type="button"
          onClick={() => setShowImpressum(true)}
          className="text-sm underline underline-offset-4"
        >
          Impressum
        </Button>
      </div>
      <ImpressumModal open={showImpressum} onClose={() => setShowImpressum(false)} />
      <TestbereicheModal
        open={showTestbereiche}
        onClose={() => setShowTestbereiche(false)}
        onOpenTest={(name) => setScreen({ name })}
      />
      <SystemUpdateReminder open={showSystemUpdateReminder} onClose={() => setShowSystemUpdateReminder(false)} />
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
  onBackToMenu,
  globalTimers,
  onClearTimer,
  onOpenTimer,
  onNewSession,
  sessionData,
  onOpenCeradRecall,
  onOpenCeradFigRecall,
  onExportCsv,
  onExportPdf,
}) {
  return (
    <div id="topbar-root" className="sticky top-0 z-30 border-b border-indigo-100 bg-white/80 shadow-[0_4px_18px_rgba(30,64,175,0.06)] backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-3 text-slate-900">
        <Button
          variant="primary"
          size="sm"
          onClick={onBackToMenu}
          onTouchEnd={(e) => { e.preventDefault(); onBackToMenu && onBackToMenu(); }}
        >
          Übersicht
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {sessionData?.cerad_wl?.recall_pending && (
            <Button
              variant="warning"
              size="sm"
              onClick={onOpenCeradRecall}
              onTouchEnd={(e) => { e.preventDefault(); onOpenCeradRecall && onOpenCeradRecall(); }}
            >
              CERAD-Verbalgedächtnis – Abruf starten
            </Button>
          )}
          {sessionData?.cerad_fig?.recall_pending && (
            <Button
              variant="warning"
              size="sm"
              onClick={onOpenCeradFigRecall}
              onTouchEnd={(e) => { e.preventDefault(); onOpenCeradFigRecall && onOpenCeradFigRecall(); }}
            >
              CERAD Figuralgedächtnis – Abruf starten
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={onExportCsv}
          >
            CSV Export
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onExportPdf}
          >
            PDF Export
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onNewSession}
          >
            Neue Testung
          </Button>
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
      const frameId = requestAnimationFrame(() => setTopbarRect({ x: r.left, y: r.top, w: r.width, h: r.height, b: r.bottom }));
      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
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
  const [now, setNow] = useState(Date.now);
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
        <Button size="bare" onClick={onOpen} className="px-2 py-0.5 rounded-lg bg-white border text-xs">
          Öffnen
        </Button>
      )}
      <Button size="bare" onClick={onClear} className="px-2 py-0.5 rounded-lg bg-white border text-xs">
        Entfernen
      </Button>
    </div>
  );
}

// ---------- Tile Menu ----------
function TileMenu({ onOpen, onOpenCERAD, statusMap, disabled }) {
  const tiles = [
    { key: "vlmt", label: "VLMT", accent: "border-violet-200 bg-violet-50/80 hover:bg-violet-100/80", dot: "bg-violet-500" },
    { key: "dcsr", label: "DCS-R", accent: "border-cyan-200 bg-cyan-50/80 hover:bg-cyan-100/80", dot: "bg-cyan-500" },
    { key: "epi", label: "Epi-Track", accent: "border-orange-200 bg-orange-50/80 hover:bg-orange-100/80", dot: "bg-orange-500" },
    { key: "tmt_ab", label: "TMT A und B", accent: "border-lime-200 bg-lime-50/80 hover:bg-lime-100/80", dot: "bg-lime-500" },
    { key: "spannen_menu", label: "Zahlen- und Blockspanne", accent: "border-sky-200 bg-sky-50/80 hover:bg-sky-100/80", dot: "bg-sky-500" },
    { key: "rwt", label: "Wortflüssigkeit (RWT)", accent: "border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100/80", dot: "bg-indigo-500" },
    { key: "stroop", label: "Stroop", accent: "border-rose-200 bg-rose-50/80 hover:bg-rose-100/80", dot: "bg-rose-500" },
    { key: "gp", label: "Grooved Pegboard", accent: "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/80", dot: "bg-emerald-500" },
    { key: "cerad_menu", label: "CERAD plus", accent: "border-fuchsia-200 bg-fuchsia-50/80 hover:bg-fuchsia-100/80", dot: "bg-fuchsia-500" },
    { key: "uhr", label: "Uhrentest", accent: "border-purple-200 bg-purple-50/80 hover:bg-purple-100/80", dot: "bg-purple-500" },
    { key: "ace", label: "ACE-III", accent: "border-blue-200 bg-blue-50/80 hover:bg-blue-100/80", dot: "bg-blue-500" },
    { key: "moca", label: "MoCA", accent: "border-amber-200 bg-amber-50/80 hover:bg-amber-100/80", dot: "bg-amber-500" },
    { key: "frageboegen_menu", label: "Fragebögen", accent: "border-teal-200 bg-teal-50/80 hover:bg-teal-100/80", dot: "bg-teal-500" },
  ];
  return (
    <div className="py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Neue Session – Tests auswählen</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <Button size="bare"
            key={t.label}
            onClick={() => (t.key === "cerad_menu" ? onOpenCERAD() : onOpen(t.key))}
            disabled={disabled}
            className={cls(
              "tile-btn relative h-24 overflow-hidden rounded-2xl border active:scale-[0.99] transition shadow-[0_5px_16px_rgba(30,64,175,0.07)] flex items-center justify-center text-center px-3 text-slate-900",
              disabled ? "border-slate-200 bg-white opacity-50 cursor-not-allowed" : t.accent
            )}
          >
            <span className={cls("tile-accent absolute left-0 top-0 h-full w-1", t.dot)} aria-hidden="true" />
            <div className="text-center">
              <div className="text-lg font-medium">{t.label}</div>
                {statusMap && statusMap[t.key] && (
                  <StatusBadges status={statusMap[t.key]} centered />
                )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}

function DemoCapture({ demographics, saved, onSave }) {
  const {
    patient_initials = "",
    patient_age = "",
    patient_gender = "",
    test_language = "de",
    examiner_initials = "",
    education_school_years = "",
    education_school_label = "",
    education_training_code = "none",
    education_training_label = "",
    education_dissertation_years = 0,
  } = demographics;

  const trainingCodeToYears = (code, dissertationYears = 0) => {
    const disc = Math.max(0, Math.min(3, Number(dissertationYears) || 0));
    if (code === "lehre_2") return 2;
    if (code === "lehre_3") return 3;
    if (code === "lehre_3_5") return 3.5;
    if (code === "bachelor") return 3;
    if (code === "master") return 5;
    if (code === "promotion") return 5 + disc;
    return 0;
  };
  const schoolYearsToLabel = (years) => {
    if (years === 9 || years === "9") return "Haupt-/Volksschulabschluss";
    if (years === 10 || years === "10") return "Realschulabschluss";
    if (years === 12 || years === "12") return "Fachhochschulreife";
    if (years === 13 || years === "13") return "Abitur/Hochschulreife";
    return "";
  };
  const trainingCodeToLabel = (code) => {
    if (code === "lehre_3") return "Ausbildung/Lehre: 3 Jahre";
    if (code === "bachelor") return "Bachelor";
    if (code === "master") return "Master (Bachelor+Master)";
    if (code === "promotion") return "Promotion";
    return "Keine";
  };

  const [local, setLocal] = useState({
    patient_initials: (patient_initials || "").toUpperCase(),
    patient_age: patient_age || "",
    patient_gender,
    test_language: normalizeTestLanguage(test_language),
    examiner_initials: (examiner_initials || "").toUpperCase(),
    education_school_years: education_school_years || "",
    education_school_label: education_school_label || schoolYearsToLabel(education_school_years),
    education_training_code,
    education_training_label: education_training_label || trainingCodeToLabel(education_training_code),
    education_dissertation_years,
  });

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setLocal({
      patient_initials: (patient_initials || "").toUpperCase(),
      patient_age: patient_age || "",
      patient_gender,
      test_language: normalizeTestLanguage(test_language),
      examiner_initials: (examiner_initials || "").toUpperCase(),
      education_school_years: education_school_years || "",
      education_school_label: education_school_label || schoolYearsToLabel(education_school_years),
      education_training_code,
      education_training_label: education_training_label || trainingCodeToLabel(education_training_code),
      education_dissertation_years,
    }));
    return () => cancelAnimationFrame(frameId);
  }, [patient_initials, patient_age, patient_gender, test_language, examiner_initials, education_school_years, education_school_label, education_training_code, education_training_label, education_dissertation_years]);

  const schoolYears = Number(local.education_school_years) || 0;
  const trainingYears = trainingCodeToYears(local.education_training_code, local.education_dissertation_years);
  const educationYears = schoolYears + trainingYears;

  if (saved) return null;

  return (
      <div className="mb-4">
      <Card className="space-y-2">
        <div className="text-sm font-semibold">Basisdaten {demographics && Object.keys(demographics).length ? "bearbeiten" : ""}</div>
      <div className="grid grid-cols-1 gap-2">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-sm text-zinc-700 leading-tight min-h-[2.5rem]">Patient:innen-Initialen</label>
              <input
                className="mt-1 w-28 rounded-xl border p-2"
                value={local.patient_initials}
                onChange={(e) => setLocal((l) => ({ ...l, patient_initials: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() }))}
                placeholder="z. B. AB"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-700 leading-tight min-h-[2.5rem]">Patient:innen-Alter</label>
              <input
                className="mt-1 w-28 rounded-xl border p-2"
                value={local.patient_age}
                type="text"
                inputMode="numeric"
                pattern="\\d*"
                onChange={(e) => setLocal((l) => ({ ...l, patient_age: e.target.value.replace(/\\D/g, "") }))}
                placeholder="z. B. 72"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-700 leading-tight min-h-[2.5rem]">Geschlecht</label>
              <select
                className="mt-1 w-28 rounded-xl border p-2 bg-white"
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
              <label className="block text-sm text-zinc-700 leading-tight min-h-[2.5rem]">Initialien Neuropsycholog:in</label>
              <input
                className="mt-1 w-28 rounded-xl border p-2"
                value={local.examiner_initials}
                onChange={(e) => setLocal((l) => ({ ...l, examiner_initials: e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase() }))}
                placeholder="z. B. CD"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Testsprache</label>
            <select
              className="mt-1 w-full rounded-xl border p-2 bg-white"
              value={local.test_language}
              onChange={(e) => setLocal((l) => ({ ...l, test_language: normalizeTestLanguage(e.target.value) }))}
            >
              {TEST_LANGUAGE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Schulabschluss (Jahre, ohne Wiederholung)</label>
            <select
              className="mt-1 w-full rounded-xl border p-2 bg-white"
              value={local.education_school_years}
              onChange={(e) => {
                const value = e.target.value;
                setLocal((l) => ({
                  ...l,
                  education_school_years: value,
                  education_school_label: schoolYearsToLabel(value),
                }));
              }}
            >
              <option value="">Bitte wählen …</option>
              <option value="9">9 Jahre (Haupt-/Volksschulabschluss)</option>
              <option value="10">10 Jahre (Realschulabschluss)</option>
              <option value="12">12 Jahre (Fachhochschulreife)</option>
              <option value="13">13 Jahre (Abitur/Hochschulreife)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-700">Längste absolvierte Ausbildung</label>
            <select
              className="mt-1 w-full rounded-xl border p-2 bg-white"
              value={local.education_training_code}
              onChange={(e) => {
                const next = e.target.value;
                setLocal((l) => ({
                  ...l,
                  education_training_code: next,
                  education_training_label: trainingCodeToLabel(next),
                  education_dissertation_years: next === "promotion" ? (l.education_dissertation_years || 0) : 0,
                }));
              }}
            >
              <option value="">Bitte wählen …</option>
              <option value="none">Keine</option>
              <option value="lehre_3">Ausbildung/Lehre: 3 Jahre</option>
              <option value="bachelor">Bachelor</option>
              <option value="master">Master (Bachelor+Master)</option>
              <option value="promotion">Promotion</option>
            </select>
          </div>
          {local.education_training_code === "promotion" && (
            <div>
              <label className="block text-sm text-zinc-700">Promotionsdauer (max. 3 Jahre)</label>
              <select
                className="mt-1 w-full rounded-xl border p-2 bg-white"
                value={local.education_dissertation_years}
                onChange={(e) => setLocal((l) => ({ ...l, education_dissertation_years: e.target.value }))}
              >
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
          )}
          <div className="text-sm">
            <span className="font-medium">Berechnete Bildungsjahre: {educationYears}</span>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="bare"
            type="button"
            onClick={() => {
              const dissertation = local.education_training_code === "promotion"
                ? Math.max(0, Math.min(3, Number(local.education_dissertation_years || 0)))
                : 0;
              onSave({
                ...local,
                patient_age: local.patient_age,
                patient_initials: (local.patient_initials || "").toUpperCase(),
                test_language: normalizeTestLanguage(local.test_language),
                examiner_initials: (local.examiner_initials || "").toUpperCase(),
                education_school_label: local.education_school_label || schoolYearsToLabel(local.education_school_years),
                education_training_label: local.education_training_label || trainingCodeToLabel(local.education_training_code),
                education_school_years: schoolYears,
                education_training_code: local.education_training_code || "none",
                education_dissertation_years: dissertation,
                education_training_years: trainingCodeToYears(local.education_training_code, dissertation),
                education_years: schoolYears + trainingCodeToYears(local.education_training_code, dissertation),
              });
            }}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Speichern
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---------- VLMT Wireframe ----------
function VLMTWire({ addGlobalReminder, route, savedState, testLanguage, onDone, onStateChange, onAbort }) {
  const saved = savedState || {};
  const initialActiveIdx =
    saved.step === "score" ? Math.max(0, (saved.dg || 1) - 1)
    : saved.step === "dg6" ? 5
    : saved.step === "dg7" ? 6
    : null;
  const initialActiveResult = (initialActiveIdx !== null && Array.isArray(saved.results))
    ? (saved.results[initialActiveIdx] || {})
    : {};
  const [step, setStep] = useState(saved.step === "list" ? "score" : saved.step || "choose"); // "score" | "interf" | "dg6" | "waiting" | "dg7" | "rekog"
  const [list, setList] = useState(saved.list || null); // "A"|"B"|"C"|"D"
  useEffect(() => {
    if (route && route.name === "vlmt" && route.go === "dg7") {
      const frameId = requestAnimationFrame(() => {
        setList((currentList) => currentList || route.list || null);
        setStep("dg7");
      });
      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
  }, [route]);

  const materials = useMemo(() => getVlmtMaterials(testLanguage), [testLanguage]);
  const words = useMemo(() => {
    if (!list) return [];
    const source = materials.lists[list];
    const fallback = Array.from({ length: 15 }, (_, i) => `${list}-Wort ${i + 1}`);
    return (source && source.length ? source : fallback).map((item, idx) => (
      normalizeMaterialEntry(item, VLMT_LISTS[list]?.[idx] || `${list}-Wort ${idx + 1}`)
    ));
  }, [list, materials]);

  const [dg, setDG] = useState(saved.dg || 1); // DG1..5
  // per-step scoring: selected words (boolean) and perseverations per word (number)
  const [sel, setSel] = useState(() => ({ ...(initialActiveResult.sel || {}) }));
  const [pers, setPers] = useState(() => ({ ...(initialActiveResult.pers || {}) }));
  const [intrusions, setIntrusions] = useState(() => initialActiveResult.intrusions || "");
  const [results, setResults] = useState(
    () => {
      const base = Array.from({ length: 7 }, () => ({ sel: {}, pers: {}, intrusions: "" }));
      const savedResults = Array.isArray(saved.results) ? saved.results : [];
      savedResults.slice(0, 7).forEach((r, idx) => {
        base[idx] = {
          sel: { ...(r?.sel || {}) },
          pers: { ...(r?.pers || {}) },
          intrusions: r?.intrusions || "",
        };
      });
      return base;
    }
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

  const loadFrom = useCallback((index) => {
    const r = results[index] || { sel: {}, pers: {}, intrusions: "" };
    setSel(r.sel || {});
    setPers(r.pers || {});
    setIntrusions(r.intrusions || "");
  }, [results]);

  function nextDG() {
    // commit DG1..5 index (dg-1)
    commitCurrent(dg - 1);
    if (dg < 5) {
      setDG(dg + 1);
      resetScoring();
      setStep("score");
    } else {
      resetScoring();
      setStep("interf");
    }
  }

  const goBackInVlmt = () => {
    if (step === "score") {
      if (dg <= 1) {
        setStep("choose");
        return;
      }
      commitCurrent(dg - 1);
      setDG(dg - 1);
      return;
    }
    if (step === "interf") {
      setStep("score");
      return;
    }
    if (step === "dg6") {
      setStep("interf");
      return;
    }
    if (step === "waiting") {
      setStep("dg6");
      return;
    }
    if (step === "dg7") {
      setStep("waiting");
    }
  };

  const interferenzList = useMemo(() => (
    materials.interference.map((item, idx) => normalizeMaterialEntry(item, VLMT_INTERFERENCE[idx] || `Interferenz ${idx + 1}`))
  ), [materials]);
  const rekogItems = useMemo(() => (
    list
      ? (materials.recognition[list] || []).map((item, idx) => {
          const fallback = VLMT_RECOG[list]?.[idx] || {};
          const entry = normalizeMaterialEntry(item, fallback.w || `${list}-Rekog ${idx + 1}`);
          return {
            ...(item && typeof item === "object" ? item : {}),
            ...entry,
            t: typeof item?.t === "boolean" ? item.t : !!fallback.t,
          };
        })
      : []
  ), [list, materials]);
  const [rekogSel, setRekogSel] = useState(() => ({ ...(saved.rekog?.sel || {}) })); // key: index -> boolean
  const rekogHits = useMemo(() => rekogItems.reduce((a, it, i) => a + ((rekogSel[i] && it.t) ? 1 : 0), 0), [rekogItems, rekogSel]);
  const rekogFP = useMemo(() => rekogItems.reduce((a, it, i) => a + ((rekogSel[i] && !it.t) ? 1 : 0), 0), [rekogItems, rekogSel]);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      if (step === "score") loadFrom(dg - 1);
      if (step === "dg6") loadFrom(5);
      if (step === "dg7") loadFrom(6);
    });
    return () => cancelAnimationFrame(frameId);
  }, [step, dg, loadFrom]);

  const emitState = useCallback(() => {
    const nextResults = results.slice();
    const activeIdx =
      step === "score" ? Math.max(0, dg - 1)
      : step === "dg6" ? 5
      : step === "dg7" ? 6
      : null;
    if (activeIdx !== null) {
      nextResults[activeIdx] = { sel: { ...sel }, pers: { ...pers }, intrusions };
    }
    onStateChange && onStateChange({ step, list, dg, results: nextResults, rekog: { sel: rekogSel, items: rekogItems } });
  }, [onStateChange, step, list, dg, results, sel, pers, intrusions, rekogSel, rekogItems]);

  useEffect(() => {
    emitState();
  }, [emitState]);

  const renderScoringWord = (entry) => {
    const active = !!sel[entry.key];
    const p = pers[entry.key] || 0;
    return (
      <div key={entry.key} className="flex min-w-0 gap-2">
        <Button size="bare"
          onClick={() => {
            setSel((m) => ({ ...m, [entry.key]: !m[entry.key] }));
            setPers((m) => (!sel[entry.key] ? m : { ...m, [entry.key]: 0 }));
          }}
          className={cls(
            "h-12 min-w-0 flex-1 rounded-xl border px-3 text-left",
            active ? "bg-emerald-50 border-emerald-200" : "bg-white"
          )}
        >
          <span className="block truncate">{entry.label}</span>
        </Button>
        {active && (
          <Button size="bare"
            type="button"
            onClick={() => setPers((m) => ({ ...m, [entry.key]: (m[entry.key] || 0) + 1 }))}
            className="h-12 shrink-0 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs text-sky-800"
            title="Perseveration +1"
          >
            P{p > 0 ? `(${p})` : ""}
          </Button>
        )}
      </div>
    );
  };

  return (
    <section className="py-6">
      <Header title="VLMT" />
      <div className="mb-3"><AbortButton onAbort={onAbort} /></div>

      {step === "choose" && (
        <Card>
          <p className="mb-3">Wähle Wortliste:</p>
          <div className="flex gap-2">
            {["A", "B", "C", "D"].map((L) => (
              <Button size="bare"
                key={L}
                onClick={() => {
                  setList(L);
                  setStep("score");
                  setDG(1);
                }}
                className="px-3 py-2 rounded-xl border"
              >
                VLMT-{L}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {step === "score" && (
        <Card>
          <SectionTitle>DG{dg} – Scoring</SectionTitle>
          <div className="grid grid-cols-3 gap-x-2 gap-y-8">
            {words.map(renderScoringWord)}
          </div>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-3 rounded-xl border p-2 h-20"
            aria-label="Notiz"
            placeholder="Notiz"
          />
          <div className="flex gap-2 mt-4">
            <Button size="bare" onClick={nextDG} className="px-3 py-2 rounded-xl bg-zinc-900 text-white">
              {dg < 5 ? `Weiter (zu DG${dg + 1})` : "Weiter (zur Interferenzliste)"}
            </Button>
            <Button size="bare" onClick={goBackInVlmt} className="px-3 py-2 rounded-xl border">
              Zurück
            </Button>
          </div>
        </Card>
      )}

      {step === "interf" && (
        <Card>
          <SectionTitle>Interferenzliste – nur Vorlesen</SectionTitle>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-8 text-zinc-700">
            {interferenzList.map((entry) => (
              <li key={entry.key} className="px-3 py-2 rounded-lg bg-zinc-100 border border-zinc-200">
                {entry.label}
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-4">
            <Button size="bare"
              onClick={() => {
                setStep("dg6");
                resetScoring();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter (zu DG6)
            </Button>
            <Button size="bare" onClick={goBackInVlmt} className="px-3 py-2 rounded-xl border">
              Zurück
            </Button>
          </div>
        </Card>
      )}

      {step === "dg6" && (
        <Card>
          <SectionTitle>DG6 – Abfrage ohne Vorlesen</SectionTitle>
          <p className="text-sm text-zinc-600 mb-2">Scoring identisch zu DG1–5 (ohne erneutes Vorlesen).</p>
          <div className="grid grid-cols-3 gap-x-2 gap-y-8">
            {words.map(renderScoringWord)}
          </div>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-3 rounded-xl border p-2 h-20"
            aria-label="Notiz"
            placeholder="Notiz"
          />
          <div className="flex gap-2 mt-4">
            <Button size="bare"
              onClick={() => { commitCurrent(5); addGlobalReminder("VLMT DG7", 30, { name: "vlmt", go: "dg7", list }); setStep("waiting"); }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              30-Min. Reminder starten
            </Button>
            <Button size="bare" onClick={goBackInVlmt} className="px-3 py-2 rounded-xl border">Zurück</Button>
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
          <div className="flex gap-2 mt-4">
            <Button size="bare" onClick={goBackInVlmt} className="px-3 py-2 rounded-xl border">
              Zurück
            </Button>
            <Button size="bare" onClick={() => setStep("dg7")} className="px-3 py-2 rounded-xl border bg-zinc-900 text-white">
              DG7 jetzt durchführen
            </Button>
          </div>
        </Card>
      )}

      {step === "dg7" && (
        <Card>
          <SectionTitle>DG7 – verzögerter Abruf</SectionTitle>
          <div className="grid grid-cols-3 gap-x-2 gap-y-8">
            {words.map(renderScoringWord)}
          </div>
          <textarea
            value={intrusions}
            onChange={(e) => setIntrusions(e.target.value)}
            className="w-full mt-3 rounded-xl border p-2 h-20"
            aria-label="Notiz"
            placeholder="Notiz"
          />
          <div className="flex gap-2 mt-4">
            <Button size="bare" onClick={goBackInVlmt} className="px-3 py-2 rounded-xl border">
              Zurück
            </Button>
            <Button size="bare"
              onClick={() => { commitCurrent(6); setStep("rekog"); }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: Wiedererkennen
            </Button>
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
              <Button size="bare"
                key={`${it.key}_${i}`}
                onClick={() => setRekogSel((m) => ({ ...m, [i]: !m[i] }))}
                className={cls(
                  "flex items-center justify-between border rounded-xl px-3 py-2",
                  rekogSel[i] ? (it.t ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200") : "bg-white"
                )}
                title={it.t ? "Originalwort (Treffer bei Auswahl)" : "Lure (Fehler bei Auswahl)"}
              >
                <span>{it.label}</span>
                {rekogSel[i] && (
                  <span className="text-xs px-2 py-0.5 rounded-lg bg-white border">
                    {it.t ? "Treffer" : "Fehler"}
                  </span>
                )}
              </Button>
            ))}
          </div>
          <div className="mt-4 text-sm text-zinc-700">
            Treffer: <span className="font-medium">{rekogHits}</span> · Fehler: <span className="font-medium">{rekogFP}</span>
          </div>
          <div className="mt-4">
            <Button size="bare"
              onClick={() => {
                emitState();
                if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig
            </Button>
          </div>
        </Card>
      )}
    </section>
  );

}

// ---------- DCS-R Wireframe ----------
function DcsrFigureGallery({ figures, onOpen }) {
  const [previewUrls, setPreviewUrls] = useState([]);

  useEffect(() => {
    const urlsToRevoke = [];
    const next = (Array.isArray(figures) ? figures : []).map((figure) => {
      const data = figure?.data;
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data);
        urlsToRevoke.push(url);
        return url;
      }
      return data || null;
    });
    const frameId = requestAnimationFrame(() => setPreviewUrls(next));
    return () => {
      cancelAnimationFrame(frameId);
      urlsToRevoke.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [figures]);

  if (!Array.isArray(figures) || figures.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="text-sm font-medium text-zinc-700">Gespeicherte Figuren</div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {figures.map((figure, figIdx) => {
          const rating = figure?.rating || null;
          const src = previewUrls[figIdx];
          return (
            <div key={figure?.key || figIdx} className="rounded-xl border bg-white p-2">
              <Button size="bare"
                type="button"
                onClick={() => onOpen && onOpen(figIdx)}
                className="relative block w-full rounded-lg border bg-zinc-50 p-1 hover:bg-zinc-100"
                disabled={!src}
              >
                <span
                  className={cls(
                    "absolute right-1.5 top-1.5 rounded-full border px-2 py-0.5 text-xs font-medium shadow-sm",
                    rating
                      ? DCSR_RATINGS.find((item) => item.key === rating)?.className
                      : "bg-white border-zinc-300 text-zinc-700"
                  )}
                >
                  {rating ? DCSR_RATING_LABELS[rating] : "offen"}
                </span>
                {src && (
                  <img
                    src={src}
                    alt={`Gespeicherte DCS-R Figur ${figIdx + 1}`}
                    className="h-24 w-full object-contain"
                  />
                )}
              </Button>
              <div className="mt-1 text-xs text-zinc-500">Antippen zum Bewerten</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DcsrFigureOverlay({ figure, onClose, onRate }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    const data = figure?.data;
    if (!data) {
      const frameId = requestAnimationFrame(() => setSrc(null));
      return () => cancelAnimationFrame(frameId);
    }
    if (data instanceof Blob) {
      const url = URL.createObjectURL(data);
      const frameId = requestAnimationFrame(() => setSrc(url));
      return () => {
        cancelAnimationFrame(frameId);
        URL.revokeObjectURL(url);
      };
    }
    const frameId = requestAnimationFrame(() => setSrc(data));
    return () => cancelAnimationFrame(frameId);
  }, [figure]);

  if (!figure) return null;
  const rating = figure.rating || null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-2xl border bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">DCS-R Figur bewerten</div>
            <div className="text-sm text-zinc-600">
              Aktuell: {rating ? DCSR_RATING_LABELS[rating] : "ohne Bewertung"}
            </div>
          </div>
          <Button size="bare" type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl border text-sm">
            Schließen
          </Button>
        </div>
        {src && (
          <img
            src={src}
            alt="DCS-R Figur Detailansicht"
            className="max-h-[62vh] w-full object-contain rounded-xl border bg-zinc-50"
          />
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {DCSR_RATINGS.map((item) => (
            <Button size="bare"
              key={item.key}
              type="button"
              onClick={() => onRate && onRate(item.key)}
              className={cls(
                "px-3 py-2 rounded-xl border text-sm",
                rating === item.key ? item.className : "bg-white border-zinc-300"
              )}
            >
              {item.label}
            </Button>
          ))}
          <Button size="bare"
            type="button"
            onClick={() => onRate && onRate(null)}
            className={cls(
              "px-3 py-2 rounded-xl border text-sm",
              rating === null ? "bg-zinc-100 border-zinc-300 text-zinc-800" : "bg-white border-zinc-300"
            )}
          >
            Ohne Bewertung
          </Button>
        </div>
      </div>
    </div>
  );
}

function DCSRWire({ addGlobalReminder, route, savedState, sessionUUID, onStateChange, onAbort, onDone }) {
  const saved = savedState || {};
  const [step, setStep] = useState(saved.step || "choose"); // "dg" | "waiting" | "rekog"
  const [ver, setVer] = useState(saved.ver || null); // "V1"|"V2"
  const [dg, setDG] = useState(saved.dg || 1);
  const [counts, setCounts] = useState(() =>
    Array.from({ length: 5 }, (_, i) => ({
      falsch: 0,
      gedreht: 0,
      perseveration: 0,
      ...(saved.counts?.[i] || {}),
      richtig: Math.min(DCSR_MAX_CORRECT_PER_TRIAL, Number(saved.counts?.[i]?.richtig) || 0),
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
  const initialGalleryKeys = useMemo(() => {
    if (!Array.isArray(saved.drawingGalleryKeys)) return Array.from({ length: 5 }, () => []);
    return Array.from({ length: 5 }, (_, idx) => (
      normalizeDcsrGalleryEntries(saved.drawingGalleryKeys[idx])
    ));
  }, [saved.drawingGalleryKeys]);
  const drawingKeysRef = useRef(initialKeys);
  const drawingGalleryKeysRef = useRef(initialGalleryKeys);
  const [drawingKeysVersion, bumpDrawingKeysVersion] = useState(0);
  const [drawings, setDrawings] = useState(() => Array.from({ length: 5 }, () => null));
  const [drawingGalleries, setDrawingGalleries] = useState(() => Array.from({ length: 5 }, () => []));
  const [rekogResp, setRekogResp] = useState(() => saved.rekog?.responses || { korrekt: 0, falsch: 0, gedreht: 0 });
  const [drawPadResetIndex, setDrawPadResetIndex] = useState(0);
  const [expandedFigure, setExpandedFigure] = useState(null);
  const totalFirst3 = counts.slice(0, 3).reduce((a, c) => a + c.richtig, 0);
  const ceilingHit = counts.some((c) => c.richtig >= DCSR_MAX_CORRECT_PER_TRIAL);
  const figSrc = ver === "V2" ? "/material/DCS-2.png" : "/material/DCS-1.png";
  const hasCurrentDrawing = !!drawings[dg - 1];

  const inc = useCallback((field) => {
    setCounts((xs) => {
      const copy = xs.slice();
      const current = Number(copy[dg - 1][field] || 0);
      copy[dg - 1] = {
        ...copy[dg - 1],
        [field]: field === "richtig"
          ? Math.min(DCSR_MAX_CORRECT_PER_TRIAL, current + 1)
          : current + 1,
      };
      return copy;
    });
  }, [dg]);

  function fillRemainingDgsWithCeiling() {
    setCounts((xs) => {
      const copy = xs.slice();
      for (let i = dg; i < 5; i += 1) {
        copy[i] = {
          richtig: DCSR_MAX_CORRECT_PER_TRIAL,
          falsch: 0,
          gedreht: 0,
          perseveration: 0,
        };
      }
      return copy;
    });
    setDG(5);
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
      if (onStateChange) {
        onStateChange({
          step,
          ver,
          dg,
          counts,
          drawingKeys: keys,
          drawingGalleryKeys: drawingGalleryKeysRef.current,
          rekog: { responses: rekogResp },
        });
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Load drawings for current session from IDB
  useEffect(() => {
    const keys = drawingKeysRef.current;
    const galleryKeys = drawingGalleryKeysRef.current;
    (async () => {
      const loaded = await Promise.all(keys.map((k) => (k ? idbGetDrawing(k) : null)));
      const loadedGalleries = await Promise.all(galleryKeys.map(async (list) => {
        if (!Array.isArray(list) || !list.length) return [];
        const entries = normalizeDcsrGalleryEntries(list);
        const vals = await Promise.all(entries.map((entry) => idbGetDrawing(entry.key)));
        return entries
          .map((entry, idx) => {
            const data = vals[idx];
            if (!data) return null;
            return { ...entry, data };
          })
          .filter(Boolean);
      }));
      setDrawings((arr) => {
        const next = arr.slice();
        loaded.forEach((d, i) => { if (d) next[i] = d; });
        return next;
      });
      setDrawingGalleries((arr) => {
        const next = arr.slice();
        loadedGalleries.forEach((list, i) => { next[i] = list; });
        return next;
      });
      // prune drawings from old sessions to avoid quota bloat
      idbPruneDrawingsExcept([`${sessionUUID}:`]).catch((e) => console.error("Prune drawings failed", e));
    })();
  }, [sessionUUID]);

  const emitState = useCallback(() => {
    onStateChange && onStateChange({
      step,
      ver,
      dg,
      counts,
      drawingKeys: drawingKeysRef.current,
      drawingGalleryKeys: drawingGalleryKeysRef.current,
      rekog: { responses: rekogResp },
    });
  }, [onStateChange, step, ver, dg, counts, rekogResp]);

  useEffect(() => {
    emitState();
  }, [emitState, drawingKeysVersion]);

  const handleDrawingChange = useCallback(async (data) => {
    const hadKey = !!drawingKeysRef.current[dg - 1];
    const key = drawingKeysRef.current[dg - 1] || `${drawingNamespace}dg${dg}`;
    drawingKeysRef.current[dg - 1] = key;
    if (!hadKey) bumpDrawingKeysVersion((v) => v + 1);
    setDrawings((arr) => {
      const next = arr.slice();
      next[dg - 1] = data;
      return next;
    });
    try {
      if (data) await idbSetDrawing(key, data);
      else await idbDeleteDrawing(key);
    } catch (e) {
      console.error("Zeichnung speichern fehlgeschlagen", e);
    }
  }, [dg, drawingNamespace]);

  const handleSaveFigure = useCallback(async (data, rating = null) => {
    if (!data) return;
    const key = `${drawingNamespace}dg${dg}:fig_${crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    const list = drawingGalleryKeysRef.current[dg - 1] || [];
    const entry = { key, rating: DCSR_RATING_FIELDS[rating] ? rating : null };
    drawingGalleryKeysRef.current[dg - 1] = [...list, entry];
    setDrawingGalleries((arr) => {
      const next = arr.slice();
      const cur = Array.isArray(next[dg - 1]) ? next[dg - 1] : [];
      next[dg - 1] = [...cur, { ...entry, data }];
      return next;
    });
    bumpDrawingKeysVersion((v) => v + 1);
    try {
      await idbSetDrawing(key, data);
    } catch (e) {
      console.error("Galerie-Figur speichern fehlgeschlagen", e);
    }
  }, [dg, drawingNamespace]);

  const clearCurrentDrawing = useCallback(async () => {
    await handleDrawingChange(null);
    setDrawPadResetIndex((x) => x + 1);
  }, [handleDrawingChange]);

  const saveFigureAndClear = useCallback(async (data, rating = null) => {
    if (!data) return;
    await handleSaveFigure(data, rating);
    await clearCurrentDrawing();
  }, [handleSaveFigure, clearCurrentDrawing]);

  const saveScoredFigure = useCallback(async (label) => {
    const current = drawings[dg - 1];
    if (!current) return;
    try {
      await saveFigureAndClear(current, label);
    } catch (e) {
      console.error("Bewertete Figur speichern fehlgeschlagen", e);
    }
  }, [dg, drawings, saveFigureAndClear]);

  const saveUnscoredFigureAndClear = useCallback(async (data) => {
    if (!data) return;
    await saveFigureAndClear(data, null);
  }, [saveFigureAndClear]);

  const updateFigureRating = useCallback((dgIdx, figIdx, rating) => {
    const nextRating = DCSR_RATING_FIELDS[rating] ? rating : null;
    const existing = drawingGalleryKeysRef.current[dgIdx]?.[figIdx];
    const normalized = normalizeDcsrGalleryEntry(existing);
    if (!normalized) return;
    const prevRating = normalized.rating || null;
    if (prevRating === nextRating) return;
    drawingGalleryKeysRef.current[dgIdx] = drawingGalleryKeysRef.current[dgIdx].map((entry, idx) => (
      idx === figIdx ? { ...normalizeDcsrGalleryEntry(entry), rating: nextRating } : normalizeDcsrGalleryEntry(entry)
    ));
    setDrawingGalleries((arr) => {
      const next = arr.slice();
      const list = Array.isArray(next[dgIdx]) ? next[dgIdx].slice() : [];
      list[figIdx] = { ...(list[figIdx] || {}), rating: nextRating };
      next[dgIdx] = list;
      return next;
    });
    setCounts((xs) => {
      const next = xs.slice();
      const row = { ...next[dgIdx] };
      const prevField = DCSR_RATING_FIELDS[prevRating];
      const nextField = DCSR_RATING_FIELDS[nextRating];
      if (prevField) row[prevField] = Math.max(0, Number(row[prevField] || 0) - 1);
      if (nextField) {
        row[nextField] = nextField === "richtig"
          ? Math.min(DCSR_MAX_CORRECT_PER_TRIAL, Number(row[nextField] || 0) + 1)
          : Number(row[nextField] || 0) + 1;
      }
      next[dgIdx] = row;
      return next;
    });
    bumpDrawingKeysVersion((v) => v + 1);
  }, []);

  const onScoringPlus = useCallback((field, tag) => {
    if (!drawings[dg - 1]) return;
    inc(field);
    void saveScoredFigure(tag);
  }, [dg, drawings, inc, saveScoredFigure]);

  const adjustRekog = useCallback((key, delta) => {
    setRekogResp((r) => ({
      ...r,
      [key]: Math.max(0, Number(r?.[key] || 0) + delta),
    }));
  }, []);

  return (
    <section className="py-6">
      <Header title="DCS-R" />
      <div className="mb-3"><AbortButton onAbort={onAbort} /></div>
      {step === "choose" && (
        <Card>
          <p className="mb-3">Wähle Version:</p>
          <div className="flex gap-2">
            {["V1", "V2"].map((v) => (
              <Button
                variant="secondary"
                key={v}
                onClick={() => {
                  setVer(v);
                  setStep("dg");
                }}
              >
                {v}
              </Button>
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
              <div className="mt-3 grid gap-4 md:grid-cols-2 md:items-start">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-zinc-600">Skizze der vom Patienten gelegten Figur</div>
                    <div
                      className={cls(
                        "rounded-full border px-2 py-0.5 text-xs",
                        drawings[dg - 1]
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500"
                      )}
                    >
                      {drawings[dg - 1] ? "Skizze noch nicht gespeichert" : "Keine aktive Skizze"}
                    </div>
                  </div>
                  <DrawPad
                    key={`dcsr-dg-${dg}-${drawPadResetIndex}`}
                    width={640}
                    height={180}
                    initialData={drawings[dg - 1]}
                    onChange={handleDrawingChange}
                    savedFigures={[]}
                    onSaveFigure={saveUnscoredFigureAndClear}
                    showSaveFigureButton={false}
                  />
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-zinc-600">Scoring</div>
                  <div className="grid grid-cols-2 gap-2">
                    {DCSR_RATINGS.map((rating) => (
                      <Counter
                        key={rating.key}
                        label={rating.label}
                        val={counts[dg - 1][rating.field]}
                        onPlus={() => onScoringPlus(rating.field, rating.key)}
                        disabled={!hasCurrentDrawing}
                        variant={rating.variant}
                        className={rating.className}
                      />
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => saveUnscoredFigureAndClear(drawings[dg - 1])}
                    disabled={!drawings[dg - 1]}
                  >
                    Figur ohne Bewertung speichern
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DcsrFigureGallery
            figures={drawingGalleries[dg - 1] || []}
            onOpen={(figIdx) => setExpandedFigure({ dgIdx: dg - 1, figIdx })}
          />

          {counts[dg - 1].richtig >= DCSR_MAX_CORRECT_PER_TRIAL && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              Ceiling erreicht ({DCSR_MAX_CORRECT_PER_TRIAL}/{DCSR_MAX_CORRECT_PER_TRIAL}). Verbleibende DG werden automatisch mit {DCSR_MAX_CORRECT_PER_TRIAL} Punkten gefüllt.
              {dg < 5 && (
                <div className="mt-2">
                  <Button
                    variant="success"
                    onClick={fillRemainingDgsWithCeiling}
                  >
                    Restliche DG mit 9 ausfüllen
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              onClick={() => {
                if (dg > 1) setDG(dg - 1);
                else setStep("choose");
              }}
            >
              {dg > 1 ? `Zurück zu DG${dg - 1}` : "Zurück zur Versionswahl"}
            </Button>
            {dg < 5 && !ceilingHit && (
              <Button variant="primary" onClick={() => setDG(dg + 1)}>
                Weiter zu DG{dg + 1}
              </Button>
            )}
            {(dg === 5 || ceilingHit) && (
              <Button
                variant="primary"
                onClick={() => {
                  addGlobalReminder("DCS Rekognition", 30, { name: "dcsr", go: "rekog" });
                  setStep("waiting");
                }}
              >
                30-Min. Reminder für Rekognition
              </Button>
            )}
          </div>
          {dg <= 3 && totalFirst3 <= 1 && (
            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
              <span>Niedrige Lernleistung in DG1–3 (≤1 richtig).</span>
              <AbortButton
                defaultReasonType="Abbruchkriterium erreicht"
                defaultNote={`DCS-R: Niedrige Lernleistung in DG1–3 (≤1 richtig; Summe: ${totalFirst3})`}
                variant="warning"
                size="sm"
                onAbort={(payload) => {
                  onAbort && onAbort({
                    ...payload,
                    dg,
                    totalFirst3,
                  });
                }}
              >
                Testabbruch
              </AbortButton>
            </div>
          )}
        </Card>
      )}

      <DcsrFigureOverlay
        figure={
          expandedFigure
            ? drawingGalleries[expandedFigure.dgIdx]?.[expandedFigure.figIdx] || null
            : null
        }
        onClose={() => setExpandedFigure(null)}
        onRate={(rating) => {
          if (!expandedFigure) return;
          updateFigureRating(expandedFigure.dgIdx, expandedFigure.figIdx, rating);
        }}
      />

      {step === "waiting" && (
        <Card>
          <SectionTitle>Wartephase bis Rekognition</SectionTitle>
          <p className="text-sm text-zinc-600">
            Reminder läuft oben rechts. Du kannst andere Tests durchführen und später zurückkehren.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("dg")}>
              {`Zurück zu DG${dg}`}
            </Button>
            <Button variant="primary" onClick={() => setStep("rekog")}>
              Rekognition jetzt durchführen
            </Button>
          </div>
        </Card>
      )}

      {step === "rekog" && (
        <Card>
          <SectionTitle>Rekognitionsdurchgang</SectionTitle>
          <div className="p-3 rounded-2xl border bg-white mt-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { key: "korrekt", label: "korrekt", color: "bg-emerald-50 border-emerald-200" },
                { key: "falsch", label: "falsch", color: "bg-rose-50 border-rose-200" },
                { key: "gedreht", label: "gedreht", color: "bg-amber-50 border-amber-200" },
              ].map((item) => (
                <div key={item.key} className={`rounded-xl border p-3 ${item.color}`}>
                  <div className="text-sm text-zinc-700">{item.label}</div>
                  <div className="mt-1 text-3xl font-semibold tabular-nums">{rekogResp[item.key] ?? 0}</div>
                  <div className="mt-3 flex gap-2">
                    <Button size="bare"
                      type="button"
                      onClick={() => adjustRekog(item.key, 1)}
                      className="min-h-12 min-w-16 px-5 py-3 rounded-xl border bg-white text-base font-medium"
                    >
                      +1
                    </Button>
                    <Button size="bare"
                      type="button"
                      onClick={() => adjustRekog(item.key, -1)}
                      disabled={!rekogResp[item.key]}
                      className="min-h-12 min-w-16 px-5 py-3 rounded-xl border bg-white text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      -1
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setRekogResp({ korrekt: 0, falsch: 0, gedreht: 0 })}
              >
                Zurücksetzen
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep("waiting")}>
              Zurück zur Wartephase
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                emitState();
                if (onDone) onDone();
              }}
            >
              Fertig
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

function Counter({ label, val, onPlus, max, disabled: disabledProp = false, variant = "secondary", className }) {
  const disabled = disabledProp || (typeof max === "number" && val >= max);
  return (
    <div className={cls("rounded-xl border p-3", disabledProp ? "bg-zinc-50 text-zinc-500" : className || "bg-white")}>
      <div>
        <div className={cls("text-sm", disabledProp ? "text-zinc-600" : "text-current")}>{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{val}</div>
      </div>
      <div className="mt-2">
        <Button
          type="button"
          disabled={disabled}
          onClick={onPlus}
          variant={disabledProp ? "secondary" : variant}
          className="w-full"
        >
          +1
        </Button>
      </div>
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
    <Button size="bare"
      onClick={() => onChange(value ? 0 : 1)}
      className={cls(
        "px-3 py-2 rounded-xl border flex justify-between",
        value ? "bg-emerald-50 border-emerald-200" : "bg-white border-zinc-300"
      )}
    >
      <span>{label}</span>
      {value ? <span>✔️</span> : <span>✖️</span>}
    </Button>
  );
}

// UI-Zähler: 0–5 Punkte (Buchstabieren)
function MmstCounter({ value, onChange, max = 5, label }) {
  return (
    <div className="p-3 rounded-xl border bg-white flex items-center justify-between">
      <div>{label}</div>
      <div className="flex gap-2 items-center">
        <Button size="bare"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="px-3 py-1.5 rounded-xl border"
        >
          −
        </Button>
        <div className="font-bold w-6 text-center">{value}</div>
        <Button size="bare"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-3 py-1.5 rounded-xl border"
        >
          +
        </Button>
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
          <Button size="bare"
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
            <input
              className="w-full rounded-xl border p-2"
              value={note}
              onChange={(e) => updateNote(e.target.value)}
              aria-label="Notiz"
              placeholder="Notiz"
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
              <Button size="bare"
                onClick={() => updateBuchstabieren(Math.max(0, Number(items.buchstabieren ?? 0) - 1))}
                className="px-3 py-1.5 rounded-xl border"
              >
                −
              </Button>
              <div className="text-2xl font-semibold w-10 text-center">{Number(items.buchstabieren ?? 0)}</div>
              <Button size="bare"
                onClick={() => updateBuchstabieren(Math.min(MMST_STRUCTURE.buchstabieren.max, Number(items.buchstabieren ?? 0) + 1))}
                className="px-3 py-1.5 rounded-xl border"
              >
                +1
              </Button>
            </div>
          </div>
          <div>
            <input
              className="mt-1 w-full rounded-xl border p-2"
              value={mmst.buchstabieren_note || ""}
              onChange={(e) => onPersist && onPersist({ buchstabieren_note: e.target.value })}
              aria-label="Notiz"
              placeholder="Notiz"
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
        <Button size="bare"
          type="button"
          onClick={() => onDone && onDone()}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </Button>
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
          <Button size="bare"
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
        <div className="mt-2 grid grid-cols-2 gap-3">
          {items.map((it, idx) => (
            <div key={it.id} className="p-3 rounded-2xl border bg-white flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-28 flex-1 font-medium text-sm">{it.label}</div>
                <div className="flex shrink-0 gap-1 text-xs">
                  <Button size="bare"
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
                  </Button>
                  <Button size="bare"
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
                  </Button>
                </div>
              </div>
              <div>
                <input
                  className="w-full rounded-xl border p-2 text-sm"
                  value={it.note}
                  onChange={(e) =>
                    updateItems((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, note: e.target.value } : p))
                    )
                  }
                  aria-label="Notiz"
                  placeholder="Notiz"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {onDone && (
        <div className="mt-4">
          <Button size="bare"
            type="button"
            onClick={onDone}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Weiter
          </Button>
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
    if (route?.go !== "recall") return undefined;
    const frameId = requestAnimationFrame(() => setStep("recall"));
    return () => cancelAnimationFrame(frameId);
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
    const frameId = requestAnimationFrame(() => {
      setNoteDraw(base.draw_note || "");
      setNoteRecall(base.recall_note || "");
      setCritDraw(buildCriteriaState(base.draw_scores || {}, base.draw_criteria || {}));
      setCritRecall(buildCriteriaState(base.recall_scores || {}, base.recall_criteria || {}));
    });
    return () => cancelAnimationFrame(frameId);
  }, [base.draw_note, base.recall_note, base.draw_scores, base.recall_scores, base.draw_criteria, base.recall_criteria]);

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
              <Button size="bare"
                key={idx}
                type="button"
                onClick={() => toggleCriterion(idx)}
                className={cls(
                  "w-full text-left px-3 py-2 rounded-xl border text-sm",
                  active ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-white border-zinc-300"
                )}
              >
                {c}
              </Button>
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
          <Button size="bare"
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
            <textarea
              className="w-full rounded-xl border px-3 py-2 h-20"
              value={noteDraw}
              onChange={(e) => {
                const next = e.target.value;
                setNoteDraw(next);
                updateNote("draw", next);
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="bare"
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: true });
                if (onAfterDraw) onAfterDraw();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Erinnerung für Abruf setzen
            </Button>
            <Button size="bare"
              type="button"
              onClick={() => setStep("recall")}
              className="px-3 py-2 rounded-xl border"
            >
              Direkt zum Abruf
            </Button>
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
            <textarea
              className="w-full rounded-xl border px-3 py-2 h-20"
              value={noteRecall}
              onChange={(e) => {
                const next = e.target.value;
                setNoteRecall(next);
                updateNote("recall", next);
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
          <div className="mt-4">
            <Button size="bare"
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: false });
                if (onAfterRecall) onAfterRecall();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function CERADTmtScreen({ label, persisted, note, onPersist, onPersistNote, onAbort, onDone }) {
  const [comment, setComment] = useState(note || "");
  const stopwatchRef = useRef(null);
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
          ref={stopwatchRef}
          persisted={persisted}
          onPersist={onPersist}
          autoAbortMs={autoLimit}
          onAutoAbort={handleAutoAbort}
        />
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-xl border p-2"
            value={comment}
            onChange={(e) => {
              const next = e.target.value;
              setComment(next);
              onPersistNote && onPersistNote(next);
            }}
            aria-label="Notiz"
            placeholder="Notiz"
          />
        </div>
        <div className="pt-1">
          <Button size="bare"
            type="button"
            onClick={() => {
              stopwatchRef.current?.stop?.();
              onDone && onDone();
            }}
            className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
          >
            Fertig
          </Button>
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
  const stopARef = useRef(null);
  const stopBRef = useRef(null);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setNoteA(data.note_a || "");
      setNoteB(data.note_b || "");
    });
    return () => cancelAnimationFrame(frameId);
  }, [data.note_a, data.note_b]);

  const stopBothTimers = () => {
    stopARef.current?.stop?.();
    stopBRef.current?.stop?.();
  };

  return (
    <section className="py-6">
      <Header title="CERAD – TMT A/B" />
      {onBackToMenu && (
        <div className="mb-2">
          <Button size="bare"
            type="button"
            onClick={() => {
              stopBothTimers();
              onBackToMenu();
            }}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
            ref={stopARef}
            persisted={data.a_time ?? null}
            onPersist={(ms) => onPersist && onPersist({ a_time: ms })}
            autoAbortMs={180_000}
            onAutoAbort={(info) => {
              onPersist && onPersist({ a_time: 180_000 });
              onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: 180_000, at: info?.at || Date.now(), part: "A" });
            }}
          />
          <div className="flex w-full max-w-md items-center gap-2">
            <input
              className="w-full rounded-xl border p-2"
              value={noteA}
              onChange={(e) => {
                const next = e.target.value;
                setNoteA(next);
                onPersist && onPersist({ note_a: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
          <div className="pt-1">
            <Button size="bare"
              type="button"
              onClick={() => {
                stopBothTimers();
                setStep("b");
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter zu TMT-B
            </Button>
          </div>
        </Card>
      )}

      {step === "b" && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-B</div>
          </div>
          <Stopwatch
            ref={stopBRef}
            persisted={data.b_time ?? null}
            onPersist={(ms) => onPersist && onPersist({ b_time: ms })}
            autoAbortMs={300_000}
            onAutoAbort={(info) => {
              onPersist && onPersist({ b_time: 300_000 });
              onAbort && onAbort({ reason: "Automatischer Abbruch", limit_ms: 300_000, at: info?.at || Date.now(), part: "B" });
            }}
          />
          <div className="flex w-full max-w-md items-center gap-2">
            <input
              className="w-full rounded-xl border p-2"
              value={noteB}
              onChange={(e) => {
                const next = e.target.value;
                setNoteB(next);
                onPersist && onPersist({ note_b: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </div>
          <div className="pt-1">
            <Button size="bare"
              type="button"
              onClick={() => {
                stopBothTimers();
                onDone && onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Fertig (weiter)
            </Button>
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
  const tARef = useRef(null);
  const tBRef = useRef(null);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setNoteA(sessionData?.tmt_a_note ?? "");
      setNoteB(sessionData?.tmt_b_note ?? "");
    });
    return () => cancelAnimationFrame(frameId);
  }, [sessionData?.tmt_a_note, sessionData?.tmt_b_note]);

  const persist = (patch) => onPersist && onPersist(patch);
  const stopBothTimers = () => {
    tARef.current?.stop?.();
    tBRef.current?.stop?.();
  };

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
            ref={tARef}
            persisted={tA}
            onPersist={(ms) => persist({ tmt_a: ms })}
            autoAbortMs={180_000}
            onAutoAbort={(info) => {
              const payload = { reason: "Automatischer Abbruch", limit_ms: 180_000, at: info?.at || Date.now(), part: "A" };
              persist({ tmt_a: 180_000, tmt_a_aborted: payload });
            }}
          />
          <Card className="space-y-1">
            <input
              className="w-full rounded-xl border p-2"
              value={noteA}
              onChange={(e) => {
                const next = e.target.value;
                setNoteA(next);
                persist({ tmt_a_note: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </Card>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">TMT-B</div>
          </div>
          <Stopwatch
            ref={tBRef}
            persisted={tB}
            onPersist={(ms) => persist({ tmt_b: ms })}
            autoAbortMs={300_000}
            onAutoAbort={(info) => {
              const payload = { reason: "Automatischer Abbruch", limit_ms: 300_000, at: info?.at || Date.now(), part: "B" };
              persist({ tmt_b: 300_000, tmt_b_aborted: payload });
            }}
          />
          <Card className="space-y-1">
            <input
              className="w-full rounded-xl border p-2"
              value={noteB}
              onChange={(e) => {
                const next = e.target.value;
                setNoteB(next);
                persist({ tmt_b_note: next });
              }}
              aria-label="Notiz"
              placeholder="Notiz"
            />
          </Card>
        </Card>
      </div>
      <div className="mt-4">
        <Button size="bare"
          type="button"
          onClick={() => {
            stopBothTimers();
            onDone && onDone();
          }}
          className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
        >
          Fertig
        </Button>
      </div>
    </section>
  );
}

// ---------- CERAD Verbalgedächtnis Wireframe ----------
function CERADWordlistWire({ sessionData, route, testLanguage, onPersist, onAbort, onDone, onBackToMenu, onAfterDG3, onAfterRecog }) {
  const [step, setStep] = useState("dg1"); // "dg1" | "dg2" | "dg3" | "dg4" | "recog"
  const base = sessionData?.cerad_wl || {};
  const materials = useMemo(() => getCeradWordlistMaterials(testLanguage), [testLanguage]);
  const ceradWordEntries = useMemo(() => (
    materials.wordlist.map((item, idx) => normalizeMaterialEntry(item, CERAD_WORDLIST[idx] || `cerad_word_${idx + 1}`))
  ), [materials]);
  const ceradRecognitionItems = useMemo(() => (
    materials.recognitionItems.map((item, idx) => {
      const fallback = CERAD_WL_RECOG_ITEMS[idx] || {};
      const entry = normalizeMaterialEntry(item, fallback.word || `cerad_recog_${idx + 1}`);
      return {
        ...(item && typeof item === "object" ? item : {}),
        ...entry,
        isOrig: typeof item?.isOrig === "boolean" ? item.isOrig : !!fallback.isOrig,
      };
    })
  ), [materials]);

  // Route-based entry into DG4
  useEffect(() => {
    if (route?.go !== "dg4") return undefined;
    const frameId = requestAnimationFrame(() => setStep("dg4"));
    return () => cancelAnimationFrame(frameId);
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
    return ceradWordEntries.reduce((acc, entry) => acc + (marks[entry.key] ? 1 : 0), 0);
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
          {ceradWordEntries.map((entry) => {
            const active = !!dg.marks[entry.key];
            return (
              <Button size="bare"
                key={entry.key}
                type="button"
                onClick={() => updateDGMarks(key, entry.key)}
                className={cls(
                  "h-12 rounded-xl border flex items-center justify-between px-3",
                  active ? "bg-emerald-50 border-emerald-200" : "bg-white"
                )}
              >
                <span className="text-left truncate pr-2">{entry.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="text-sm">Intrusionen (Anzahl):</div>
          <div className="flex items-center gap-2">
            <Button size="bare"
              type="button"
              onClick={() => updateDGIntrusions(key, -1)}
              className="px-3 py-1.5 rounded-xl border"
            >
              −
            </Button>
            <div className="w-10 text-center font-mono tabular-nums">{intr}</div>
            <Button size="bare"
              type="button"
              onClick={() => updateDGIntrusions(key, 1)}
              className="px-3 py-1.5 rounded-xl border"
            >
              +
            </Button>
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
    if (!base.recog?.responses) return undefined;
    const frameId = requestAnimationFrame(() => setRecogAns(base.recog.responses));
    return () => cancelAnimationFrame(frameId);
  }, [base.recog]);

  const calcRecogCounts = useCallback((responses) => {
    let correctYes = 0;
    let correctNo = 0;
    ceradRecognitionItems.forEach((item) => {
      const ans = responses[item.key];
      if (item.isOrig && ans === "ja") correctYes += 1;
      if (!item.isOrig && ans === "nein") correctNo += 1;
    });
    return { correctYes, correctNo };
  }, [ceradRecognitionItems]);

  const recogCounts = useMemo(() => calcRecogCounts(recogAns), [calcRecogCounts, recogAns]);

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
          <Button size="bare"
            type="button"
            onClick={onBackToMenu}
            className="px-3 py-1.5 rounded-xl border text-sm"
          >
            Zur CERAD-Auswahl
          </Button>
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
            <Button size="bare"
              onClick={() => setStep("dg2")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: DG2
            </Button>
          </div>
        </>
      )}

      {step === "dg2" && (
        <>
          {renderDGCard("dg2", "DG2 – Sofortabruf 2")}
          <div className="mt-3 flex gap-2">
            <Button size="bare"
              onClick={() => setStep("dg3")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: DG3
            </Button>
          </div>
        </>
      )}

      {step === "dg3" && (
        <>
          {renderDGCard("dg3", "DG3 – Sofortabruf 3")}
          <div className="mt-4">
            <Button size="bare"
              type="button"
              onClick={() => {
                onPersist && onPersist({ recall_pending: true });
                if (onAfterDG3) onAfterDG3();
                else if (onDone) onDone();
              }}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Erinnerung setzen & weiter zu Figuren
            </Button>
          </div>
        </>
      )}

      {/* DG4 – verzögerter Abruf (kein Timer, aber direkt ansteuerbar) */}
      {step === "dg4" && (
        <>
          {renderDGCard("dg4", "DG4 – verzögerter Abruf")}
          <div className="mt-3 flex gap-2">
            <Button size="bare"
              onClick={() => setStep("recog")}
              className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
            >
              Weiter: Wiedererkennen
            </Button>
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
            <div className="mt-3 grid grid-cols-2 gap-3">
              {ceradRecognitionItems.map((item) => {
                const ans = recogAns[item.key] || null;
                const isCorrect = (val) => (item.isOrig ? val === "ja" : val === "nein");
                const btnClass = (val) => {
                  if (ans !== val) return "bg-white border-zinc-300";
                  return isCorrect(val)
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-rose-50 border-rose-200 text-rose-700";
                };
                return (
                  <div
                    key={item.key}
                    className="p-3 rounded-2xl border bg-white flex items-center justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <div className="font-semibold text-lg tracking-tight">{item.label}</div>
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
                      <Button size="bare"
                        type="button"
                        onClick={() => toggleRecog(item.key, "ja")}
                        className={cls(
                          "px-3 py-1.5 rounded-xl border text-sm",
                          btnClass("ja")
                        )}
                      >
                        JA
                      </Button>
                      <Button size="bare"
                        type="button"
                        onClick={() => toggleRecog(item.key, "nein")}
                        className={cls(
                          "px-3 py-1.5 rounded-xl border text-sm",
                          btnClass("nein")
                        )}
                      >
                        NEIN
                      </Button>
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
              <Button size="bare"
                type="button"
                onClick={() => {
                  if (onAfterRecog) onAfterRecog();
                  else if (onDone) onDone();
                }}
                className="px-3 py-2 rounded-xl bg-zinc-900 text-white"
              >
                Fertig
              </Button>
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
