# Digitale Neuropsychologie – Testbatterie (React/Vite)

Webbasierte, interne Test-Suite für neuropsychologische Verfahren (VLMT, DCS-R, CERAD-Module, RWT Wortflüssigkeit, TMT A/B, Stroop, Epi-Track, Grooved Pegboard, Uhrentest u. a.). Alle Oberflächen liegen in `src/App.jsx` als Single-Page-App mit Tailwind-Styling.

## Kernfunktionen
- Single-Page-Navigation über internen `screen`-State (kein Router)
- Tests mit Stoppuhren, Erinnerungs-Timern, Abbruch-Modalen und Score-Eingaben
- Exporte: CSV (strukturierte Kennzahlen) und PDF (inkl. DCS-Zeichnungen)
- Persistenz: IndexedDB für Session-Daten (inkl. DCS-Canvas-Daten), LocalStorage für UI-Flags
- Dark-/Light-Mode Toggle
- Basisdaten-Card pro Session (Patienten-Initialen, Geschlecht, Neuropsycholog:in-Initialen)
- Auth-Gate mit Passwort-Hash (SHA-256) und optionaler „Angemeldet bleiben“-Flag
- Robots/Meta-Tags, um Indexierung und AI-Crawling zu unterbinden

## Wichtige Dateien
- `src/App.jsx` – Hauptkomponente mit allen Screens und Logik
- `src/components/*` – UI-Bausteine (Timer, DrawPad, ErrorBoundary, Abbruch-Button etc.)
- `src/lib/persist.js` – IndexedDB-Helper, CSV-Helfer
- `src/index.css` – Tailwind + Dark-Mode-Overrides

## Impressum
Betreiber*in: AG Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum  
Anschrift: In der Schornau 23-25, 44892 Bochum  
Kontakt: Tel: 0234-299-0, E-Mail: neuropsychologie.bochum@knappschaft-kliniken.de  
Zweck: interne, nicht-kommerzielle Nutzung für neuropsychologische Testung  
Umsatzsteuer-ID: DE 815 447 053  
Haftungsausschluss: Keine Haftung für externe Links; Anwendung ersetzt keine ärztliche Aufklärung/Dokumentationspflichten.  
Urheberrecht: Inhalte/Layout geschützt; Rechte der neuropsychologischen Verfahren verbleiben bei den Rechteinhabern.
