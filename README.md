# Digitale Neuropsychologie – Testbatterie (React/Vite)

Webbasierte, interne Test-Suite für neuropsychologische Verfahren (VLMT, DCS-R, Rey–Osterrieth-Kopie, CERAD-Module, RWT Wortflüssigkeit, TMT A/B, Stroop, Epi-Track, Grooved Pegboard, Uhrentest u. a.). Single-Page-App mit Tailwind-Styling; Hauptnavigation in `src/App.jsx`, wiederverwendbare Oberflächen in `src/components`.

## Kernfunktionen
- Single-Page-Navigation über internen `screen`-State (kein Router)
- Tests mit Stoppuhren, Erinnerungs-Timern, Abbruch-Modalen und Score-Eingaben
- Exporte: CSV (strukturierte Kennzahlen) und PDF (inkl. DCS-Zeichnungen)
- Persistenz: IndexedDB für Session-Daten (inkl. DCS-Canvas-Daten), LocalStorage für UI-Flags
- Ein bearbeitender Tab pro Browserprofil: Weitere Tabs warten, bevor Session-Daten geladen oder verändert werden. Nach dem Schließen des bearbeitenden Tabs ist „Erneut versuchen“ möglich. Voraussetzung: Browser mit Web Locks API und HTTPS (oder localhost für die Entwicklung).
- Dark-/Light-Mode Toggle
- Basisdaten-Card pro Session (Patienten-Initialen, Geschlecht, Neuropsycholog:in-Initialen)
- Lokales Passwortfenster mit SHA-256 und optionaler „Angemeldet bleiben“-Flag; im Browser umgehbar, daher kein Schutz für Testdaten oder öffentliches Hosting
- Robots/Meta-Tags, um Indexierung und AI-Crawling zu unterbinden

## Wichtige Dateien
- `src/App.jsx` – Hauptkomponente mit allen Screens und Logik
- `src/components/*` – UI-Bausteine (Timer, DrawPad, ErrorBoundary, Abbruch-Button etc.)
- `src/lib/persist.js` – IndexedDB-Helper, CSV-Helfer
- `src/components/rey-copy.jsx` – ROCFT-Versionen 1 und 2: Versionswahl, interaktive Referenz, Elementnavigation unter der Figur und kompakte Bewertung; Bewertungshilfe über die volle Breite
- `src/lib/rey-scoring.js` – Figurzuordnung für beide Versionen, gemeinsame Bewertung (18 Elemente, 0–36), Vollständigkeit und identische Exportfelder mit Versionskennzeichnung; offene Bewertungen bleiben leer, ohne Normumrechnung
- `src/components/qolie31.jsx` – QOLIE-31 unter „Fragebögen“: deutsche Fragen, automatische Entwurfsspeicherung, sieben Subskalen, gewichteter Gesamtscore und separates Gesundheitsthermometer
- `src/lib/qolie31-content.js` – Deutsche Originaltexte und explizite Zuordnung der zehn Frageblöcke zu den kanonischen Items 1–31
- `src/lib/qolie31-scoring.js` – Gemeinsame, rein funktionale QOLIE-31-Berechnung und Exportfelder mit Antwortcodes, transformierten Scores, Vollständigkeit und Scoringversion
- `src/index.css` – Tailwind + Dark-Mode-Overrides
- `tests/session-safety.browser.mjs` – Browser-Regressionschecks für Tab-Sperre, Session-Wechsel und Grooved-Pegboard-Abbruch
- `tests/rey-scoring.test.mjs` – Rohwert- und Exportprüfungen: `node --test tests/rey-scoring.test.mjs`
- `tests/rey-copy.browser.mjs` – Browserchecks für Rey-Bewertung, Persistenz, Export, Abbruch, Testbatterie und Session-Wechsel; verwendet dieselben Vite-/Chrome-Adressen wie die Session-Safety-Checks

## Sicherheitsstand und Entwicklungslaufzeit

