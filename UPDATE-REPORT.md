# Paket- und Laufzeitupdate – Digitale NPT

Datum: **24.10.2026**. Ausgangscommit: `9dea321`; Arbeitsbranch: `updates/all-packages-2026-10-24`. Status: **lokal umgesetzt und vollständig automatisiert geprüft**; physische iPad-Prüfung vor produktiver Freigabe offen.

## Umgesetzter Stand

Alle 15 direkten Pakete wurden mit den aktuellen stabilen Registry-Versionen abgeglichen. Die Zielstände der [Update-Folge](UPDATE-PLAN.md#zielstände) sind installiert: insbesondere React/ReactDOM 19.3.1, Tailwind 4.3.3, ESLint 10.13.0 samt @eslint/js 10.0.1 sowie Vite 8.3.5 mit React-Plugin 6.1.2. PostCSS 8.5.31 war bereits aktuell. Geänderte direkte Pakete sind exakt gepinnt, das Lockfile enthält die konkrete transitive Auflösung.

Node **26.12.1** wurde über das vorhandene nvm parallel installiert und als nvm-Standard eingerichtet; npm **12.2.1** gehört zu dieser Node-Installation. Node 22 wurde nicht entfernt. `.nvmrc`, `packageManager`, `engines`, `.npmrc` und `scripts/check-node.mjs` sind auf den geprüften Node-26-/npm-12-Stand abgestimmt. Die unveränderten App-Pakete wurden zunächst separat unter Node 26 geprüft, bevor weitere Updates folgten.

Die bisherige Agent-Shell erbte weiterhin Node 22.18.0. Deshalb wurde zusätzlich eine auf **diesen Workspace beschränkte** Aktivierung seiner `.nvmrc` in der vorhandenen `~/.zprofile` ergänzt. Eine neue Login-Shell im Projekt liefert nachweislich Node 26.12.1 und npm 12.2.1 aus `~/.nvm/versions/node/v26.12.1/bin`. Ein bereits geöffnetes Terminal benötigt `nvm use` oder muss neu geöffnet werden. Das ursprüngliche Profil liegt lokal unter `/private/tmp/npt-all-updates-akkkgt1r/zprofile-before` als Backup; dieses persönliche Profil wurde nicht ins Repository übernommen.

Node 26 ist am Prüfdatum Current, nicht LTS. Die App benötigt produktiv weiterhin ausschließlich statisches HTTPS-Hosting. Zusätzliche Node-Hauptversionen sind für diesen Update-Stand nicht als getestet freigegeben. [Node-Releases](https://nodejs.org/en/about/previous-releases)

## Anpassungen für Kompatibilität

- Die neuen React-Lintregeln erkannten redundante Spiegelzustände bei Stroop und CERAD-Benennen. Die Oberfläche verwendet jetzt die bereits vorhandenen persistierten Zustände unmittelbar; Änderungen werden im Ereignishandler gespeichert. Scoreberechnungen und Exportfelder bleiben gleich. Zusätzliche Browsertests prüfen Fehler-/Korrektur-/Löschzyklen, Nullwerte, Notizen, Wiederöffnung und CSV-Werte.
- Die Abschlussrunde deckte zusätzlich eine verspätete Synchronisierung der Basisdaten per Animationsframe auf, die neue Eingaben nach Speichern/Wiederöffnen überschreiben konnte. Das Formular wird jetzt nach vollständiger Hydrierung für die jeweilige Bearbeitung und Session frisch initialisiert; der nachlaufende Reset entfällt. Ein Test hält alte Animationsframes gezielt zurück und bestätigt, dass ein neu geöffneter Entwurf erhalten bleibt. Der Test schlägt mit der vorherigen Implementierung nachweislich fehl. Eine neue Testung verwirft den ungespeicherten Entwurf der vorherigen Session.
- Die DCS-Abrufnavigation wird vor dem nächsten Render-/Persistenzdurchlauf angewendet. Ein Test wechselt über die echte Erinnerung vom bereits geöffneten Zeichenbildschirm zur Rekognition und kontrolliert den zuletzt vergebenen Score auch nach Reload.
- Die Vorbereitung einer teilbaren Backup-Datei wurde aus dem Memo-Callback in eine separate Funktion verlagert. Memoisierung und JSON-/Text-Fallback bleiben erhalten; die PWA-Suite prüft Teilen, Kopieren, Download und Wiederherstellung.
- Vite 8 verwendet Rolldown/Oxc. Beide eigenen Build-Plugins funktionieren mit dessen tatsächlicher Ausgabe; Dateifreigabe, CSP und Offline-Prüfsummen werden im Produktionsbuild geprüft. Die alten JavaScript-/CSS-Transformziele Chrome/Edge 107, Firefox 104 und Safari 16 bleiben ausdrücklich gesetzt. Das ist keine Zusicherung aller CSS-/Web-APIs auf diesen Browsern. [Vite-Migration](https://vite.dev/guide/migration)
- Ein neuer lokaler Browser-Teststarter startet und beendet Vite sowie bei Bedarf ein temporäres Chrome-Profil. Er akzeptiert nur Loopback-Adressen. Der Entwicklungstest prüft echte HMR-Änderungen ohne Dokument-/Assessmentverlust sowie Desktop-/iPad-Layout; ein zusätzlicher Scoretest deckt die oben angepassten Module ab.
- Der PWA-Test kann mit `NPT_BASELINE_DIST` einen echten alten Build installieren. Darin werden eine Zeichnung, Scores und ein vollständiges Backup erzeugt. Danach wird der tatsächliche neue Build angeboten, nach Schließen aller Fenster offline aktiviert und mit bytegenauer Zeichnungskontrolle sowie Import des alten Backups geprüft.

ESLint 10 und die aktualisierten Plugins laufen nach den Anpassungen ohne neue Regeldeaktivierungen. [ESLint-Migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0)

## Prüfungen

Es wurden ausschließlich synthetische Testdaten, isolierte Browserkontexte und lokale Testserver verwendet. Der alte Ausgangsbuild ist unter `/private/tmp/npt-all-updates-akkkgt1r/baseline-dist` gesichert. Stufenlogs liegen im selben lokalen Verzeichnis.

| Prüfung | Ergebnis |
| --- | --- |
| Ausgangsstand mit Node 22.23.4: frische Installation, 48 Unit-Tests, Lint, Build und PWA-Suite | Bestanden |
| Node 26 mit unveränderten App-Paketen: Installation, Unit-Tests, Lint, Build, HMR/Layout und Session-Safety | Bestanden |
| React-Stufe: Unit-Tests, Lint, Build, Eingaben/Persistenz, Rey, QOLIE, Timer/Zeichnungen und Sessions | Bestanden |
| CSS-Stufe: Unit-Tests, Lint, Build, Layout, Rey, Druck-/Backup-/PWA-Prüfungen einschließlich echtem Altbuild | Bestanden |
| Lintplugin-Stufe nach Korrekturen: Unit-Tests, Lint, Build, gezielte Scores/CSV, Performance/Persistenz und PWA | Bestanden |
| ESLint-10-Stufe: Unit-Tests, Lint und Build | Bestanden |
| Vite-8-Stufe: Unit-Tests, Lint, Build, HMR/Layout, Sicherheits- und PWA-Suite einschließlich echtem Altbuild | Bestanden |
| Abschluss: frische isolierte Installation, vollständiger Abhängigkeitsbaum, Unit-Tests, Lint und Build | Bestanden |
| Abschluss: alle elf Browser-Testdateien und zusätzlich acht App-Suites gegen den Produktionsbuild | Bestanden |
| Abschluss: aktuelle direkte/transitive Paketversionen, npm-Audits und OSV | Bestanden |
| Physisches iPad/Safari mit Apple Pencil, nativem Teilen-/Druckdialog | Nicht verfügbar; Geräteprüfung bleibt vor produktiver Freigabe erforderlich |

Der neue Browsertest musste vor Pointer-Ereignissen das fokussierte Fenster und das nach dem Scrollen fertig dargestellte Canvas abwarten. Ohne diese Voraussetzung wurden synthetische Zeichenaktionen vereinzelt vor dem aktualisierten Layout gesendet. Die Prüfungen wurden entsprechend präzisiert; es wurden keine Zeitgrenzen oder fachlichen Erwartungen der App gelockert.

Im Produktionsmodus zeigte sich außerdem, dass Chromes `Target.closeTarget` vor der tatsächlichen Freigabe des Web Lock zurückkehren kann. Der Session-Test wartet jetzt über `navigator.locks.query()` auf diese Freigabe, bevor er den nächsten Benutzer-Retry auslöst. Ein wirklich verbleibender Lock würde weiterhin zum Testfehler führen; die App-Sperrlogik wurde dafür nicht verändert.

Vite meldet beim Build einen Hauptchunk von ungefähr 524 kB minifiziert, gegenüber ungefähr 495 kB im Ausgangsbuild. Der Build ist erfolgreich; der Größenhinweis wird nicht unterdrückt. Weitere Aufteilung kann separat erfolgen. Browser- und Persistenzprüfungen bewerten das tatsächliche Verhalten.

Die aktuellen Paketstände, Scannergebnisse, verbleibenden indirekten Versionsbindungen und Testübersichten stehen in [update-evidence/2026-10-24.json](update-evidence/2026-10-24.json). Die Abschlussprüfung bestätigt: **keine veralteten direkten Pakete**, **keine ausstehenden kompatiblen transitiven Updates**, **keine npm-Audit-Befunde** (gesamt und Produktion), **keine OSV-Treffer unter 205 Lockfile-Paketen** und einen konsistenten Abhängigkeitsbaum. Der Service Worker aus der frischen isolierten Installation stimmt bytegenau mit dem Hauptbuild überein.

## Paketauflösung und Grenzen

Vier zusätzliche kompatible transitive Updates wurden übernommen: `@alloc/quick-lru` 5.3.0, `@eslint-community/eslint-utils` 4.10.1, `@jridgewell/sourcemap-codec` 1.6.0 und `detect-libc` 2.1.2.

Der npm-12-Trockenlauf für diese Auflösung scheiterte an einem bekannten Fehler bei gebündelten Registry-Paketen (`EALLOWREMOTE`, hier Tailwind-WASM). Statt die Download-Schutzvorgaben abzuschalten, wurden die Kandidaten anhand von `npm outdated --all` geprüft und anschließend mit dem regulären Update-Befehl installiert. Dieser funktionierte ohne Aufweichen von `allow-remote` oder der Installationsskript-Sperre. [npm-Issue #9800](https://github.com/npm/cli/issues/9800)

Indirekte Hauptversionen bleiben an die Anforderungen ihrer Elternpakete gebunden, etwa Babel 7 unter dem aktuellen React-Hooks-Lintplugin. Eine leere Liste direkter veralteter Pakete bedeutet daher nicht, dass jede transitive Bibliothek ihren weltweit neuesten Major verwendet. Es wurden keine inkompatiblen Overrides und keine Force-Updates gesetzt.

Die historischen Nachweise in `SECURITY-REVIEW.md` und `security-evidence/` bleiben als Dokumentation der vorherigen Prüfung erhalten. Das lokale Browser-Passwortfenster ist weiterhin keine belastbare Authentifizierung; Hosting- und Geräteschutz bleiben erforderlich. Dieses Paketupdate beseitigt diese Architekturgrenze nicht.

## Wiederholung und Übernahme

1. `nvm install`, `nvm use`; tatsächliche Versionen mit `node --version` und `npm --version` prüfen. npm 12.2.1 gehört in die ausgewählte nvm-Installation.
2. `npm ci --ignore-scripts`, `npm test`, `npm run lint`, `npm run build`, `npm ls --all`, `npm audit` und `npm audit --omit=dev` ausführen.
3. `npm run test:browser` führt alle Browser-Suites lokal aus. Nach dem Build `npm run test:browser -- --production controlled-scores session-safety cerad-figural dcsr-zero demographics-education qolie31 rey-copy performance` für die regulären App-Abläufe im Produktionsmodus verwenden. Sicherheits- und PWA-Suite bedienen ohnehin eigene Produktions-Testserver und müssen dafür nicht identisch wiederholt werden.
4. Einen gesicherten tatsächlichen Altbuild über `NPT_BASELINE_DIST=/absoluter/pfad/zum/alten/dist` für den PWA-Test setzen. Historische Builds nur lokal/isoliert für Regressionen verwenden. Für Screenshot-Artefakte optional `NPT_SCREENSHOT_DIR` setzen.
5. Nach erfolgreicher Geräteprüfung und Betreiberfreigabe den vollständigen neuen `dist/`-Stand atomar bereitstellen. Die Hosting-/Zugangsschutzprüfungen aus dem Sicherheitsbericht bleiben erforderlich. Es wurde hier kein Produktionsdeployment durchgeführt.

Bei Rückfall einen vollständigen getesteten Stufencommit mit zugehörigen Laufzeitvorgaben und Lockfile verwenden; danach dessen Node-/npm-Version aktivieren und frisch installieren. Die nvm-Standardwahl und die ergänzte persönliche Shell-Aktivierung sind außerhalb von Git und müssen bei Bedarf gesondert zurückgenommen werden. Keine IndexedDB-/LocalStorage-Daten löschen. Bei einer PWA-Rücknahme sämtliche Fenster erst nach Ende der Testung schließen und die danach tatsächlich aktivierte Buildkennung kontrollieren.
