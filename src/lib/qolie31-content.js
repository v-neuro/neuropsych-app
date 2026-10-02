// Transcribed and visually checked against the supplied four-page German PDF:
// "10 QOLIE-31.pdf", MAPI translation released 1997. Original spelling retained.
// Labels without text (block 9 codes 2–4) remain numeric, as printed.
const options = (entries) => entries.map(([value, label]) => ({ value, label }));
const frequency = options([[1, "immer"], [2, "meistens"], [3, "ziemlich oft"], [4, "manchmal"], [5, "selten"], [6, "nie"]]);
const worry = options([[1, "sehr in Sorge"], [2, "etwas in Sorge"], [3, "wenig in Sorge"], [4, "gar nicht in Sorge"]]);
const burden = options([[1, "leide überhaupt nicht darunter"], [2, ""], [3, ""], [4, ""], [5, "leide ausgesprochen darunter"]]);
const row = (id, text, responseOptions) => ({ id, text, options: responseOptions });

export const QOLIE31_INSTRUCTIONS = [
  "In diesem Fragebogen stellen wir Fragen zu Ihrer Gesundheit und zu Ihren täglichen Aktivitäten. Bitte beantworten Sie jede Frage, indem Sie die entsprechende Zahl (1,2,3,...) ankreuzen.",
  "Zögern Sie bitte nicht, jemanden um Unterstützung zu bitten, wenn Sie Hilfe beim Lesen oder Ausfüllen des Fragebogens brauchen.",
];