Die Sicherheitsprüfung vom 24.10.2026 mit Befunden, Quellen, Versionsänderungen und noch erforderlichen Hosting-Schritten steht in [SECURITY-REVIEW.md](SECURITY-REVIEW.md). Die Änderungen wurden lokal getestet; eine produktive Bereitstellung wurde nicht vorgenommen.

Für Entwicklung und Build die geprüfte Node-Version aus `.nvmrc` verwenden: `nvm install` und `nvm use`, dann `npm ci`, `npm test`, `npm run lint` und `npm run build`. Alternativ sind korrigierte Releases der Linien 24 ab 24.22.1 und 26 ab 26.12.1 zugelassen. Installations-, Entwicklungs-, Build- und Preview-Befehle prüfen die Laufzeit. Für die Produktion ausschließlich den Inhalt von `dist/` verwenden; Vite dient der lokalen Entwicklung bzw. Vorschau.

Produktionsbuilds enthalten eine Content Security Policy ohne Inline-JavaScript und ohne externe Netzwerkquellen. Die Inline-Stile der Oberfläche bleiben erlaubt. HTTP-Sicherheitsheader, HTTPS und tatsächlichen Zugriffsschutz muss das Hosting zusätzlich setzen; [deploy/nginx-security.conf.example](deploy/nginx-security.conf.example) enthält eine anzupassende Vorlage. Sie wurde nicht auf dem produktiven Webserver geprüft. Eine eigene vertrauenswürdige Origin und geschützte Geräte/Browserprofile sind erforderlich: Passwortfenster und Robots-Regeln verhindern weder den Zugriff auf lokale Browserdaten noch auf Offline-Kopien. Backups, CSV und PDF enthalten unverschlüsselte Testdaten und gehören in geschützte Ablagen.

Der Build veröffentlicht aus `public/` nur die zugelassenen App-Ressourcen und bricht bei unerwarteten Dateien oder symbolischen Links ab. Finder-Metadaten werden ausgelassen. Backups und Konfigurationsdateien nie dort ablegen. CSV-Text, der als Tabellenformel interpretiert werden könnte, erhält ein führendes Apostroph; die interne Testung und numerische Scores bleiben unverändert. Beim Weiterverarbeiten als Text und beim erneuten Speichern in Tabellenprogrammen muss diese Kennzeichnung erhalten bleiben.

Sicherheitsregressionen: `npm test` und nach dem Build `node tests/security.browser.mjs` mit Chrome-Remote-Debugging wie unten beschrieben. Der Browsertest verwendet nur synthetische Daten auf einem temporären lokalen HTTP-Port und bestätigt auch die weiterhin bestehende Umgehbarkeit des lokalen Passwortfensters.

Die Browser-Regressionschecks benötigen Node.js 22+ und Chrome/Chromium mit aktiviertem Remote-Debugging. Vite mit `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort` starten. Chrome/Chromium separat mit einem temporären Profil und `--headless=new --remote-debugging-address=127.0.0.1 --remote-debugging-port=9227 --user-data-dir=<temporärer Profilordner>` starten. Danach `node tests/session-safety.browser.mjs` ausführen. Abweichende URLs können über `NPT_APP_URL` und `NPT_CDP_URL` gesetzt werden. Der Test verwendet einen eigenen Browser-Kontext mit Testdaten und schließt diesen anschließend.

## Installation auf dem iPad und Offlinebetrieb

Die Produktionsversion ist eine installierbare Progressive Web App. Auf dem iPad die bereitgestellte HTTPS-Adresse in Safari öffnen, „Teilen“ → „Zum Home-Bildschirm“ wählen, gegebenenfalls „Als Web-App öffnen“ aktivieren und „Hinzufügen“ antippen. Die installierte App einmal online öffnen und im unteren Bereich auf „Für Offlinebetrieb bereit“ warten. Anschließend lassen sich App und Testmaterialien ohne Internetverbindung öffnen. Eine Erstinstallation ohne Internetverbindung ist nicht möglich.

