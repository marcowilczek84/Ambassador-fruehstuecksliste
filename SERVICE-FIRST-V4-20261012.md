# Ambassador Frühstück V4 — Service First

## Ausgangsbasis

Production beim Arbeitsbeginn: `a4e72fb3aba5db1a7edca69cfaf7b876ec7de483`, Deployment `dpl_DrrK8T3rdCwrJqNajeaheQqbS5jf`. Alle 39 vorhandenen Branches wurden geprüft. Ausgangsbranch enthält zusätzlich ausschliesslich die Dokumentation bis `67b8b4c131a54e4fb971c3f411af5184a41e910b`. Separater Entwicklungsbranch: `breakfast-v4-service-first-20261012`.

## Umsetzung

- Neue Serviceansicht mit weisser Fläche, kühlen Grautönen, Petrol, Sans Serif und klaren Ziffern. Feste Zimmerpositionen in fünf Spalten auf iPad, lineare Liste auf iPhone.
- Explizites +1 je Person. Die Zimmerkarte selbst bucht nichts. Personenstand und Namen öffnen kompakte Details mit −1-Korrektur. Vollständig erfasste Zimmer treten zurück.
- Suche, Nur offene und dezenter Frühstücksfortschritt. Kein Verwaltungsmenü im Service; Rezeption direkt erreichbar.
- Rezeption als breite Tabelle mit Gästeverwaltung, Berechtigungen, An-/Abreise und Bemerkungen. Import, Statistik, Tagesabschluss und bestehende Exportfunktionen bleiben dort verfügbar.
- Neue additive Datenbankfunktion `breakfast_service_action_v4`: Zeilensperre, erwarteter Zimmerstand, eindeutige Aktions-ID, wiederholbare Zustellung ohne Doppelzählung, Grenzen und Tagesabschluss geprüft. Keine produktiven Gastdaten migriert oder zu Testzwecken verändert; vorhandene APIs unverändert.
- Ausstehende Serviceaktionen werden lokal gehalten und nach Fehlern ausdrücklich erneut versucht. Erfassung wird erst nach Serverbestätigung angezeigt. Bei veraltetem Zimmerstand werden aktuelle Daten angezeigt und erneutes Prüfen verlangt.
- Korrekturen bleiben als negative Ankunftsereignisse nachvollziehbar; Statistik berechnet daraus die wirksamen positiven Ankünfte. Zusatzgäste speichern nur wirklich geänderte Zimmer und überschreiben keine unbeteiligten Zimmer.

## Prüfnachweise

- `npm test`: 11 Tests bestanden. Darunter echte React-Oberfläche, versehentlicher Kartenkontakt, Einzel-/Teil-/Voll-Check-in, Korrektur, Filter, Suche, Speichern, Fehler/Wiederholung mit identischer Aktions-ID sowie Konflikte.
- Mews: tatsächlicher Importhandler und echte XLSX-Bibliothek mit 25 synthetischen Fällen; Namen, Personen, Anreise, Abreise und Berechtigungen inklusive ZFF-Grenzfällen geprüft.
- Datenbank: `tests/service-v4-db.sql`, 10 Prüfschritte mit tatsächlichem PL/pgSQL-Code gegen eine temporäre Tabelle in zurückgerollter Transaktion. Keine Tests auf produktiven Zeilen.
- Browser: tatsächlich gerenderte Anwendung im isolierten QA-Iframe; Testantworten und Speicher ausschliesslich im Arbeitsspeicher. Externe Verbindungen zusätzlich durch CSP blockiert. Aufruf über `/qa-v4.html`.
- 1194 × 834 und 1024 × 768: alle 44 Zimmer ohne Scrollen, zentrale +1-Touchflächen 44 × 44 px. Weitere Ansichten 393 × 852, 320 × 568 und 1440 × 1000.
- Sichtbare Prüfung von Rollenwechsel, Rezeptionsformular, Such-/Filterzuständen, Details/Korrektur und Offline-Wiederholung. Diese Gerätegrössen wurden in Chromium geprüft; kein physischer iPad-/Safari- oder Windows-Gerätetest.

## Bestandsschutz und Betrieb

Originaler Produktionsruntime bleibt als unveränderte Datei erhalten. `scripts/prepare-v4.cjs` erstellt reproduzierbar eine begrenzte Erweiterung. Hash-Tests schützen 26 Bestandsdateien und zentrale Originalfunktionen. Authentifizierung, Benutzerrollen, Export und Import werden nicht ersetzt. SILK Inside, App-Hub und Trinkgeld wurden nicht bearbeitet.

Nach Freigabe der technischen und visuellen Prüfungen wird ausschliesslich dieser Branch auf das bestehende Vercel-Projekt veröffentlicht. Bereits offene Arbeitsgeräte einmal neu laden, damit alle die V4-Bedienung verwenden. Rückfallziel ist das oben genannte bisherige Production-Deployment; die additive RPC darf dabei bestehen bleiben.
