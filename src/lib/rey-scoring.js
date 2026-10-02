// Copy-only ROCFT. Both sets of IDs were checked against the supplied Form A
// and Form B scoring sheets on 2026-10-02; their 1–18 numbering is unchanged.
// Highlight coordinates use the 1920-wide (A) and 1792-wide (B) image previews.
// coordinateScale maps them to the full-resolution replacement PNGs.
export const REY_ELEMENTS = [
  { id: 1, label: "Kreuz außerhalb links oben", path: "M111 55V664 M53 107H167 M111 360H201", marker: [111, 210] },
  { id: 2, label: "Großes Rechteck", path: "M201 281H1383V989H201Z", marker: [1300, 989] },
  { id: 3, label: "Diagonalkreuz im großen Rechteck", path: "M201 281L1383 989 M201 989L1383 281", marker: [680, 706] },
  { id: 4, label: "Horizontale Mittellinie", path: "M201 632H1383", marker: [990, 632] },
  { id: 5, label: "Vertikale Mittellinie", path: "M792 281V989", marker: [792, 865] },
  { id: 6, label: "Kleines Rechteck links mit Diagonalen", path: "M201 456H487V806H201Z M201 456L487 806 M201 806L487 456", marker: [440, 760] },
  { id: 7, label: "Kurze Linie über dem kleinen Rechteck", path: "M201 431H445", marker: [245, 431] },
  { id: 8, label: "Vier parallele Linien links oben", path: "M313 348H792 M436 415H792 M547 481H792 M647 547H792", marker: [690, 415] },
  { id: 9, label: "Dreieck oberhalb des Rechtecks", path: "M792 281V56L1383 281Z", marker: [1003, 150] },
  { id: 10, label: "Kurze Vertikale unter dem oberen Dreieck", path: "M937 281V546", marker: [937, 440] },
  { id: 11, label: "Kreis mit drei Punkten", path: "M1269 535a83 82 0 1 0-166 0a83 82 0 1 0 166 0", detailPath: "M1148 513h1 M1214 513h1 M1183 562h1", detailStrokeWidth: 28, marker: [1320, 520] },
  { id: 12, label: "Fünf Querstriche rechts unten", path: "M908 763L964 680 M990 813L1045 730 M1059 853L1111 769 M1130 896L1186 813 M1207 937L1262 860", marker: [1065, 920] },
  { id: 13, label: "Dreieck rechts außen", path: "M1383 281L1831 634L1383 989", marker: [1665, 504] },
  { id: 14, label: "Raute an der rechten Spitze", path: "M1831 634L1874 761L1829 840L1791 761Z", marker: [1823, 895] },
  { id: 15, label: "Vertikale im rechten Dreieck", path: "M1531 399V874", marker: [1531, 814] },
  { id: 16, label: "Horizontale im rechten Dreieck", path: "M1383 634H1831", marker: [1643, 634] },
  { id: 17, label: "Kreuz unter dem großen Rechteck", path: "M792 989V1120 M520 1120H1195 M1126 1058V1190", marker: [982, 1120] },
  { id: 18, label: "Quadrat links unten mit Diagonale", path: "M201 989V1260H520V989 M201 989L520 1260", marker: [260, 1208] },
];

// Taylor numbering follows the author's scoring form (first page):
// https://www.meyersneuropsychological.com/downloads/TaylorComplexFigureTestScoringForm.pdf
// The supplied Form B sheet confirms this same ordering.
export const TAYLOR_ELEMENTS = [
  { id: 1, label: "Pfeil links außen", path: "M107 1002V456 M88 473L107 436L126 473Z", marker: [107, 585] },
  { id: 2, label: "Großes Dreieck links", path: "M468 264L107 720L468 1200", marker: [290, 494] },
  { id: 3, label: "Großes Quadrat", path: "M468 264H1543V1200H468Z", marker: [1330, 1200] },
  { id: 4, label: "Horizontale Mittellinie", path: "M107 720H1543", marker: [380, 720] },
  { id: 5, label: "Vertikale Mittellinie", path: "M1002 264V1200", marker: [1002, 1015] },
  { id: 6, label: "Horizontale Linie in der oberen Hälfte", path: "M468 490H1543", marker: [1154, 490] },
  { id: 7, label: "Diagonalkreuz links oben", path: "M468 264L1002 720 M468 720L1002 264", marker: [535, 652] },
  { id: 8, label: "Kleines Quadrat links oben", path: "M599 372H861V603H599Z", marker: [835, 372] },
  { id: 9, label: "Kreis links oben", path: "M814 492a85 83 0 1 0-170 0a85 83 0 1 0 170 0", marker: [729, 410] },
  { id: 10, label: "Rechteck oberhalb links", path: "M468 264V104H1002V264", marker: [735, 104] },
  { id: 11, label: "Diagonaler Pfeil rechts oben", path: "M1002 720L1714 114 M1693 106L1734 98L1717 136Z", marker: [1467, 325] },
  { id: 12, label: "Halbkreis rechts außen", path: "M1543 490C1704 499 1704 919 1543 947", marker: [1660, 720] },
  { id: 13, label: "Dreieck rechts mit vertikaler Linie", path: "M1543 490L1283 720L1543 947 M1436 583V853", marker: [1436, 815] },
  { id: 14, label: "Reihe aus sieben Punkten", path: "M1075 801h1 M1145 862h1 M1205 911h1 M1275 968h1 M1331 1019h1 M1399 1077h1 M1468 1133h1", marker: [1287, 1070], strokeWidth: 40 },
  { id: 15, label: "Horizontale Linie zwischen 6. und 7. Punkt", path: "M1002 1103H1543", marker: [1137, 1103] },
  { id: 16, label: "Dreieck unterhalb rechts", path: "M1543 1200L1399 1362L1673 1367Z", marker: [1543, 1357] },
  { id: 17, label: "Geschwungene Linie mit drei Querstrichen", path: "M468 1200C535 1175 505 1070 566 1040C620 1016 750 1048 777 999C806 961 777 859 815 828C880 789 966 820 1002 720 M538 1005L602 1063 M739 968L803 1025 M784 805L847 861", marker: [652, 1028] },
  { id: 18, label: "Stern links unten", path: "M890 1054L887 1166 M833 1106L945 1113 M851 1074L928 1148 M847 1148L928 1074", marker: [862, 1200] },
];