export const QOLIE31_BLOCKS = [
  {
    number: 1,
    title: "Wie schätzen Sie Ihre Lebensqualität im großen und ganzen ein?",
    instruction: "(Kreuzen Sie nur eine Zahl auf der Skala unten an)",
    items: [row(1, "", options([
      [10, "Lebensqualität könnte nicht besser sein"], [9, ""], [8, ""], [7, ""], [6, ""], [5, ""], [4, ""], [3, ""], [2, ""], [1, ""],
      [0, "Lebensqualität könnte nicht schlechter sein (vergleichbar damit, tot zu sein oder noch schlechter)"],
    ]))],
  },
  {
    number: 2,
    title: "In diesen Fragen geht es darum, wie Sie sich FÜHLEN und wie es Ihnen in den vergangenen 4 Wochen gegangen ist. (Bitte kreuzen Sie in jeder Zeile das Kästchen an, das Ihrem Befinden am ehesten entspricht).",
    instruction: "Wie oft in den vergangenen 4 Wochen...",
    items: [
      row(2, "... waren Sie voller Schwung?", frequency),
      row(3, "... waren Sie sehr nervös?", frequency),
      row(4, "... waren Sie so niedergeschlagen, daß Sie nichts aufheitern konnte?", frequency),
      row(5, "... waren Sie ruhig und gelassen?", frequency),
      row(6, "... waren Sie voller Energie?", frequency),
      row(7, "... waren Sie entmutigt und traurig?", frequency),
      row(8, "... waren Sie erschöpft?", frequency),
      row(9, "... waren Sie glücklich?", frequency),
      row(10, "... waren Sie müde?", frequency),
      row(11, "... waren Sie in Sorge, einen weiteren Anfall zu erleiden?", frequency),
      row(12, "... hatten Sie Schwierigkeiten beim Nachdenken und dem Lösen von Problemen (z.B. beim Pläne machen, Entscheidungen treffen, dem Lernen von neuen Dingen)?", frequency),
      row(13, "... waren Sie durch Ihren Gesundheitszustand in Ihren sozialen Kontakten und Unternehmungen eingeschränkt (wie Besuche bei Freunden oder nahen Verwandten)?", frequency),
    ],
  },
  {
    number: 3,
    title: "Wie war Ihre LEBENSQUALITÄT in den letzten 4 Wochen (d.h., wie ist es Ihnen gegangen)?",
    instruction: "(Bitte kreuzen Sie nur eine Zahl an)",
    items: [row(14, "", options([[1, "Sehr gut: hätte kaum besser sein können"], [2, "Ziemlich gut"], [3, "Gut und schlecht zu etwa gleichen Teilen"], [4, "Ziemlich schlecht"], [5, "Sehr schlecht: hätte kaum schlechter sein können"]]))],
  },
  {
    number: 4,
    title: "Die folgende Frage betrifft das Gedächtnis.",
    items: [row(15, "Hatten Sie in den letzten 4 Wochen Probleme mit Ihrem Gedächtnis?", options([[1, "ja, viele"], [2, "ja, einige"], [3, "nur wenige"], [4, "nein, überhaupt keine"]]))],
  },
  {
    number: 5,
    title: "Die folgende Frage betrifft die Häufigkeit, mit der Sie in den letzten 4 Wochen Probleme hatten sich zu erinnern oder die Häufigkeit, mit der dieses Gedächtnisproblem Ihre normale Arbeit oder Ihr normales Leben beeinträchtigt hat.",
    items: [row(16, "Probleme, sich an Dinge zu erinnern, die man Ihnen gesagt hat.", frequency)],
  },
  {
    number: 6,
    title: "Die folgenden Fragen betreffen Probleme, die Sie eventuell mit der Konzentration haben. Wie oft konnten Sie sich in den letzten 4 Wochen schlecht konzentrieren, oder wie oft haben diese Probleme Ihre normale Arbeit oder Ihr normales Leben beeinträchtigt?",
    items: [row(17, "Probleme, sich auf das Lesen zu konzentrieren", frequency), row(18, "Probleme, sich darauf zu konzentrieren, bei einer Sache zu bleiben", frequency)],
  },
  {
    number: 7,
    title: "Die folgenden Fragen betreffen Probleme, die Sie eventuell mit bestimmten Aktivitäten haben. Wie sehr haben Ihre Epilepsie oder antiepileptischen Medikamente Sie in den letzten 4 Wochen bei folgenden Aktivitäten beeinträchtigt ...",
    items: [row(19, "Freizeit (z.B. Hobbys, Ausgehen)", options([[1, "sehr viel"], [2, "viel"], [3, "etwas"], [4, "nur ein bißchen"], [5, "überhaupt nicht"]])), row(20, "Autofahren, Motorradfahren usw.", options([[1, "sehr viel"], [2, "viel"], [3, "etwas"], [4, "nur ein bißchen"], [5, "überhaupt nicht"]]))],
  },
  {
    number: 8,
    title: "Die folgende Fragen beziehen sich darauf, wie Sie sich hinsichtlich Ihrer Anfälle fühlen.",
    items: [
      row(21, "Wie groß ist Ihre Angst, in den nächsten 4 Wochen einen Anfall zu erleiden?", options([[1, "sehr große Angst"], [2, "etwas Angst"], [3, "wenig Angst"], [4, "überhaupt keine Angst"]])),
      row(22, "Machen Sie sich Sorgen, daß Sie sich während eines Anfalls verletzen könnten?", options([[1, "große Sorgen"], [2, "ein wenig Sorgen"], [3, "gar keine Sorgen"]])),
      row(23, "Wie sehr sind Sie in Sorge, daß ein Anfall in den nächsten 4 Wochen Sie in eine peinliche Situation bringen oder andere Probleme mit Ihren Mitmenschen verursachen könnte?", worry),
      row(24, "Wie sehr sind Sie in Sorge, daß die Medikamente, die Sie einnehmen, schlecht für Sie sein werden, wenn Sie sie über längere Zeit einnehmen?", worry),
    ],
  },
  {
    number: 9,
    title: "Kreuzen Sie für jedes der folgenden Probleme an, wie sehr Sie unter ihnen leiden.",
    items: [
      row(25, "Anfälle", burden), row(26, "Gedächtnisprobleme", burden),
      row(27, "Beeinträchtigungen im Arbeitsleben", burden), row(28, "Beeinträchtigungen im sozialen Leben", burden),
      row(29, "Körperliche Auswirkungen der antiepileptischen Medikamente", burden), row(30, "Psychische Auswirkungen der antiepileptischen Medikamente", burden),
    ],
  },
  {
    number: 10,
    title: "Für wie gut oder schlecht halten Sie Ihre Gesundheit?",
    instruction: "Auf der unten abgebildeten Thermometerskala ist der denkbar beste Gesundheitszustand bei 100 und der denkbar schlechteste bei 0. Bitte geben Sie an, wie Sie Ihre Gesundheit einschätzen, indem Sie eine Zahl auf der Skala ankreuzen. Bitte berücksichtigen Sie Ihre Epilepsie als Teil Ihrer allgemeinen Gesundheit, wenn Sie diese Frage beantworten.",
    items: [{ id: 31, text: "", healthRating: true }],
  },
];

