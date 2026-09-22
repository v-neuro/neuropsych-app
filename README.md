# Digitale Neuropsychologie – Testbatterie (React/Vite)

Webbasierte, interne Test-Suite für neuropsychologische Verfahren (VLMT, DCS-R, CERAD-Module, RWT Wortflüssigkeit, TMT A/B, Stroop, Epi-Track, Grooved Pegboard, Uhrentest u. a.). Alle Oberflächen liegen in `src/App.jsx` als Single-Page-App mit Tailwind-Styling.

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
- `src/index.css` – Tailwind + Dark-Mode-Overrides
- `tests/session-safety.browser.mjs` – Browser-Regressionschecks für Tab-Sperre, Session-Wechsel und Grooved-Pegboard-Abbruch

Die Browser-Regressionschecks benötigen Node.js 22+ und Chrome/Chromium mit aktiviertem Remote-Debugging. Vite mit `npm run dev -- --host 127.0.0.1 --port 5178 --strictPort` starten. Chrome/Chromium separat mit einem temporären Profil und `--headless=new --remote-debugging-address=127.0.0.1 --remote-debugging-port=9227 --user-data-dir=<temporärer Profilordner>` starten. Danach `node tests/session-safety.browser.mjs` ausführen. Abweichende URLs können über `NPT_APP_URL` und `NPT_CDP_URL` gesetzt werden. Der Test verwendet einen eigenen Browser-Kontext mit Testdaten und schließt diesen anschließend.

## Impressum
Betreiber*in: AG Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum  
Anschrift: In der Schornau 23-25, 44892 Bochum  
Kontakt: Tel: 0234-299-0, E-Mail: neuropsychologie.bochum@knappschaft-kliniken.de  
Zweck: interne, nicht-kommerzielle Nutzung für neuropsychologische Testung  
Umsatzsteuer-ID: DE 815 447 053  
Haftungsausschluss: Keine Haftung für externe Links; Anwendung ersetzt keine ärztliche Aufklärung/Dokumentationspflichten.  
Urheberrecht: Inhalte/Layout geschützt; Rechte der neuropsychologischen Verfahren verbleiben bei den Rechteinhabern.