export const REY_VERSIONS = [
  { id: "1", elements: REY_ELEMENTS, image: "/material/rey-osterrieth-v1.png", width: 2592, height: 1770, viewBox: "0 0 2592 1770", cropHeight: 1770, markerScale: 3, coordinateScale: 2592 / 1920 },
  { id: "2", elements: TAYLOR_ELEMENTS, image: "/material/rey-taylor-v2.png", width: 2420, height: 1898, viewBox: "0 0 2420 1898", cropHeight: 1898, markerScale: 3, coordinateScale: 2420 / 1792 },
];

export function getReyVersion(data) {
  return REY_VERSIONS.find(({ id }) => id === data?.version) || REY_VERSIONS[0];
}

// Keep the active draft at the original flat keys for compatibility with v1.
// Store inactive drafts separately; switching must never carry points across figures.
export function switchReyVersion(data = {}, version, aborted) {
  const currentVersion = getReyVersion(data).id;
  const versions = { ...data.versions };
  if (data.version || getReySummary(data).scoredCount || data.notes || data.duration_s != null || aborted) {
    versions[currentVersion] = { scores: data.scores || {}, notes: data.notes || "", duration_s: data.duration_s ?? null, aborted: aborted || null };
  }
  const nextVersion = getReyVersion({ version }).id;
  const next = versions[nextVersion] || {};
  return {
    data: { version: nextVersion, scores: next.scores || {}, notes: next.notes || "", duration_s: next.duration_s ?? null, versions },
    aborted: next.aborted || null,
  };
}

export const REY_SCORE_OPTIONS = [
  { value: 0, label: "0", description: "Fehlt oder ist nicht erkennbar" },
  { value: 0.5, label: "0,5", description: "Verzerrt / unvollständig, erkennbar und falsch platziert" },
  { value: 1, label: "1", description: "Korrekt, aber falsch platziert; oder verzerrt / unvollständig, erkennbar und richtig platziert" },
  { value: 2, label: "2", description: "Korrekt und richtig platziert" },
];

export function getReyElementScore(data, id) {
  const value = data?.scores?.[id];
  return REY_SCORE_OPTIONS.some((option) => option.value === value) ? value : null;
}

export function getReySummary(data) {
  const elements = getReyVersion(data).elements;
  const scores = elements.map((element) => getReyElementScore(data, element.id));
  const scoredCount = scores.filter((score) => score !== null).length;
  const subtotal = scores.reduce((sum, score) => sum + (score ?? 0), 0);
  const complete = scoredCount === elements.length;
  return { scoredCount, subtotal, complete, total: complete ? subtotal : null };
}

export function getReyExportFields(data, aborted) {
  const summary = getReySummary(data);
  const hasData = summary.scoredCount > 0 || data?.duration_s != null || !!data?.notes || !!aborted;
  const version = getReyVersion(data);
  return {
    rey_copy_version: hasData || data?.version ? version.id : "",
    rey_copy_scoring: hasData || data?.version ? "ROCFT_18_units_36_points" : "",
    ...Object.fromEntries(version.elements.map(({ id }) => [`rey_copy_element_${id}`, getReyElementScore(data, id)])),
    rey_copy_scored_count: hasData ? summary.scoredCount : null,
    rey_copy_subtotal: summary.scoredCount > 0 ? summary.subtotal : null,
    rey_copy_total: summary.total,
    rey_copy_completed: hasData ? Number(summary.complete && !aborted) : null,
    rey_copy_duration_s: data?.duration_s ?? null,
    rey_copy_notes: data?.notes || "",
    rey_copy_aborted: aborted ? 1 : 0,
    rey_copy_abort_reason: aborted?.reason || "",
    rey_copy_abort_note: aborted?.note || "",
  };
}