`npm run build` erzeugt automatisch eine versionierte `dist/sw.js` aus den tatsächlich gebauten JS-/CSS-Dateien, dem HTML, Manifest, Icons und sämtlichen Dateien in `public/material`. Ein Release wird nur dann für offline freigegeben, wenn alle Ressourcen erfolgreich gespeichert wurden. Der Cache enthält ausschließlich App-Ressourcen; Sessiondaten und Zeichnungen bleiben in der vorhandenen lokalen Speicherung, CSV/PDF werden weiter lokal erzeugt. Offlinebetrieb ändert die bestehenden Aufbewahrungsregeln und Timer nicht; Erinnerungen sind weiterhin an die geöffnete App gebunden.

Neue Versionen werden im Hintergrund heruntergeladen und warten, bis **alle** Fenster/Tabs dieser Anwendung geschlossen sind. Die App lädt sich während einer Testung nicht automatisch neu. Bei einem verfügbaren Update zeigt der untere App-Bereich den Hinweis zum Schließen und erneuten Öffnen nach der Testung. Fehlgeschlagene Updates behalten die bisherige Offlineversion. Beim Aktivieren werden nur ältere `npt-static-*`-Caches bereinigt.

Im unteren App-Bereich steht die **App-Version** als reproduzierbare Kennung des gebauten Quellstands. „Nach Updates suchen“ prüft ausdrücklich auf eine neue Version und zeigt den Stand bzw. Verbindungsfehler an. Die angezeigte Versionskennung gehört zum aktuell geöffneten App-Code; ein heruntergeladenes Update wird weiterhin erst nach dem Schließen aller Fenster aktiv.

„Für Offlinebetrieb bereit“ wird erst nach Prüfung sämtlicher Cache-Dateien anhand ihrer SHA-256-Prüfsummen angezeigt. Geprüft wird beim Start, erneut beim Zurückkehren in die App (mit Zeitabstand) und nach einer Update-Prüfung. Fehlende oder beschädigte Dateien lassen sich mit „Erneut herunterladen“ und bei wiederkehrender Internetverbindung reparieren. Die Reparatur akzeptiert ausschließlich Dateien des aktuell geöffneten Releases. Ist nur noch eine neuere Version auf dem Server verfügbar, diese über „Nach Updates suchen“ herunterladen und nach der Testung alle Fenster schließen. Einmal pro App-Start wird außerdem, soweit unterstützt, dauerhafter Gerätespeicher angefragt; die Oberfläche zeigt an, ob die Anfrage gewährt wurde oder der Browser den Speicher weiter verwaltet.

Im installierten App-Modus öffnet „PDF Export“ eine Vorschau innerhalb der App. „Drucken / Als PDF sichern“ öffnet den Druckdialog; „Zurück zur Testung“ schließt die Vorschau und führt ohne Neuladen zur bisherigen Testansicht zurück. Die Navigation wird nicht mitgedruckt. Im normalen Browser bleibt die separate Druckansicht erhalten.

„CSV Export“ bleibt im installierten App-Modus ebenfalls innerhalb der App. „CSV teilen / In Dateien sichern“ übergibt die Datei an das native Teilen-Menü, wo „In Dateien sichern“ gewählt werden kann. Teilen-Abbruch oder Fehler lassen die Vorschau geöffnet. Falls Dateifreigabe nicht unterstützt wird, lässt sich der CSV-Inhalt kopieren bzw. auswählen. „Zurück zur Testung“ führt zur bisherigen Ansicht zurück. Im normalen Browser bleibt der bisherige CSV-Download erhalten.

### Vollständige Backups

Die Schaltfläche „Backup“ im unteren App-Bereich, rechts neben „Testungsaufbau für Fragestellungen“, öffnet ein Pop-up mit „Backup erstellen“ und „Backup laden“.

„Backup erstellen“ sichert die aktuelle Testung mit Rohdaten, Notizen, Zeichnungen einschließlich unbewerteter Skizzen und Galerien, aktueller Ansicht, Erinnerungen und Testbatterie-Fortschritt. Vor der Sicherung werden offene Zeichnungs-Encodes und Speicherzugriffe abgeschlossen. Laufende Stoppuhren/Kurzzeitmessungen müssen vorher beendet werden; globale Abruf-Erinnerungen werden mit ihren ursprünglichen Fristen gesichert und laufen zeitlich weiter.

