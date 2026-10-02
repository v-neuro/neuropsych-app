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
- Auth-Gate mit Passwort-Hash (SHA-256) und optionaler „Angemeldet bleiben“-Flag
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

Die Browser-Regressionschecks benötigen Node.js 22+ und Chrome/Chromium mit aktiviertem Remote-Debugging. Vite mit `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort` starten. Chrome/Chromium separat mit einem temporären Profil und `--headless=new --remote-debugging-address=127.0.0.1 --remote-debugging-port=9227 --user-data-dir=<temporärer Profilordner>` starten. Danach `node tests/session-safety.browser.mjs` ausführen. Abweichende URLs können über `NPT_APP_URL` und `NPT_CDP_URL` gesetzt werden. Der Test verwendet einen eigenen Browser-Kontext mit Testdaten und schließt diesen anschließend.

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
