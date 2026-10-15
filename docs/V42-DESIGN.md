# Ambassador Frühstück V4.2 · Gestaltung und isolierte Abnahme

Stand: 15. Oktober 2026. Kein Production-Release. Reale Mitarbeiterkonten und der produktive Auth-Rollout bleiben einer späteren Phase vorbehalten.

## Verifizierte Grundlage

| Bestandteil | Tatsächlicher Stand zum Entwicklungsbeginn |
| --- | --- |
| Frühstück V4.1 | `64dd77912c2be0de66e3acb786b176e96bf687e9`, Branch `breakfast-v41-secure-auth-20261015` |
| V4.2 Entwicklungsbranch | `breakfast-v42-design-harmonization-20261015` |
| Frühstück Production | `de5b310251e60fe7577166a29c82f31d67643524`, Deployment `dpl_EieM8eaybMXFnitjbCkGxSP6KXN3` |
| Bisherige V4.1 Preview | `dpl_F3dimjWXyjVsm23sWLYMYKn8keso`, READY |
| GitHub main | `893d23bef5f0410f5fdcdef951be7d31f4955abf`; nicht als Entwicklungsbasis verwendet |
| Ambassador Hub Production | `marcowilczek84/silk-service`, Unterordner `ambassador-hub`, Commit `f2fb67cab6e46681f61a7d14be46a44f351a95c9` |
| SILK Inside Production | `marcowilczek84/silk-service`, Commit `f10b492eb0385a854bb766addc33c08422711320` |

Verbindliche Gestaltungsquelle: **Ambassador-Digital-Design-System-Master-V1.pdf**, Fassung vom 14. Oktober 2026, 38 Seiten. Sie präzisiert die ältere Referenz `AMBASSADOR-DIGITAL-DESIGN-SYSTEM.md` in diesem Repository. Relevant sind die drei Ebenen Editorial, Operational und Professional sowie die ausdrücklich geschützte kompakte Frühstücksgeometrie.

## Übertragene Gestaltung

- **Einstieg:** Originales Ambassador-Logo, echte Noto Serif Display Condensed Light Italic 300, ruhige Weissfläche, vorhandene zwei Bereichskarten mit Kontur-Icons, feinem Rahmen und zurückhaltendem Schatten. Reihenfolge und Ziele der vorhandenen Auswahl bleiben erhalten.
- **Service:** Editorial-Schrift ausschliesslich für die App-Identität; Noto Sans für Arbeitsinformationen. Bestehende fünf Spalten, 44 Karten, Zimmernummern, Personen, Namen, Statusleisten, Tischinformationen und kompakte Schriftgrössen bleiben in ihrer Hierarchie erhalten. Keine pauschal vergrösserten Karten.
- **Verwaltung:** Bestehende Aktionen und sieben Tabellenspalten, flache Trennlinien, klare Spaltenköpfe, rechtsbündige Personenzahlen, ruhige 64-Pixel-Zeilen mit Platz für längere Namen, konsistente Formulare und Dialoge. Die mobile Darstellung verwendet weiterhin ihre vorhandene reduzierte Spaltenansicht.
- **Mobile Korrektur:** Die bestehende Verwaltungsnavigation hatte eine zusätzliche Layoutzeile, die alte mobile Rasterdefinition aber nicht. Suche und Liste konnten sich überlagern. Ausschliesslich die CSS-Zuordnung und Abstände dieser bestehenden Bereiche wurden korrigiert.
- **Auth-Oberfläche:** Das vorhandene Anmeldeformular und der Konto-/Gerätedialog erhalten dieselben Schrift-, Farb- und Kontrollstandards. Sämtliche IDs, Formulare, Autocomplete-Werte und Auth-Handler bleiben erhalten.

Vom Hub übernommen: leichte kursive Editorial-Identität, ruhige Fläche, kontrollierte Kartentiefe. Von SILK Inside übernommen: lokale vollständige Sans-Schriften, klare Trennung zwischen Markenidentität und Arbeitsoberfläche, flache Verwaltungsflächen. Die Hub-Fotogestaltung und zusätzliche Navigation wurden nicht in die Arbeitsansichten eingeführt.

## Gestaltungsschicht und Schutz der Funktionalität

Neue Dateien: `public/design-tokens-v42.css`, `public/design-system-v42.css`, `public/auth-v42.css`, lokale Schriftdateien und deren Lizenzen. Das bestehende App-HTML erhält zwei Stylesheet-Links; das Auth-HTML zusätzlich rein statische Präsentationscontainer. `public/qa-v4-app.html` ist das daraus erzeugte QA-Derivat.

`tests/v42-protected-baseline.json` und der zugehörige Test vergleichen die relevanten Dateien gegen SHA-256-Prüfsummen des gesicherten V4.1-Commits: Check-in-/Roomservice-Code, Verwaltungs-/Import-Code, Auth-Client, Bootstrap, serverseitige Auth-Prüfung, API, Datenbankmigrationen, Build-Skripte, Konfiguration und Abhängigkeiten. V4.2 ändert keine dieser Implementierungen.

Die vollständigen lokalen Fonts stammen bytegleich aus den oben verifizierten Referenzen:

| Font | Git-Blob des Originals |
| --- | --- |
| Noto Serif Display Condensed Light Italic 300 | `e66d3117a20f7366d678e9d2a931a3aa85e9b13a` |
| Noto Sans 400 | `061e141c52b6cf5656f0a80c57a7c59011f4c494` |
| Noto Sans 600 | `f630bc6a124967c7d4e42b2705200959e3971ce8` |