Im Browser wird eine `.npt-backup.json`-Datei heruntergeladen. In der installierten App wird die vorbereitete Datei über „Backup teilen / In Dateien sichern“ an das native Teilen-Menü übergeben. Unterstützt das Gerät keine JSON-Dateifreigabe, wird derselbe Inhalt als `.npt-backup.txt` angeboten; ohne Dateifreigabe ist Kopieren möglich. Beide Dateitypen können wieder geladen werden. Die Dateien enthalten das vollständige lokale Assessment und werden nicht an einen Server gesendet.

„Backup laden“ prüft Dateiformat, unterstützte Schemaversion, Inhalt, Zeichnungsverweise und die Prüfsumme, bevor die Wiederherstellung angeboten wird. Initialen, Sicherungszeit und Zeichnungsanzahl werden vor der ausdrücklichen Auswahl „Backup wiederherstellen“ angezeigt. Diese ersetzt die aktuelle Testung und öffnet die gesicherte Ansicht neu. Sessiondaten und Zeichnungen werden gemeinsam in einer IndexedDB-Transaktion geschrieben; bei Fehlern bleibt die bisherige Testung erhalten. Die ursprüngliche Testungskennung bleibt bestehen. Das lokale Anmeldekennwort und Anmelde-Flags gehören nicht zum Backup. Die Prüfsumme erkennt Beschädigungen, ist jedoch keine Verschlüsselung.

Tests: `node --test tests/assessment-backup.test.mjs tests/session-persistence.test.mjs tests/timer-clock.test.mjs` und nach `npm run build` die Browserprüfung `node tests/pwa.browser.mjs`. Sie prüft zusätzlich Versionsanzeige/Update-Schaltfläche, beschädigte und fehlende Cache-Dateien, Reparatur ohne Versionsmischung, Speicheranfrage mit Gewährung/Ablehnung, vollständigen Backup-Roundtrip sowie ungültige Dateien und zurückgerollte Schreibfehler.

Hosting: den vollständigen Inhalt von `dist/` unter der Domainwurzel per HTTPS bereitstellen; localhost ist für Tests ebenfalls zulässig. `sw.js` und `index.html` ohne langfristigen HTTP-Cache ausliefern (z. B. `Cache-Control: no-cache`), Manifest als `application/manifest+json`. Alle Dateien eines Releases gemeinsam bereitstellen. Der Vite-Entwicklungsserver registriert keinen Service Worker; für eine lokale Produktionsvorschau einen separaten Port verwenden: `npm run preview -- --host 127.0.0.1 --port 5180`.

Prüfung: Nach `npm run build` den Browser wie oben mit Remote-Debugging starten, dann `node tests/pwa.browser.mjs` (abweichende Debugging-Adresse über `NPT_CDP_URL`). Der Test startet einen eigenen lokalen Server und verwendet isolierte synthetische Daten. Er prüft Installation/Downloadfehler, vollständige Offline-Ressourcen, erneutes Öffnen ohne Netzwerk, Zeichnen/Scoring, CSV/PDF-Erzeugung und Updates mit mehreren Fenstern einschließlich Erhalt der Sessiondaten/Zeichnungen. Installation über Safari, Apple Pencil und das iPad-Druck-/Teilen-Menü zusätzlich auf einem physischen iPad prüfen.

## Performance und Speicherung

VLMT, DCS-R und die vier Spannen-Tests verwenden stabile Speicher-Callbacks, damit unveränderte Eingaben keine Render-/Speicherschleifen auslösen. Stoppuhren und Countdowns besitzen nur während des Laufens ein Intervall; abgelaufene Erinnerungen beenden ihr Intervall, laufende Erinnerungen aktualisieren ihre Sekundenanzeige einmal pro Sekunde.

