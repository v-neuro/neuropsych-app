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

## Schnellstart
```bash
npm install
# optional: .env anlegen, z. B. VITE_APP_PASSWORD_HASH=<sha256>
npm run dev
```
App öffnen unter `http://localhost:5173/`. Beim ersten Aufruf wird das Passwort abgefragt.

## Konfiguration
- **Passwort-Hash:** `.env` → `VITE_APP_PASSWORD_HASH=<sha256-hash>` (Fallback ist hinterlegt).
- **Dark Mode:** Toggle oben rechts.
- **Neue Testung:** Button „Neue Testung“ generiert neue `sessionUUID`, leert Persistenz und zeigt die Basisdaten-Card erneut.

## Daten & Persistenz
- **IndexedDB:** Speichert `sessionData`, `screen`, `globalTimers`, DCS-Canvas-Daten.
- **LocalStorage:** `darkMode`, `sessionUUID`, (optional) `auth_ok`; `sessionStorage` hält temporären Login-Status.

## Exporte
- **CSV:** Enthält die vereinbarten Kennzahlen pro Test (VLMT, DCS-R, EpiTrack, TMT, Stroop, Grooved Pegboard, CERAD-Module, Uhrentest). Dateiname: `<pat_init>_<examiner_init>_<session-id>.csv`.
- **PDF:** Gleiche Kennzahlen, zusätzlich eingebettete DCS-Zeichnungen. Dateiname analog CSV.

## Sicherheit / Crawling
- `index.html`: `noindex,nofollow,noarchive`, `noai/noimageai`.
- `public/robots.txt`: `Disallow: /` inkl. gängiger AI-Crawler.
- Für maximale Wirkung kann serverseitig `X-Robots-Tag: noindex, nofollow` gesetzt werden.

## Wichtige Dateien
- `src/App.jsx` – Hauptkomponente mit allen Screens und Logik
- `src/components/*` – UI-Bausteine (Timer, DrawPad, ErrorBoundary, Abbruch-Button etc.)
- `src/lib/persist.js` – IndexedDB-Helper, CSV-Helfer
- `src/index.css` – Tailwind + Dark-Mode-Overrides

## Hinweise für Betrieb/Upload
- Nur interne Nutzung; Passwort-Hash nicht im Repo veröffentlichen, sondern via `.env`.
- Patient:innen-bezogene Daten bleiben im Browser (IndexedDB/LocalStorage). Keine Server-Backends.
- Bei Deployment sicherstellen, dass HTTPS aktiv ist und ggf. ein HTTP-Header `X-Robots-Tag: noindex, nofollow` gesetzt wird.

## Impressum (bereitgestellt)
Betreiber*in: AG Verhaltensneurologie, Klinik für Neurologie, Knappschaft Kliniken Universitätsklinikum Bochum  
Anschrift: In der Schornau 23-25, 44892 Bochum  
Kontakt: Tel: 0234-299-0, E-Mail: neuropsychologie.bochum@knappschaft-kliniken.de  
Zweck: interne, nicht-kommerzielle Nutzung für neuropsychologische Testung  
Umsatzsteuer-ID: DE 815 447 053  
Haftungsausschluss: Keine Haftung für externe Links; Anwendung ersetzt keine ärztliche Aufklärung/Dokumentationspflichten.  
Urheberrecht: Inhalte/Layout geschützt; Rechte der neuropsychologischen Verfahren verbleiben bei den Rechteinhabern.
