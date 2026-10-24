# Sicherheitsprüfung – Digitale NPT

Prüfdatum und Recherche: **24.10.2026**, Europe/Berlin. Projekt: `/Users/johannesjungilligens/digitale-npt`. Ausgangspunkt: `main`, Commit `4227db7`; Arbeitsstand zu Beginn sauber. Prüfbranch: `security/review-2026-10-24`. In diesem Repository und den zugänglichen übergeordneten Verzeichnissen wurden keine geltenden `AGENTS.md` gefunden. Es wurde eine WebApp identifiziert.

**Ergebnis:** bestätigte Fehler in Backup-/PDF-Verarbeitung und CSV-Ausgabe lokal behoben und getestet; verwundbare Werkzeugpakete aktualisiert. npm und OSV melden anschließend keine bekannten Paketlücken. **Keine Aussage „produktiv behoben“:** Hosting, produktiver Zugriffsschutz, Webserver und dessen Laufzeit sind nicht zugänglich. Das lokale Passwortfenster bietet weiterhin keine belastbare Authentifizierung oder Verschlüsselung. Diese Einschränkung ist im Browser nachgewiesen und bleibt ein offener Betriebs-/Architekturpunkt.

## 1. Bestand und Grenzen

| Bereich | Nachgewiesener Stand |
| --- | --- |
| Anwendung | Eine React-SPA/PWA, Vite, JavaScript/JSX, Tailwind/PostCSS; keine weiteren Apps/Workspaces |
| Produktionspakete | `react` 19.2.3, `react-dom` 19.2.3 und transitiv `scheduler`; keine React Server Components |
| Entwicklung/Build | npm, `package-lock.json` v3; Vite 7.2.7 → 7.3.7, React-Vite-Plugin 5.1.2; ESLint 9.39.1; Tailwind 4.1.18; PostCSS 8.5.6 → 8.5.31 |
| Lokale Laufzeit | Vorgefunden: Node 22.18.0, npm 10.9.3. Für Build und Abschlussprüfungen isoliert Node **22.23.4** aus dem offiziellen macOS-arm64-Archiv verwendet; SHA-256 gegen Hersteller-Prüfsummen geprüft. Die allgemeine Systeminstallation wurde nicht ersetzt. |
| Produktion | Statische Dateien aus `dist/`, HTTPS laut README; Service Worker mit Release-Hashes und Offlinecache. Node ist für diesen beschriebenen statischen Betrieb nicht erforderlich. Tatsächlicher Hosting-Anbieter und Webserver unbekannt. |
| Daten | IndexedDB `npt-db` (`sessions`, `drawings`), LocalStorage-Sicherung/UI-Flags, lokale unverschlüsselte JSON-/CSV-/PDF-Dateien; keine SQL-/Server-Datenbank, kein Cloud-Storage-SDK |
| Zugang | Ausschließlich clientseitiger Hashvergleich und Browser-Flags im App-Code; keine Benutzerverwaltung, keine serverseitigen Sessions oder Passwort-Reset-Endpunkte |
| Infrastruktur | Keine Dockerfiles, Containerdefinitionen, Server-/PHP-Konfiguration oder CI/CD-Workflows im Repository. Keine zugänglichen Produktionslogs, Containerimages oder Hosting-Konfigurationen. |
| Typprüfung | Kein TypeScript und kein konfigurierter Typecheck-Befehl; JSX/Modulverarbeitung über erfolgreichen Build, JavaScript über ESLint geprüft |

Die vollständigen Paket-/Versionslisten vor und nach der Korrektur stehen in [dependencies-before.json](security-evidence/dependencies-before.json) und [dependencies-after.json](security-evidence/dependencies-after.json). Der OSV-Abgleich umfasst alle Lockfile-Einträge einschließlich Entwicklungs- und optionaler Plattformpakete: **242 vorher, 247 nachher**. Die Zahl tatsächlich auf macOS installierter Pakete ist kleiner.

## 2. Aktuelle Hinweise und Ausnutzung