`src/lib/session-persistence.js` erhält den sofortigen LocalStorage-Recovery-Backup bei tatsächlichen Änderungen. Debounce und Lifecycle-Flush verwenden denselben Snapshot und vermeiden doppelte Serialisierung und Schreibvorgänge. IndexedDB-Schreibvorgänge sind geordnet und nach Fehlern erneut möglich; das gespeicherte Schema bleibt unverändert.

Der DrawPad verwendet Punktlisten für neue Striche und einen Rasterhintergrund für wiedergeöffnete Zeichnungen. Undo benötigt keine vollständigen PNG-Snapshots pro Strich. PNG-Blobs für Speicherung und Export bleiben unverändert kompatibel; überholte asynchrone Encodes können neuere Zeichnungen nicht überschreiben. Pointer Capture und skalierte Koordinaten unterstützen Touch/Stift und schmale Bildschirmbreiten.

Tests: `node --test tests/session-persistence.test.mjs` und `node tests/performance.browser.mjs` (dieselbe Browser-Konfiguration wie oben, ausschließlich synthetische Daten). Für die Produktionsversion `npm run build`, `npm run preview -- --host 127.0.0.1 --port 5180` und `NPT_APP_URL=http://127.0.0.1:5180 node tests/performance.browser.mjs` verwenden. Geprüft werden alle sechs betroffenen Screens, echte Eingaben, Idle-Intervalle, Lifecycle-Speicherung, Undo, Wiederöffnung, asynchrone Encode-Reihenfolge, Touch, mobile Zeichnungskoordinaten und DCS-R-Galerien.

Die 60-Sekunden-Countdowns berechnen Restzeit aus einer festen Deadline statt aus der Anzahl der Updates; Pause und Fortsetzung berücksichtigen die tatsächlichen Klickzeitpunkte. Stoppuhren berechnen die verstrichene Zeit aus Zeitstempeln und prüfen Zeitlimits auch beim manuellen bzw. programmgesteuerten Stoppen. `useClockRefresh` pausiert Anzeige-Updates bei ausgeblendeter Seite und synchronisiert bei Sichtbarkeit, Fokus oder Wiederherstellung sofort neu. Bei vollständig suspendiertem Browser können Anzeige und Abbruchhinweis erst nach der Rückkehr aktualisiert werden; die Zeitberechnung holt dann auf. Start/Reset, vorhandene Zeitlimits und Exportformate bleiben erhalten. Tests: `node --test tests/timer-clock.test.mjs` und `node tests/performance.browser.mjs` mit simulierten Update-Ausfällen.

## QOLIE-31

QOLIE-31 ist zusätzlich im Testungsaufbau der vollständigen Epileptologie-Batterie direkt verfügbar und wird in deren digitalem Ablauf nach GAD-7 gestartet. „Fertig“ schließt diesen letzten Batterieschritt ab; Antworten bleiben wie beim Einzelstart gespeichert. Die übrigen Batteriezusammenstellungen bleiben unverändert.

Quellen: bereitgestellter deutscher Fragebogen „10 QOLIE-31.pdf“ (MAPI-Übersetzung, 1997) und „qolie31_scoring.pdf“, QOLIE-31 Scoring Manual, Version 1.0 (RAND, 1993), Tabellen 2 und 4. Die Originaltexte bleiben in `QOLIE31_BLOCKS` als Referenz erhalten. Die Oberfläche verwendet auf Wunsch eine kompakte Untersucheransicht mit kurzen Überschriften und Itemtexten, unveränderten Zeiträumen und Antwortcodes sowie gemeinsamen Antwortbeschriftungen über einzeiligen Zahlenfeldern. Lange Zahlenreihen bleiben auf kleinen Bildschirmen horizontal scrollbar. Die Patienteneinleitung und der Quellenfooter werden nicht angezeigt. Deutsche Blocknummern sind ausschließlich Präsentationsnummern; gespeichert und ausgewertet werden die kanonischen Einzelitems 1–31.