export const QOLIE31_ATTRIBUTION = "QOLIE 31, copyright 1993, RAND. All rights reserved. The QOLIE 31 was developed in cooperation with Professional Postgraduate Services, a division of Physicians World Communications Group, and the QOLIE Development Group. MAPI translation released 1997";

// Examiner-entry presentation requested by the user. Source wording above stays
// available for reference; canonical IDs/codes and time frames stay unchanged.
// Only the user-requested parenthetical on the zero endpoint is omitted from display.
const examinerTitles = {
  1: "Lebensqualität insgesamt",
  2: "Befinden · Häufigkeit in den letzten 4 Wochen",
  3: "Lebensqualität · letzte 4 Wochen",
  4: "Gedächtnisprobleme · letzte 4 Wochen",
  5: "Erinnern / Beeinträchtigung · letzte 4 Wochen",
  6: "Konzentration / Beeinträchtigung · letzte 4 Wochen",
  7: "Aktivitäten: Beeinträchtigung durch Epilepsie oder Medikamente · letzte 4 Wochen",
  8: "Anfalls- und Medikamentensorgen",
  9: "Belastung durch Probleme",
  10: "Allgemeiner Gesundheitszustand · einschließlich Epilepsie",
};
const examinerItems = {
  2: "Voller Schwung", 3: "Sehr nervös", 4: "Niedergeschlagen, durch nichts aufzuheitern",
  5: "Ruhig und gelassen", 6: "Voller Energie", 7: "Entmutigt und traurig", 8: "Erschöpft",
  9: "Glücklich", 10: "Müde", 11: "Sorge vor einem weiteren Anfall",
  12: "Schwierigkeiten beim Nachdenken / Problemlösen (Planen, Entscheiden, Lernen)",
  13: "Gesundheitsbedingte Einschränkung sozialer Kontakte / Unternehmungen",
  15: "Gedächtnisprobleme", 16: "Schwierigkeiten, sich an Gesagtes zu erinnern",
  17: "Konzentrationsprobleme beim Lesen", 18: "Konzentrationsprobleme, bei einer Sache zu bleiben",
  21: "Angst vor einem Anfall · nächste 4 Wochen",
  22: "Sorge vor Verletzung während eines Anfalls",
  23: "Sorge vor Peinlichkeit / Problemen mit Mitmenschen durch einen Anfall · nächste 4 Wochen",
  24: "Sorge wegen langfristiger Medikamenteneinnahme",
};
export const QOLIE31_EXAMINER_BLOCKS = QOLIE31_BLOCKS.map((block) => ({
  ...block,
  title: examinerTitles[block.number],
  instruction: undefined,
  items: block.items.map((item) => ({
    ...item,
    text: examinerItems[item.id] ?? item.text,
    options: item.id === 1 ? item.options.map((option) => ({
      ...option,
      label: option.value === 0 ? "Lebensqualität könnte nicht schlechter sein" : option.label,
    })) : item.options,
  })),
}));
