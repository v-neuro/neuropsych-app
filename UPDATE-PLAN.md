# Update-Folge für Digitale NPT

Stand: **24.10.2026**. Ausgangscommit: `9dea321`. Status: geprüfter Umsetzungsplan; die Paket- und Laufzeitupdates wurden noch nicht ausgeführt.

Ziel sind die neuesten stabil veröffentlichten direkten Pakete und **Node 26.12.1 / npm 12.2.1**. Die Node-/Peer-Anforderungen aller 15 direkten Zielpakete sowie von npm wurden gegen Node 26.12.1 und untereinander geprüft: keine Konflikte und keine fehlenden erforderlichen direkten Peers. Das belegt die installierbare Versionskombination, noch keine getestete App-Funktion.

Node 26 ist am Prüfdatum „Current“, Node 24.22.1 die neueste LTS-Version. Der Plan verwendet entsprechend dem Wunsch nach der neuesten Version Node 26.12.1. Node 24.22.1 eignet sich zusätzlich als LTS-Prüfumgebung. [Node-Releases](https://nodejs.org/en/about/previous-releases)

## Zielstände

| Komponente | Ausgangsstand | Ziel |
| --- | --- | --- |
| Node | Shell 22.18.0; Projektvorgabe 22.23.4 | 26.12.1 |
| npm | Shell 10.9.3 | 12.2.1 |
| react / react-dom | 19.2.3 | beide 19.3.1 |
| @types/react | 19.2.7 | 19.3.0 |
| @types/react-dom | 19.2.3 | 19.3.0 |
| tailwindcss / @tailwindcss/postcss | 4.1.18 | beide 4.3.3 |
| autoprefixer | 10.4.22 | 10.6.1 |
| postcss | 8.5.31 | 8.5.31, bereits aktuell |
| eslint-plugin-react-hooks | 7.0.1 | 7.1.1 |
| eslint-plugin-react-refresh | 0.4.24 | 0.5.7 |
| globals | 16.5.0 | 17.13.0 |
| eslint | 9.39.1 | 10.13.0 |
| @eslint/js | 9.39.1 | 10.0.1 |
| vite | 7.3.7 | 8.3.5 |
| @vitejs/plugin-react | 5.1.2 | 6.1.2 |

Versionsquelle: aktuelle `/latest`-Metadaten der [npm-Registry](https://registry.npmjs.org/), einschließlich `engines`, `peerDependencies` und optionaler Peers. Vor späterer Umsetzung die Zielstände erneut prüfen; während eines Durchlaufs feste Versionen verwenden.

## Ablauf und Prüfpunkte

Jede Stufe erhält einen eigenen Commit mit Code, Konfiguration und zugehörigem Lockfile. Erst nach erfolgreichen Prüfungen folgt die nächste Stufe. Keine Installation mit `--force` oder `--legacy-peer-deps`, kein Löschen des Lockfiles. Installationsskripte zunächst mit `--ignore-scripts` unterdrücken; tatsächlich notwendige native Initialisierung separat prüfen.

### 0. Ausgangszustand und Vergleichsdaten sichern

- Auf einem eigenen Update-Branch beginnen; vorhandene Änderungen erhalten.
- Mit dem bereits korrigierten Node 22.23.4 den unveränderten Lockfile-Stand über `npm ci` reproduzieren und `npm test`, `npm run lint`, `npm run build` ausführen. Die bisherigen 48 Unit-Tests bilden die Ausgangsbasis; zusätzliche sinnvolle Regressionstests dürfen diese Zahl erhöhen.
- Den tatsächlich gebauten alten `dist/`-Stand außerhalb des Repositorys als Vergleichsrelease sichern. Vorhandene lokale Produktionsdateien nicht ungesichert überschreiben.
- Synthetisches vollständiges Backup und Referenzwerte für Scores, Nullwerte, fehlende Antworten, CSV, PDF, Timer, Zeichnungen und Testbatterie erzeugen. Keine echten Patientendaten verwenden.
- Browserumfang vor der Freigabe festhalten: insbesondere die tatsächlich eingesetzten iPads/Safari-Versionen. Die aktuelle Konfiguration legt kein ausdrückliches JavaScript-Buildziel fest.

### 1. Node und npm aktualisieren, App-Pakete zunächst beibehalten

- Node **26.12.1** über einen Versionsmanager parallel installieren und im Projekt aktivieren. Bei vorhandenem nvm: `nvm install 26.12.1`, anschließend `nvm use 26.12.1`.
- Danach npm **12.2.1** innerhalb dieser Node-Installation installieren. Kein ungeprüftes Ersetzen eines systemweit von anderen Projekten verwendeten Node.
- Tatsächliche Auflösung mit `node --version`, `npm --version`, `command -v node` und `command -v npm` im VS-Code-Terminal kontrollieren. Die temporäre Testlaufzeit allein ersetzt die bisherige Shell-Laufzeit nicht.
- `.nvmrc` auf 26.12.1 setzen und `packageManager: "npm@12.2.1"` dokumentieren. `engines`, `scripts/check-node.mjs`, dessen Grenztests und README konsistent halten. Weitere Node-Linien nur als unterstützt ausweisen, wenn sie mit dem Abschlussstand geprüft werden.
- Den unveränderten Paketstand frisch installieren und Unit-Tests, Lint, Build sowie einen Dev-/HMR-Smoke-Test ausführen. Native Tailwind-/CSS-/Bundler-Bindings müssen unter Node 26 tatsächlich laden.

Warum zuerst: npm 12 verlangt eine neuere Node-Version als die aktuelle Shell 22.18.0. Node 26.12.1 erfüllt die Anforderungen aller direkten Zielpakete. [npm-Anforderungen](https://registry.npmjs.org/npm/latest)

### 2. React und seine Typdefinitionen gemeinsam aktualisieren

`react` und `react-dom` zusammen auf **19.3.1**, beide `@types/*` auf **19.3.0** bringen. Die Typdefinitionen haben einen eigenen Versionsverlauf; gleiche Patchnummern wie React sind nicht erforderlich.

Prüfung: Unit-Tests, Lint und Build; Browserabläufe für Eingaben, Formularzustände, Effekte/Persistenz, Sessionwechsel, Timer und Zeichnungen. Besonders Nullwerte, unvollständige Antworten und Wiederöffnung kontrollieren. Noch keine gleichzeitige Änderung an Tailwind oder dem Bundler.

### 3. CSS-Werkzeuge gemeinsam aktualisieren

`tailwindcss` und `@tailwindcss/postcss` zusammen auf **4.3.3**, `autoprefixer` auf **10.6.1** bringen. PostCSS bleibt bei **8.5.31**.

Prüfung: Lint/Build und betroffene Browserabläufe; zusätzlich visuell Desktop und iPad/Safari, Dark-/Light-Mode, Dialoge, responsive Testansichten, Canvas-Bedienung und Drucklayout vergleichen. Reine Scoretests erkennen CSS-Regressionsfehler nicht.

### 4. Lintplugins vor dem ESLint-Hauptversionswechsel vorbereiten

Unter ESLint 9 zunächst `eslint-plugin-react-hooks` **7.1.1**, `eslint-plugin-react-refresh` **0.5.7** und `globals` **17.13.0** installieren. Beide Plugin-Zielversionen erlauben ESLint 9 und 10; damit lassen sich Pluginänderungen vor dem ESLint-Wechsel prüfen.

`eslint.config.js` auf verfügbare Presets und Regeländerungen prüfen; Lint ausführen und reale Codeprobleme beheben. Neue Regeln nicht pauschal abschalten. Bei Änderungen an Effekten/Callbacks die jeweils betroffenen App-Regressionstests ausführen.

### 5. ESLint und seine Basiskonfiguration gemeinsam aktualisieren

`eslint` auf **10.13.0** und `@eslint/js` auf **10.0.1** bringen. Die gemeinsame Hauptversion 10 ist entscheidend; beide Pakete haben unterschiedliche aktuelle Nebenstände.

Die bestehende Flat Config prüfen, insbesondere geänderte Recommended-Regeln, JSX-Erkennung und Konfigurationsauflösung. VS-Code-ESLint-Integration ebenfalls mit der vorgesehenen Laufzeit kontrollieren. Lint muss ohne Peer-Konflikte und ohne neue ungeklärte Fehler durchlaufen; anschließend Unit-Tests und Build. [ESLint-Migrationshinweise](https://eslint.org/docs/latest/use/migrate-to-10.0.0)

### 6. Vite und React-Plugin gemeinsam migrieren

`vite` **8.3.5** und `@vitejs/plugin-react` **6.1.2** in einem Installationsschritt aktualisieren. Plugin 6 verlangt ausdrücklich Vite 8. Optionale Babel-/React-Compiler-Peers nur ergänzen, wenn die App entsprechende Funktionen verwendet.

Dieser Schritt erhält eine eigene Prüfung: Vite 8 verwendet Rolldown/Oxc statt der bisherigen Rollup-/esbuild-Werkzeuge. Besonders `pwa/vite-plugin.js` und `pwa/build-security.js` mit ihren `generateBundle`-, `writeBundle`- und HTML-Hooks kontrollieren. Ausgabe, dynamische Imports, öffentlich freigegebene Dateien, CSP, App-Version und alle Service-Worker-Prüfsummen müssen zu den tatsächlich geschriebenen Dateien passen.

Vite 8 hebt außerdem Standard-Browserziele an, unter anderem Safari 16.0 → 16.4. Die bisherige Browserunterstützung darf nicht unbemerkt eingeschränkt werden: benötigte Buildziele ausdrücklich festlegen und auf den vorgesehenen Geräten prüfen. Ein JavaScript-Buildziel allein garantiert keine CSS-/Web-API-Kompatibilität. [Vite-Migration](https://vite.dev/guide/migration)

Prüfung: Dev-Server/HMR, Produktionsbuild, Sicherheits-Browsersuite und vollständige PWA-Suite. Zusätzlich einen echten Wechsel vom in Stufe 0 gesicherten Altbuild zum neuen Build prüfen: mehrere offene Fenster, wartendes Update, Aktivierung nach Schließen, erneutes Offlineöffnen, identische Testdaten/Zeichnungen und funktionierende Exporte. Ein simulierter Versionswechsel nur innerhalb des neuen Builds reicht dafür nicht aus.

### 7. Transitive Auflösung bereinigen und Abschluss prüfen

- Verbleibende transitive Updates innerhalb der Anforderungen ihrer Elternpakete auflösen, Lockfile prüfen und nötigenfalls deduplizieren. Nach tatsächlichen Paket-/Codeänderungen relevante Prüfungen erneut ausführen.
- In einer frischen isolierten Installation mit Node 26.12.1 und npm 12.2.1 `npm ci`, `npm ls --all`, `npm test`, `npm run lint` und `npm run build` ausführen. Keine fehlenden/ungültigen Peers oder ungeklärten Engine-Warnungen akzeptieren.
- Alle neun vorhandenen Browser-Testdateien abschließend ausführen: `security`, `pwa`, `session-safety`, `cerad-figural`, `dcsr-zero`, `demographics-education`, `qolie31`, `rey-copy`, `performance` (`tests/*.browser.mjs`, mit lokaler Testserver-/Chrome-Konfiguration laut README).
- `npm audit` und `npm audit --omit=dev` wiederholen; neue Befunde bewerten und vor Freigabe lösen. Mit `npm outdated` bestätigen, dass alle direkten Pakete den vereinbarten aktuellen Zielständen entsprechen.
- `npm outdated --all` zusätzlich auswerten. Verbleibende ältere transitive Hauptversionen mit dem zuständigen Elternpaket begründen. Beispiel: das aktuelle React-Hooks-Lintplugin 7.1.1 verlangt weiterhin `@babel/core ^7.24.4`; dessen erzwungener Wechsel auf Babel 8 würde den geprüften Abhängigkeitsvertrag verletzen. Daher lässt sich eine vollständig leere globale Outdated-Liste nicht immer mit unterstützter Kompatibilität verbinden.
- Vor Freigabe auf einem physischen iPad/Safari Installation, Offlineöffnung, Apple-Pencil/Touch, Backup, Teilen und Drucken prüfen. Chrome-/CDP-Tests decken diese Gerätefunktionen nicht vollständig ab.
- Ergebnis mit tatsächlichen Versionsständen, Tests und Grenzen dokumentieren. Historische Sicherheitsnachweise nicht rückwirkend als Prüfung des neuen Stands umdeuten.

## Freigabe und Rückfall

Freigabe erst nach Abschluss der Prüfungen. Vor jedem größeren Wechsel einen getesteten Commit als Rückfallpunkt festhalten; Node-Version, Paketmanifest und Lockfile bilden dabei einen zusammengehörigen Stand. Bei Fehlern die betreffende Stufe korrigieren oder auf den vorherigen getesteten Stand zurückgehen, ohne Browserdaten zu löschen.

Bei späterer Bereitstellung ausschließlich den vollständigen neuen `dist/`-Stand atomar übernehmen. Bestehende PWA-Installationen nach Ende laufender Testungen vollständig schließen und aktivierte Buildkennung kontrollieren. Keine automatischen Neustarts während Assessments. Ein Rollback muss auch als vollständiger PWA-Release geprüft werden; Hosting-Dateien allein ersetzen vorhandene Offline-Caches nicht sofort.

Die App-Kompatibilität ist erst nach diesen Prüfungen nachgewiesen. Die derzeit konfliktfreie Versionsmatrix ist die Grundlage für diese gestufte Umsetzung.