OFL-/Copyright-Dateien stehen in `public/licenses`. Die Fonts enthalten die geprüften deutschen und vietnamesischen Zeichen. Keine externen Font-Anfragen, keine künstliche Stauchung oder synthetische Fett-/Kursivschrift.

Farben: Petrol `#1C777B`, Hover `#155F63`, Sekundärfläche `#EDF6F6`, Arbeitsfläche `#F5F7F7`, Text `#202326`, Hilfstext `#62686B`, Kontrollrahmen `#7E898F`. Kontrollradius 4 px, Dialogradius 8 px, sichtbarer 2-px-Fokus. Bestehende Statusfarben der Servicekarten werden nicht fachlich umgedeutet. Kompakte Karten sind die im Master vorgesehene Operational-Ausnahme; Formulare bleiben bei mindestens 16 px Eingabetext.

## Prüfverfahren

1. Build, TypeScript, ESLint und sämtliche bestehenden Node-/SQL-Regressionstests; zusätzlich der V4.1-Dateischutz.
2. Bestehende echte PostgreSQL/PGlite-Browsertests für 14 Tische, Check-in, Roomservice, verlorene Antwort, idempotente Wiederholung, gezielte Rücknahme, andere Zimmer unverändert, Reload, Synchronisierung und DE/EN/VI.
3. Zusätzliche Layouttests mit 1194×834, 1024×768, 1024×748 nutzbarer Höhe, 393×852, 375×812, 1440×900 und 1280×800. Tablets und Telefone werden mit `pointer: coarse` emuliert. Alle 44 Karten werden einschliesslich Text, Position und Abmessungen unmittelbar gegen dieselbe V4.1-Oberfläche ohne die neue Gestaltungsschicht verglichen.
4. Verwaltungssuche, unveränderte Gastdaten beim Öffnen/Schliessen, Formulargrenzen, sichtbare Dialogaktionen, Formularschrift, Fokus, Bereichsauswahl und native Auth-Validierung.
5. Bestehende authentifizierte Browserfälle gegen das separate Supabase-STAGING-Projekt `jeuvmhahanaulvrnasgq`, ausschliesslich mit bereits vorhandenen synthetischen QA-Konten und 44 synthetischen Zimmern. Keine neuen Mitarbeiterkonten, keine Auth-Konfigurations- oder RLS-Änderungen. Automatische Gerätefreigaben nach dem Test wieder widerrufen.
6. GitHub CI prüft zusätzlich native PostgreSQL-Konkurrenz/Rollback und dieselben Browserfälle in Chromium und WebKit. Konkrete finale Resultate, Deployment-SHA und Screenshots stehen im Abschlusspaket.

Vorher-Screenshots verwenden exakt die V4.1-Stylesheets und das ursprüngliche Auth-HTML aus `64dd779`; die drei neuen Stylesheets werden für diese Aufnahmen vom Testbrowser leer beantwortet. Fachcode und synthetische Daten sind bei Vorher/Nachher identisch. Nachher-Aufnahmen erfolgen zusätzlich auf der tatsächlichen Vercel-Preview. Screenshots werden nicht künstlich erzeugt oder retuschiert.

## Preview und spätere Freigabe

- Der Preview-Root bleibt die gesicherte V4.1-Anmeldung mit separater Testdatenbank. Es gibt keine automatische Freigabe realer Geräte.
- `/qa-v4.html?stats` ist die bereits vorhandene, netzwerkisolierte Prüfansicht mit synthetischen Daten und PostgreSQL im Browser. Sie dient der direkten visuellen Abnahme ohne Mitarbeiterkonto und hat keinen Zugriff auf die produktive Datenbank. Eine QA-Registerkarte pro Browser verwenden.
- Der Produktions-Buildschutz aus V4.1 bleibt aktiv. Dieser Branch darf nicht unverändert zu Production promoviert werden.
- V4.2 benötigt **keine SQL-Migration**. Vorhandene Roomservice-/Auth-Migrationen werden ausschliesslich erhalten. Ihre spätere produktive Anwendung und der Geräte-/Kontenrollout brauchen eine gesonderte Freigabe.
- Rückfall der isolierten Gestaltung: vorherige V4.1-Preview verwenden oder die reine Gestaltungsschicht zurücknehmen. Keine Datenbankrücksetzung erforderlich.

## Grenzen der Abnahme

Browseremulation, einschliesslich WebKit, ersetzt keine Abnahme auf physischen Hotel-iPads und iPhones. Bildschirmtastatur, reale Safari-Browserleisten, Home-Screen-Modus, Geräteskalierung und Screenreader bleiben vor einer späteren Veröffentlichung vor Ort zu prüfen. Das Schrift-/Kontrastverfahren ist keine vollständige WCAG-Zertifizierung.

Fotoerkennung wird nicht mit echten Gästefotos oder externen KI-Aufrufen getestet; die bestehende serverseitige Rollensperre und die unveränderte Erkennungslogik werden erhalten. Die im V4.1-Bericht dokumentierten funktionalen Grenzen und der ausstehende Production-Rollout bleiben bestehen.

**Freigabestatus: ausschliesslich isolierte Entwicklung und Preview. Keine Production-Freigabe.**