Das Gesundheitsthermometer (deutscher Block 10, kanonisches Item 31) wird über einen Slider von 0 bis 100 in 10er-Schritten erfasst. Die Ausgangsposition ist 0, aber ohne Auswahl bleibt die Antwort fehlend; Fokussieren allein speichert keine Antwort. Eine ausdrückliche Auswahl der Ausgangsposition speichert eine gültige 0. Bereits gespeicherte gültige Zwischenwerte bleiben beim Wiederöffnen unverändert und werden erst durch eine neue Auswahl ersetzt. Die zugrunde liegende Validierung akzeptiert weiterhin vorhandene Gesundheitsratings im Bereich 0–100. Die Untersucheransicht verzichtet auf den Erläuterungs-Dropdown und die zusätzliche Gesamt-Vollständigkeitsbox; Teilberechnungen und Antwortzahlen pro Subskala sowie Export-Vollständigkeit bleiben erhalten.

Gespeicherte Datensätze verwenden `qolie31.responses` mit numerischen Antwortcodes sowie `entry_mode: "items"` und `scoring_version: "QOLIE31_v1.0_DE_MAPI1997"`. Fehlende Antworten sind `null` bzw. nicht gesetzt; 0 ist für Items 1 und 31 eine gültige Antwort. Transformierte Werte und Ergebnisse werden aus den Rohantworten berechnet, nicht als unabhängig veränderbarer Gesamtscore gespeichert. Ungültige Antworten werden als Validierungsfehler angezeigt, betroffene Subskalen nicht berechnet; unbekannte Scoringversionen werden nicht stillschweigend neu interpretiert.

Subskalen verwenden nur tatsächlich beantwortete Items als Nenner. Vierstufige Items verwenden exakt 33,3 und 66,7. Der Gesamtscore wird aus ungerundeten Subskalen mit den Manualgewichten berechnet. **Anwendungsregel:** Fehlt eine ganze Subskala, bleibt der Gesamtscore nicht verfügbar; keine Umverteilung der Gewichte. Teilberechnungen werden gekennzeichnet. Der separate allgemeine Gesundheitszustand (Item 31) beeinflusst keinen Lebensqualitätsscore. Vollständigkeit der 30 bewerteten Items und Beantwortung des Thermometers werden getrennt dokumentiert. Wie bei den bisherigen Fragebögen können unvollständige Entwürfe gespeichert und mit „Fertig“ verlassen werden; ungültige Antworten müssen zuvor korrigiert werden. Keine T-Scores, Grenzwerte oder Schweregradkategorien.

CSV- und PDF-Export verwenden dieselbe Berechnung wie die Oberfläche. Alle `qolie31_*`-Spalten werden nach den bisherigen Spalten einschließlich ROCFT angehängt. Enthalten sind Rohantworten, transformierte Itemwerte (ohne Item 31), sieben Subskalen mit Antwortzahlen/Vollständigkeit, gewichteter Gesamtscore, separates Thermometer, Scoringversion, Anwendungsregel, Validierungsfehler, Notizen und Abbruchstatus. Die Oberfläche rundet auf eine Dezimalstelle; der Export behält die Rechengenauigkeit.

Scoringtests: `node --test tests/qolie31-scoring.test.mjs`. Browserchecks: `node tests/qolie31.browser.mjs` mit der oben beschriebenen Vite-/Chrome-Konfiguration; geprüft werden Formulare, Tastaturbedienung, mobile Darstellung, Speicherung/Wiederöffnung, Teilantworten, Validierung, Abbruch, Testbatterie, Sessionwechsel und CSV/PDF.

## Impressum
Betreiber*in: AG Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum  
Anschrift: In der Schornau 23-25, 44892 Bochum  
Kontakt: Tel: 0234-299-0, E-Mail: neuropsychologie.bochum@knappschaft-kliniken.de  
Zweck: interne, nicht-kommerzielle Nutzung für neuropsychologische Testung  
Umsatzsteuer-ID: DE 815 447 053  
Haftungsausschluss: Keine Haftung für externe Links; Anwendung ersetzt keine ärztliche Aufklärung/Dokumentationspflichten.  
Urheberrecht: Inhalte/Layout geschützt; Rechte der neuropsychologischen Verfahren verbleiben bei den Rechteinhabern.