Die Herstellerquellen wurden vor Änderungen online geprüft. Die aufgerufenen Übersichten zeigten zuletzt PHP-Hinweise vom 23.10., Node-Sicherheitsreleases vom 21.10. und Next.js-Sicherheitsupdates vom 14.10.2026. Auch ältere offene Paketlücken wurden erfasst; die Prüfung beschränkt sich nicht auf diese drei Meldungen. Quellen: [PHP-Archiv](https://www.php.net/archive/2026.php), [Node-Sicherheitsblog](https://nodejs.org/en/blog/vulnerability/), [Next.js-Übersicht](https://nextjs.org/blog), [Vite-Herstelleradvisories](https://github.com/vitejs/vite/security/advisories?state=published).

Der erste npm-Audit ergab **15 verwundbare Pakete: 12 high, 2 moderate, 1 low; 43 einzelne Advisories**. OSV bestätigte 15 betroffene Lockfile-Pakete. Die Sicherheitslücken liegen in der Werkzeugkette, nicht in installierten Browser-Produktionspaketen. Aus den Paketversionen allein folgt keine öffentlich erreichbare Ausnutzbarkeit.

**Priorität Vite:** 7.2.7 fällt unter CVE-2026-39364/GHSA-v2wj-q39q-566r. Die [Cyber Security Agency Singapore](https://www.csa.gov.sg/alerts-and-advisories/alerts/al-2026-124/) meldet aktive Ausnutzung öffentlich erreichbarer Entwicklungsserver. Der [Hersteller](https://github.com/vitejs/vite/security/advisories/GHSA-v2wj-q39q-566r) nennt 7.3.2 als ersten Fix dieser Lücke; für weitere inzwischen veröffentlichte Hinweise ist **7.3.7** erforderlich. Im Projekt gibt es keine belegte öffentliche Exposition; Entwicklung und Vorschau sind jetzt ausdrücklich an Loopback gebunden. Vite darf nicht als Produktionsserver eingesetzt werden.

Der direkte Abruf des [CISA-KEV-Feeds](https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json) gelang mit curl. Katalog **2026.10.23**, veröffentlicht `2026-10-23T19:30:18.9209Z`, 1756 Einträge: keine Treffer zu den CVE-Aliasen der 43 installierten Advisories oder den drei angefragten PHP-CVEs. Das widerlegt keine Ausnutzung. Ältere KEV-Einträge CVE-2025-31125 (Vite, ältere Versionen) und CVE-2025-55182 (React Server Components) wurden berücksichtigt; ihre betroffenen Versionsbereiche/Komponenten sind hier nicht vorhanden. Der zuletzt genannte RSC-Befund betrifft nicht automatisch das Browserpaket `react`.

Nachweise einschließlich Quellen, CVE-Aliase, betroffener Bereiche, Fixversionen, Abrufzeiten und KEV-Feed-Hash: [advisories.json](security-evidence/advisories.json). Der Webabruf des KEV-Feeds lieferte zunächst HTTP 403 und Pythons TLS-Vertrauensspeicher schlug fehl; der anschließende curl-Abruf mit aktivierter Zertifikatsprüfung sowie der OSV-API-Abgleich waren erfolgreich. Es wurde keine TLS-Prüfung deaktiviert.

### Explizit angefragte Komponenten

| Hinweis | Installiert / Fix | Konkrete Bewertung |
| --- | --- | --- |
| PHP2Shell, CVE-2026-109618 / GHSA-w8hw-w9fx-j79w und CVE-2026-109619 / GHSA-6wmf-4rv5-p3rp | PHP im Projekt nicht vorhanden. Herstellerfixes 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12 bestätigt. | **Nicht betroffen auf Anwendungsebene.** Ob der unbekannte Host unabhängig PHP betreibt, ist **nicht prüfbar**; ggf. Distributions-Backports anhand Paket-Changelog/Herstellerbeleg bewerten, nicht allein anhand der Upstream-Anzeige. [PHP](https://www.php.net/archive/2026.php#2026-10-21-1) |
| PHP CVE-2026-115560, Hinweis 23.10. | Keine PHP-Konfiguration oder PHP-Anwendung. Hersteller rät bis zum regulären Fix zu `session.upload_progress.enabled=0` bei einschlägiger Konfiguration/Handler-Wechsel. | Hier keine PHP-Dateien oder wirkungslosen `.user.ini`-/`ini_set()`-Mitigationsdateien ergänzt. Falls der Host PHP verwendet: Einstellung vor Request-Parsing in wirksamer PHP-/FPM-Pool-Konfiguration setzen, Worker neu starten und die tatsächlich bediente Web-Laufzeit kontrollieren. [Herstellerhinweis](https://www.php.net/archive/2026.php#2026-10-23-1) |
| Node-Sicherheitsrelease 21.10. | Lokales 22.18.0 unter Sicherheitsstand; korrigiert 22.23.4 / 24.22.1 / 26.12.1. | **Lokal vorbereitet und mit 22.23.4 getestet.** `.nvmrc`, `engines` und Befehlsprüfungen verlangen korrigierte unterstützte Linien. System-/Hosting-Laufzeit bleibt gesondert zu aktualisieren. [Node](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) |
| Next.js 14.10. | `next`, `sharp`, `react-server-dom-*` nicht installiert; Herstellerfixes Next 15.5.28 / 16.4.1 und sharp 0.35.5 bestätigt. | **Nicht betroffen:** keine App-Router-/Server-Action-/Image-Optimization-Endpunkte. Gilt auch für CVE-2026-96889 und GHSA-673q-mjm6-r5xr / GHSA-2464-fhr4-w9xw / GHSA-p3m5-59mp-jv5r. [Next.js](https://nextjs.org/blog/nextjs-security-update-october-14-2026) |
| Zugehörige React-Hinweise GHSA-xqc2-xf4c-x3h3 / GHSA-h3gv-c5rc-p453 | Fixes der RSC-Pakete: 19.0.9 / 19.1.10 / 19.2.9 / 19.3.1. Browser-React 19.2.3 unverändert. | **Nicht betroffen:** keine RSC-Pakete oder Server Functions. Hersteller nennt reine Browseranwendungen ausdrücklich ausgenommen. [RSC-RCE](https://github.com/react/react/security/advisories/GHSA-xqc2-xf4c-x3h3), [Server-Functions-DoS](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453) |

Zum Node-Hinweis gehören auf Linie 22 CVE-2026-105482 (DNS), CVE-2026-106069 / -106072 (TLS), CVE-2026-111497 (Brotli), CVE-2026-105481 (HTTP), CVE-2026-106074 (Snapshots/Entropie) und CVE-2026-106073 (Permission Model). Kein entsprechender produktiver Node-Dienst ist belegt; Buildwerkzeuge nutzen aber Node, TLS und Paketverarbeitung. Anwendungsspezifische DNS-Allowlisten, benutzerdefinierte Startup-Snapshots und Node-Permission-Regeln sind nicht vorhanden. CVE-2026-105483 betrifft laut Hersteller nur 24/26; CVE-2026-106070 und -106071 nur 26. Quelle und korrigierte Linien: [Node-Releasehinweis](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).

## 3. Bestätigte Codebefunde und Korrekturen

### S-01 – HTML-Injektion über importierte Zeichnungen (hoch, lokal behoben und getestet)

`parseAssessmentBackup` prüfte bei String-Zeichnungen nur den Anfang einer Bild-Daten-URL und nur das zweite mit Komma getrennte Segment. Ein Angreifer konnte nach gültigem Base64 ein weiteres Komma und HTML-Attribute anhängen, die Prüfsumme neu berechnen und die Datei als Backup anbieten. Die Prüfsumme ist kein Authentizitätsnachweis. Der PDF-Export setzte gespeicherte Bildquellen unverändert in HTML-Attribute ein, auch in die Vorschau innerhalb der PWA-Origin. Das gefährdete Daten derselben Origin nach Laden/Wiederherstellen einer solchen Datei und anschließendem Export.

Korrektur: vollständige, verankerte Raster-URL-Prüfung für PNG/JPEG/WebP einschließlich eingebetteter Altzeichnungen; Ablehnung zusätzlicher Segmente, SVG, externer URLs und Skript-URLs. Beim PDF-Laden werden auch bereits gespeicherte unsichere Bildwerte verworfen. HTML-Werte, Attribute, Sessionkennung und Fenstertitel werden zentral escaped. Keine bestehenden Testdaten wurden bereinigt oder gelöscht.

Dateien: `src/lib/raster-image.js`, `src/lib/assessment-backup.js`, `src/lib/export-safety.js`, `src/App.jsx`. Nachweis: derselbe synthetische Backupinhalt mit gültiger Prüfsumme wurde vom ursprünglichen Parser akzeptiert und vom korrigierten abgewiesen; Unit- und Browsertests bestätigen Ablehnung vor Wiederherstellung und Erhalt der bestehenden Testung. Fremde Session-Zeichnungsverweise und Prototype-Pollution-Schlüssel werden ebenfalls getestet.

### S-02 – CSV-Formelinjektion (mittel, lokal behoben und getestet)

Freitext wurde nur CSV-konform gequotet. Tabellenprogramme können etwa eine als Notiz eingegebene Formel trotzdem ausführen. Die neue Zellkodierung markiert verdächtige Textanfänge einschließlich Leerraum, Steuerzeichen und breiter Unicode-Varianten mit einem Apostroph; Anführungszeichen/Trennzeichen bleiben korrekt maskiert. Numerische Werte einschließlich Null und negativer Scores bleiben unverändert. Beide Exportwege verwenden denselben Inhalt. Grundlage: [OWASP CSV Injection](https://community.owasp.org/attacks/CSV_Injection).

Grenze: Tabellenprogramme können Schutzzeichen beim späteren Speichern/erneuten Import entfernen. Die Behandlung als Text muss im Weiterverarbeitungsprozess erhalten bleiben. Die Browserprüfung belegt den erzeugten CSV-Inhalt, nicht das Verhalten jeder Excel-/LibreOffice-Version.

### S-03 – Fehlende Auslieferungshärtung (lokal behoben/getestet; HTTP-Teil vorbereitet)

Produktions-HTML enthält jetzt eine CSP ohne Inline-JavaScript, externe Skript-/Verbindungsquellen, Objekte, Frames oder Formularziele sowie `no-referrer`. Inline-Stile bleiben für die Oberfläche erlaubt. Der PDF-Druck verwendet registrierte Event-Handler statt Inline-Skripten; das echte Popup und die Druckschaltfläche sind im Browser geprüft. Die CSP wird ausschließlich für den Produktionsbuild ergänzt; HMR bleibt funktionsfähig.

Vite hätte beliebige Dateien aus `public/` ausgeliefert, auch wenn sie nicht im Offlinecache standen. Der Produktionsbuild deaktiviert das pauschale Kopieren und veröffentlicht nur zugelassene App-Ressourcen. Unerwartete Dateien und Symlinks führen zum Abbruch. Vorhandene Finder-Metadaten werden ausgelassen. `.env` und NPT-Backup-Dateien sind zusätzlich in `.gitignore` geschützt; das ist keine rückwirkende Geheimnisbereinigung.

Clickjacking-Schutz über `frame-ancestors`, HSTS und andere HTTP-Header können nicht zuverlässig per HTML-Meta gesetzt werden. Die anzupassende [Nginx-Vorlage](deploy/nginx-security.conf.example) ergänzt diese, echten HTTP-Zugangsschutz und eine explizite Pfadfreigabe. **Vorlage nicht auf einem produktiven Nginx getestet oder angewendet.**

### S-04 – Verwundbare Werkzeuge und alte Laufzeit (Pakete lokal behoben, Laufzeitübernahme offen)

Nach geprüftem Trockenlauf wurde `npm audit fix --ignore-scripts` ohne `--force` ausgeführt. Keine pauschalen Major-/Latest-Updates. Vite und PostCSS erhielten ausdrückliche Mindeststände in `package.json`, alle Auflösungen sind im Lockfile enthalten. Weitere Änderungen ergeben sich aus kompatiblen Korrekturen und deren Abhängigkeitsanforderungen. Die Tabelle unten enthält jede gemeldete Lücke; vollständige Versionsänderungen stehen in den Inventaren.

### S-05 – Browser-Passwortfenster umgehbar (offen, hoch bei fehlendem äußerem Schutz)

`src/App.jsx` vertraut auf `auth_ok` / `auth_temp_ok` und vergleicht im Client einen eingebetteten bzw. beim Build gelieferten Passwort-Hash. Der Browsertest bestätigt den Zugang ohne Passwort durch Änderung des eigenen Browser-Flags. Auch der Standard-Passwortprüfwert liegt im Quellcode und in dessen Historie; er wird hier nicht wiedergegeben. Ein `VITE_*`-Wert wird im Browserbundle veröffentlicht und ist kein Servergeheimnis. Login-Rate-Limits im Client würden diese Grenze nicht beheben.

Ohne zusätzliche Hosting-/Gerätekontrollen schützt dieses Fenster weder Testmaterialien noch lokale Testdaten. Ein anderer Benutzer desselben Browserprofils oder anderer Code derselben Origin kann auf IndexedDB/LocalStorage zugreifen. JSON-Backups und CSV/PDF sind unverschlüsselt. Eine geschützte Hosting-Origin, benannte serverseitig geprüfte Zugänge und Geräteschutz sind nötig; für vertrauliche Offline-Daten ggf. ein gesondertes Konzept mit verschlüsseltem Speicher und Schlüsselverwaltung. Ein beliebiger Backend-/Login-Umbau wurde mangels vorgegebenem Hosting/Identitätsdienst und wegen des bestehenden Offlinebetriebs nicht erfunden. **Dokumentation korrigiert, Befund nicht als behoben bezeichnet. Keine Zugangsdatenrotation ausgeführt.**

## 4. ASVS-orientierte Prüfung

Dies ist eine gezielte Quellcode-/Konfigurationsprüfung entlang relevanter ASVS-Themen, keine vollständige ASVS-Zertifizierung oder Prüfung der unbekannten Betriebsumgebung.

| Prüfbereich | Ergebnis und Nachweis / Grenze |
| --- | --- |
| Serverseitige Autorisierung, Objekt-/Mandantenzugriff | Kein Server/API/Mandantenmodell vorhanden. Browser-Flags sind kein Berechtigungsnachweis (S-05). Session-UUID-Namensräume und Fremdverweis-Ablehnung im Backup geprüft; keine serverseitige Autorisierung damit behauptet. |
| Login, Reset, Sessions, Cookies | Nur lokales Passwortfenster; kein Reset oder App-Sessioncookie. „Angemeldet bleiben“ ist dauerhaftes Browser-Flag. Äußere Authentifizierung, Cookieattribute und Rate-Limits unbekannt. |
| SQL-/Command-Injection, SSRF | Keine SQL-Abfragen, Shell-Aufrufe oder serverseitige URL-Abrufe aus Benutzereingaben im Anwendungscode. Build-/Vite-Helfer sind lokale Werkzeuge und separat aktualisiert. |
| XSS und Ausgabekontexte | React-Textausgabe und alle HTML-Exportstellen geprüft; S-01 behoben. Produktions-CSP und echtes PDF-Popup getestet. Keine Ausführung fremder HTML-/SVG-Zeichnungen zugelassen. |
| CSRF und CORS | Keine cookieauthentifizierten schreibenden Server-Endpunkte. Keine pauschale CORS-Freigabe ergänzt. Zugriffsschutz/CORS eines unbekannten Hosts nicht geprüft. |
| Uploads, Pfadmanipulation, Deserialisierung | Einziger Dateiimport ist lokales JSON-Backup: Größenlimit 128 MiB, Schema-/Checksum-/Tiefen-/Schlüsselprüfung, Rasterprüfung, Session-Namensraum und atomare IDB-Wiederherstellung. Keine `eval`-/Funktions-/Objektdeserialisierung. Tests gegen zusätzliche Bildsegmente und fremde Sessionverweise erfolgreich. Vollständige fachliche Schema-/Feldvalidierung aller Testmodule ist damit nicht zugesichert. |
| Datenbank-/Storage-Berechtigungen | Nur browserlokal; keine Firebase-/Supabase-/S3-Regeln vorhanden. Same-Origin- und Browserprofilschutz, Tab-Sperre und Transaktions-Rollback geprüft. Browserdaten sind nicht nach App-Nutzern isoliert/verschlüsselt (S-05). |
| Header und Transport | CSP-/Referrer-Meta lokal wirksam. HTTPS-Zertifikate, HSTS, Frame-Header, MIME-Header und äußerer Zugangsschutz produktiv offen; Vorlage und Verifikation unten. |
| Debug/öffentliche Konfigurationsdateien | Vite/Preview Loopback; kein App-Debug-API. Keine Source Maps im gebauten Artefakt. Public-Dateifreigabe mit Negativtests; tatsächliches Webroot/Backupdateien des Hosts unbekannt. |
| Secrets | Musterbasierte Suche über sämtliche getrackten Textdateien und hinzugefügte Zeilen der gesamten lokalen Git-Historie: keine Treffer für die geprüften Provider-Token-, privaten Schlüssel- oder klaren Credential-Zuweisungsmuster. Manueller Fund des clientseitigen Passwortprüfwerts: S-05. Keine Geheimniswerte im Bericht. Kein Entropiescanner oder Credential-Gültigkeitstest; nicht zugängliche Repositories/Hosting-Secrets nicht geprüft. |
| Container und CI | Keine entsprechenden Definitionen, daher keine Images/Runnerstände lokal prüfbar. Falls der Betreiber Container/CI verwendet: deren tatsächliche Basisimages und Node-Version separat aktualisieren und nachweisen. |

## 5. Prüfungen und Ergebnisse

Abschlussprüfungen mit isoliertem Node **22.23.4**; Vite unter `127.0.0.1:5178`, Chrome mit temporärem Profil und Debugging ausschließlich unter `127.0.0.1:9232`. Die App-Tests nutzten eigene Browserkontexte und synthetische Daten. Keine Exploit-/Lasttests gegen öffentliche Systeme und keine produktiven Datenänderungen.

| Befehl / Prüfung | Ergebnis |
| --- | --- |
| Ausgangsprüfung `npm run lint`, `node --test tests/*.test.mjs` | Bestanden, 41 ursprüngliche Unit-Tests |
| `npm audit fix --dry-run --ignore-scripts --json` | Änderungen auf kompatible Versionen vorab geprüft; keine Mutation |
| `npm audit fix --ignore-scripts` | Pakete installiert, kein `--force`, Installationsskripte deaktiviert |
| `npm test` | **48/48 bestanden**, einschließlich sieben zusätzlicher Sicherheits-/Regressionstests |
| `npm run lint` | Bestanden, keine Fehler/Warnungen |
| `npm run build` | Bestanden, Vite 7.3.7; CSP, kontrollierte Public-Assets und Service Worker erzeugt |
| `npm ls --depth=0` | Abhängigkeiten konsistent; bestehende direkten Hauptversionen erhalten |
| `npm audit --json` | **0** bekannte Schwachstellen, Exit 0 |
| `npm audit --omit=dev --json` | **0** bekannte Schwachstellen, Exit 0 |
| OSV `POST https://api.osv.dev/v1/querybatch` mit allen Lockfile-Paketversionen | Vorher 15 betroffene Pakete; nachher **0** unter 247 Einträgen; keine ausstehenden Ergebnisseiten |
| `node scripts/check-node.mjs` | 22.18.0 wird mit Exit 1 abgewiesen; 22.23.4 mit Exit 0 akzeptiert; Grenzversionen und andere Linien per Unit-Test geprüft |
| `node tests/security.browser.mjs` | Bestanden: CSP, tatsächlicher CSV-/PDF-Export, unsichere Bestandszeichnungen, echtes Druckfenster, gültig checksummiertes Schadbackup abgewiesen und laufende Testung erhalten. Umgehbarkeit des Passwortfensters ausdrücklich als offener Befund bestätigt. |
| `node tests/pwa.browser.mjs` | Bestanden: Offlineinstallation/-betrieb, Cache-Integrität und Reparatur, Update ohne Datenverlust, Standalone-CSV/PDF, vollständiges Backup und Rollback |
| `node tests/session-safety.browser.mjs` | Bestanden: genau ein Editor, Reload/Handoff, Sessionwechsel, Historie, fehlende/abgelehnte Web Locks |
| `node tests/cerad-figural.browser.mjs`, `node tests/dcsr-zero.browser.mjs` | Bestanden |
| `node tests/demographics-education.browser.mjs`, `node tests/qolie31.browser.mjs`, `node tests/rey-copy.browser.mjs` | Bestanden |
| `node tests/performance.browser.mjs` | Bestanden, einschließlich Zeichnungen, Persistenz und Hintergrund-Timern |
| `git diff --check` | Bestanden |

Die Browserbefehle wurden mit `NPT_CDP_URL=http://127.0.0.1:9232` ausgeführt. Für die meisten bestehenden Suites gilt `NPT_APP_URL=http://127.0.0.1:5178` als Standard; PWA- und Sicherheits-Suite starten eigene Loopback-Server. Reguläre Wiederholung siehe README.

Bei der ersten Ausführung trat im vorhandenen Session-Safety-Test ein Reload-Rennen auf: `Page.reload` kehrt zurück, bevor das alte Dokument entladen sein muss. Der Test wartete dadurch auf dessen alten Editorzustand und ließ den wartenden Tab während des Reloads übernehmen. Er wartet nun zusätzlich auf eine neue `performance.timeOrigin`. Danach bestand die gesamte Suite; die App-Sperrlogik wurde nicht verändert. Der neue PDF-Popup-Test benötigt wie ein echter Klick eine CDP-`userGesture`, andernfalls hält der Popup-Blocker den Test an. Die Produktions-Buildprüfung fand außerdem bereits vorhandene `.DS_Store`-Dateien; diese werden nun explizit nicht veröffentlicht, ohne sie aus dem Workspace zu löschen.

## 6. Lesende Prüfung auf Kompromittierung

Zu Beginn keine Änderungen an getrackten Dateien und keine ungetrackten, nicht ignorierten Dateien. Die lokale Git-Historie enthält **keine Commits ab 17.10.2026**. Quellbaum und zugängliche aktuelle Artefakte wurden auf PHP/Webshell-Dateitypen, Backups, Datenbankdumps und Logs geprüft; keine entsprechenden Dateien außerhalb von `.git`/`node_modules` gefunden. Keine offensichtlichen Shell-Loader oder Befehlsausführung in Anwendungscode gefunden. Eine lesende Prozessnamen-/ID-Stichprobe des lokalen Rechners wurde durchgeführt; sie liefert keinen belastbaren Nachweis einer Kompromittierung und keine Aussage über den Hosting-Server.

**Nicht zugänglich:** Web-/Proxy-/Auth-/Endpoint-Logs, historische Serverdateistände, produktive Prozesse, Netzwerkverbindungen und tatsächlich installierte Hostpakete. Daher ist insbesondere eine forensische Prüfung eines möglichen PHP-Hosts seit 17.10.2026 nicht erfolgt. Es gibt keinen belastbaren lokalen Verdacht, der hier eine Beweissicherung ausgelöst hätte. Fehlende Spuren beweisen keine Unversehrtheit; die Prüfung ersetzt keine Host-Forensik.

Falls der Betreiber Exposition eines verwundbaren Vite-/PHP-Dienstes oder verdächtige Zugriffe feststellt: relevante Logs, Dateistände, Prozess-/Verbindungsdaten und Zeitinformationen unverändert sichern, Hashes und Herkunft dokumentieren, betroffenen Dienst isolieren und Incident Response hinzuziehen. Erst nach Beweissicherung und mit gesondertem Auftrag neu bereitstellen bzw. Zugangsdaten rotieren. Hier wurden keine Beweise/Produktionsdaten gelöscht, keine Worker neu gestartet und keine Zugänge rotiert.

## 7. Übernahme, Verifikation und Rückfall

1. **Laufzeit übernehmen:** Auf Entwicklungs- und Buildsystemen `nvm install` und `nvm use` im Projekt ausführen; `node -p 'process.versions.node'` muss mindestens 22.23.4 der Linie 22 zeigen. Alternativ die angegebenen korrigierten 24-/26-Linien verwenden. Die globale alte 22.18.0 ist durch die isolierte Testlaufzeit nicht ersetzt. Tatsächliche CI-/Serviceprozesse separat prüfen; eine interaktive CLI-Ausgabe beweist deren Version nicht.
2. **Reproduzierbar bauen:** Mit korrigierter Laufzeit `npm ci`, `npm test`, `npm run lint`, `npm audit`, `npm audit --omit=dev` und `npm run build` ausführen. Node-/npm-Version, Commit, Lockfile und Buildkennung dokumentieren. Aktuelle Herstellerhinweise vor einer späteren Freigabe erneut abgleichen. Nur `dist/` als Release-Artefakt übernehmen, niemals das Repository oder `public/` als vollständiges Webroot.
3. **Hosting vorbereiten:** Vorhandene Hostkonfiguration sichern. Eigene vertrauenswürdige HTTPS-Origin, externen Authentifizierungsdienst oder benannte HTTP-Zugänge einrichten und Gesundheitsdatenablagen/Geräte absichern. Nginx-Vorlage an bestehendes TLS-/MIME-Setup und tatsächlichen Releasepfad anpassen; Passwortdatei außerhalb des Webroots verwalten. Erst `nginx -t` ausführen, danach einen Reload im vorgesehenen Wartungsfenster. Anderer Hoster: dieselben Header und Pfad-/Zugangsregeln über dessen unterstützte Konfiguration umsetzen. Die Vorlage ist keine bestätigte Hosting-Eigenschaft.
4. **Erst Staging prüfen:** Vollständiges `dist/` atomar als neuen Release bereitstellen. Ohne Anmeldung darf HTML/JS/Testmaterial nicht abrufbar sein (401/403 bzw. SSO). Angemeldet 200 und korrekte MIME-Typen für `/`, `/sw.js`, `/manifest.webmanifest` und Assets; `Cache-Control: no-cache` für HTML/Worker; CSP einschließlich `frame-ancestors 'none'`, `nosniff`, Referrer- und Frame-Header sowie HTTPS/HSTS prüfen. Beispiele: `curl --head https://STAGING-HOST/` und `curl --head --user BENUTZER https://STAGING-HOST/sw.js` (Passwort interaktiv eingeben). Auf Staging müssen `/.env`, `/.git/config`, `/package.json` und erfundene Backup-URLs 403/404 liefern, niemals Quelltext oder SPA-HTML. Keine aktiven Exploitprüfungen nötig.
5. **Produktion gesondert freigeben:** Hier erfolgte kein Deployment. Nach Betreiberfreigabe denselben geprüften Release übernehmen, ausgelieferte Buildkennung/Dateien und Header am tatsächlichen Dienst verifizieren. Bei statischem Betrieb keinen Node-/PHP-Dienst für diese App starten. Falls Hosting dennoch Node/PHP betreibt, dessen Web-/Worker-/Container-Laufzeit mit Hersteller-/Distributionsnachweis erfassen und nötige Neustarts/Containerneubereitstellungen durchführen; keine öffentliche `phpinfo()`-Seite anlegen.
6. **PWA kontrollieren:** Nach Ende laufender Testungen sämtliche Fenster der App schließen und neu öffnen; angezeigte App-Version mit dem freigegebenen Build vergleichen, Offlinebereitschaft und Exporte prüfen. Bereits installierte Clients können sonst noch den alten Code bedienen. Keine automatische Unterbrechung aktiver Assessments und keine pauschale Löschung von IndexedDB, LocalStorage oder Browserdaten. Hosting-Login allein widerruft vorhandene Offline-Kopien nicht.
7. **Rückfall:** Vorherigen Release und Hostkonfiguration versioniert bereithalten. Bei Betriebsfehlern atomar auf einen erneut gebauten, weiterhin sicherheitskorrigierten Release zurückstellen und `nginx -t`/Header-/Funktionsprüfung wiederholen. Ein Rückfall auf den alten ungehärteten App-Code oder alte verwundbare Werkzeuge öffnet die Befunde wieder; gegebenenfalls Zugang bis zu einem korrigierten Vorwärtsfix beschränken. Keine Datenbankschemata wurden geändert, daher keine Datenmigration rückgängig machen. Beim PWA-Rückfall ebenfalls alle Appfenster nach der Testung schließen und aktivierte Buildkennung prüfen; vorhandene Offlinebestände nicht als automatisch aktualisiert betrachten.

Offen bleiben die produktive Übernahme, tatsächlicher äußerer Zugriffsschutz/HTTP-Header, Schutz lokaler Geräte/Exporte, ggf. weitere Hostdienste und deren Forensik. Ein Nullbefund in Paketdatenbanken deckt diese Risiken nicht ab.

## 8. Einzelne Paketadvisories und Versionsänderungen

Die folgende Tabelle nennt für jeden der 43 npm-/OSV-Funde den Ausgangsstand, die korrigierte Version derselben Hauptlinie, den tatsächlich installierten Abschlussstand und die Anwendbarkeit. „Werkzeug“ bedeutet: Paket vorhanden, aber kein entsprechender aus Benutzerdaten gespeister Produktionspfad im Repository belegt. Quellen verweisen auf GitHub Advisory Database; die unabhängigen OSV-Aliase/-Fixbereiche stehen im verlinkten JSON-Nachweis. Ein fehlender CVE-Alias wird ausdrücklich markiert.

| Paket | Quelle / Kennung | Vorher | Erster passender Fix | Installiert | Anwendbarkeit |
| --- | --- | --- | --- | --- | --- |
| `@babel/core` | [GHSA-4x5r-pxfx-6jf8 / CVE-2026-49356](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | 7.28.5 | 7.29.6 | 7.29.7 | Build/Lint, kein externer Eingabepfad belegt |
| `@humanfs/node` | [GHSA-p498-v437-472g / CVE nicht zugewiesen/nicht im OSV-Nachweis](https://github.com/advisories/GHSA-p498-v437-472g) | 0.16.7 | 0.16.8 | 0.16.8 | Build/Lint, kein externer Eingabepfad belegt |
| `ajv` | [GHSA-2g4f-4pwh-qvx6 / CVE-2025-69873](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | 6.12.6 | 6.14.0 | 6.15.0 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-f886-m6hf-6m8v / CVE-2026-33750](https://github.com/advisories/GHSA-f886-m6hf-6m8v) | 1.1.12 | 1.1.13 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-3jxr-9vmj-r5cp / CVE-2026-13149](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) | 1.1.12 | 1.1.16 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-mh99-v99m-4gvg / CVE-2026-14257](https://github.com/advisories/GHSA-mh99-v99m-4gvg) | 1.1.12 | 1.1.17 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-rgw5-rvv9-x895 / CVE-2026-69152](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | 1.1.12 | 1.1.18 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-q2hr-2g5m-vwhr / CVE-2026-102277](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | 1.1.12 | 1.1.21 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-qhr7-859c-m2p7 / CVE-2026-102278](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | 1.1.12 | 1.1.20 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `brace-expansion` | [GHSA-6j4f-fj2g-mc7p / CVE-2026-102276](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | 1.1.12 | 1.1.19 | 1.1.21 | Build/Lint, kein externer Eingabepfad belegt |
| `browserslist` | [GHSA-c83g-rgw3-j3cx / CVE-2026-73089](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) | 4.28.1 | 4.28.7 | 4.29.4 | Build/Lint, kein externer Eingabepfad belegt |
| `browserslist` | [GHSA-73wf-gq98-2v4g / CVE-2026-73088](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | 4.28.1 | 4.28.7 | 4.29.4 | Build/Lint, kein externer Eingabepfad belegt |
| `flatted` | [GHSA-25h7-pfq9-p65f / CVE-2026-32141](https://github.com/advisories/GHSA-25h7-pfq9-p65f) | 3.3.3 | 3.4.0 | 3.4.4 | Build/Lint, kein externer Eingabepfad belegt |
| `flatted` | [GHSA-rf6f-7fwh-wjgh / CVE-2026-33228](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | 3.3.3 | 3.4.2 | 3.4.4 | Build/Lint, kein externer Eingabepfad belegt |
| `js-yaml` | [GHSA-h67p-54hq-rp68 / CVE-2026-53550](https://github.com/advisories/GHSA-h67p-54hq-rp68) | 4.1.1 | 4.2.0 | 4.3.2 | Build/Lint, kein externer Eingabepfad belegt |
| `js-yaml` | [GHSA-52cp-r559-cp3m / CVE-2026-59869](https://github.com/advisories/GHSA-52cp-r559-cp3m) | 4.1.1 | 4.3.0 | 4.3.2 | Build/Lint, kein externer Eingabepfad belegt |
| `js-yaml` | [GHSA-5p4m-2wfm-xmqj / CVE nicht zugewiesen/nicht im OSV-Nachweis](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | 4.1.1 | 4.3.1 | 4.3.2 | Build/Lint, kein externer Eingabepfad belegt |
| `js-yaml` | [GHSA-2883-xcg3-v3hh / CVE-2026-84375](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | 4.1.1 | 4.3.2 | 4.3.2 | Build/Lint, kein externer Eingabepfad belegt |
| `minimatch` | [GHSA-3ppc-4f35-3m26 / CVE-2026-26996](https://github.com/advisories/GHSA-3ppc-4f35-3m26) | 3.1.2 | 3.1.3 | 3.1.5 | Build/Lint, kein externer Eingabepfad belegt |
| `minimatch` | [GHSA-7r86-cg39-jmmj / CVE-2026-27903](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | 3.1.2 | 3.1.3 | 3.1.5 | Build/Lint, kein externer Eingabepfad belegt |
| `minimatch` | [GHSA-23c5-xmqv-rm74 / CVE-2026-27904](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | 3.1.2 | 3.1.4 | 3.1.5 | Build/Lint, kein externer Eingabepfad belegt |
| `nanoid` | [GHSA-28wg-ghj8-5hjv / CVE-2026-67214](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) | 3.3.11 | 3.3.16 | 3.3.20 | Build/Lint, kein externer Eingabepfad belegt |
| `nanoid` | [GHSA-2v37-7h3g-55p8 / CVE-2026-67213](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | 3.3.11 | 3.3.18 | 3.3.20 | Build/Lint, kein externer Eingabepfad belegt |
| `nanoid` | [GHSA-xwg4-73v4-xw9w / CVE-2026-73086](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | 3.3.11 | 3.3.12 | 3.3.20 | Build/Lint, kein externer Eingabepfad belegt |
| `picomatch` | [GHSA-3v7f-55p6-f55p / CVE-2026-33672](https://github.com/advisories/GHSA-3v7f-55p6-f55p) | 4.0.3 | 4.0.4 | 4.0.7 | Build/Lint, kein externer Eingabepfad belegt |
| `picomatch` | [GHSA-c2c7-rcm5-vvqj / CVE-2026-33671](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | 4.0.3 | 4.0.4 | 4.0.7 | Build/Lint, kein externer Eingabepfad belegt |
| `postcss` | [GHSA-qx2v-qp2m-jg93 / CVE-2026-41305](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) | 8.5.6 | 8.5.10 | 8.5.31 | Build/Lint, kein externer Eingabepfad belegt |
| `postcss` | [GHSA-6g55-p6wh-862q / CVE-2026-45623](https://github.com/advisories/GHSA-6g55-p6wh-862q) | 8.5.6 | 8.5.12 | 8.5.31 | Build/Lint, kein externer Eingabepfad belegt |
| `postcss` | [GHSA-fxqj-rqcc-2cmp / CVE-2026-69153](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) | 8.5.6 | 8.5.23 | 8.5.31 | Build/Lint, kein externer Eingabepfad belegt |
| `postcss` | [GHSA-r28c-9q8g-f849 / CVE-2026-73646](https://github.com/advisories/GHSA-r28c-9q8g-f849) | 8.5.6 | 8.5.18 | 8.5.31 | Build/Lint, kein externer Eingabepfad belegt |
| `rollup` | [GHSA-mw96-cpmx-2vgc / CVE-2026-27606](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | 4.52.2 | 4.59.0 | 4.65.0 | Build/Lint, kein externer Eingabepfad belegt |
| `source-map-js` | [GHSA-68fv-2mgg-jv7q / CVE-2026-93749](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | 1.2.1 | 1.2.2 | 1.2.2 | Build/Lint, kein externer Eingabepfad belegt |
| `vite` | [GHSA-4w7w-66w2-5vf9 / CVE-2026-39365](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) | 7.2.7 | 7.3.2 | 7.3.7 | Dev-Server, Erreichbarkeit nicht öffentlich belegt |
| `vite` | [GHSA-v2wj-q39q-566r / CVE-2026-39364](https://github.com/advisories/GHSA-v2wj-q39q-566r) | 7.2.7 | 7.3.2 | 7.3.7 | Dev, aktive Ausnutzung extern berichtet; lokal keine öffentliche Exposition belegt |
| `vite` | [GHSA-p9ff-h696-f583 / CVE-2026-39363](https://github.com/advisories/GHSA-p9ff-h696-f583) | 7.2.7 | 7.3.2 | 7.3.7 | Dev-Server, Erreichbarkeit nicht öffentlich belegt |
| `vite` | [GHSA-v6wh-96g9-6wx3 / CVE-2026-53632](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | 7.2.7 | 7.3.5 | 7.3.7 | Dev/Windows; lokales macOS nicht betroffen |
| `vite` | [GHSA-fx2h-pf6j-xcff / CVE-2026-53571](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) | 7.2.7 | 7.3.5 | 7.3.7 | Dev/Windows; lokales macOS nicht betroffen |
| `vite` | [GHSA-698v-4r3x-3vcv / CVE-2026-112943](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | 7.2.7 | 7.3.7 | 7.3.7 | Dev/Windows; lokales macOS nicht betroffen |
| `vite` | [GHSA-r825-w8mm-5pxw / CVE-2026-112944](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | 7.2.7 | 7.3.7 | 7.3.7 | Dev/Editor-Aufruf; konkrete Ausnutzung nicht belegt |
| `vite` | [GHSA-587h-7wmj-h5pm / CVE-2026-112942](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | 7.2.7 | 7.3.7 | 7.3.7 | Dev/Windows; lokales macOS nicht betroffen |
| `vite` | [GHSA-9jrq-w75r-8gcw / CVE-2026-112945](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | 7.2.7 | 7.3.7 | 7.3.7 | Dev/custom middleware; hier nicht konfiguriert |
| `vite` | [GHSA-rq7h-c2jc-7f22 / CVE-2026-112946](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | 7.2.7 | 7.3.7 | 7.3.7 | Dev/macOS-Pfade; konkrete Pfadkonstellation nicht belegt |
| `zod` | [GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | 4.1.13 | 4.6.6 | 4.6.7 | Build/Lint, kein externer Eingabepfad belegt |

### Weitere durch die kompatible Auflösung geänderte Pakete

Die Liste enthält auch unterstützende Paketänderungen; native Plattformvarianten derselben Bibliothek sind in den JSON-Inventaren einzeln enthalten. Browser-React und ReactDOM wurden nicht aktualisiert.

| Paket | Vorher | Nachher |
| --- | --- | --- |
| `@babel/code-frame` | 7.27.1 | 7.29.7 |
| `@babel/compat-data` | 7.28.4 | 7.29.7 |
| `@babel/core` | 7.28.5 | 7.29.7 |
| `@babel/generator` | 7.28.5 | 7.29.8 |
| `@babel/helper-compilation-targets` | 7.27.2 | 7.29.7 |
| `@babel/helper-globals` | 7.28.0 | 7.29.7 |
| `@babel/helper-module-imports` | 7.27.1 | 7.29.7 |
| `@babel/helper-module-transforms` | 7.28.3 | 7.29.7 |
| `@babel/helper-string-parser` | 7.27.1 | 7.29.11 |
| `@babel/helper-validator-identifier` | 7.28.5 | 7.29.7 |
| `@babel/helper-validator-option` | 7.27.1 | 7.29.7 |
| `@babel/helpers` | 7.28.4 | 7.29.10 |
| `@babel/parser` | 7.28.5 | 7.29.11 |
| `@babel/template` | 7.27.2 | 7.29.7 |
| `@babel/traverse` | 7.28.5 | 7.29.10 |
| `@babel/types` | 7.28.5 | 7.29.11 |
| `@humanfs/core` | 0.19.1 | 0.19.2 |
| `@humanfs/node` | 0.16.7 | 0.16.8 |
| `@humanfs/types` | nicht vorhanden | 0.15.0 |
| `@napi-rs/lzma-linux-x64-gnu` | nicht vorhanden | 1.5.1 |
| `@types/estree` | 1.0.8 | 1.0.9 |
| `ajv` | 6.12.6 | 6.15.0 |
| `baseline-browser-mapping` | 2.11.27 | 2.11.32 |
| `brace-expansion` | 1.1.12 | 1.1.21 |
| `browserslist` | 4.28.1 | 4.29.4 |
| `caniuse-lite` | 1.0.30001814 | 1.0.30001819 |
| `electron-to-chromium` | 1.5.267 | 1.5.464 |
| `esbuild` | 0.25.10 | 0.28.2 |
| `flatted` | 3.3.3 | 3.4.4 |
| `js-yaml` | 4.1.1 | 4.3.2 |
| `minimatch` | 3.1.2 | 3.1.5 |
| `nanoid` | 3.3.11 | 3.3.20 |
| `node-releases` | 2.0.27 | 2.0.60 |
| `picomatch` | 4.0.3 | 4.0.7 |
| `postcss` | 8.5.6 | 8.5.31 |
| `rollup` | 4.52.2 | 4.65.0 |
| `source-map-js` | 1.2.1 | 1.2.2 |
| `update-browserslist-db` | 1.2.2 | 1.3.4 |
| `vite` | 7.2.7 | 7.3.7 |
| `zod` | 4.1.13 | 4.6.7 |
