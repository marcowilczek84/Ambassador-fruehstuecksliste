# Ambassador Frühstück V4.1 – sichere Authentifizierung

Stand: 15.10.2026. Entwicklungsbasis: `5fe11c5ce40a4e9adaf676de627719a034899a65`.
Branch: `breakfast-v41-secure-auth-20261015`.

Diese Entwicklung ist ausschliesslich für die isolierte Abnahme bestimmt. Production bleibt auf dem separat verifizierten Stand. Ein Vercel-Build mit `VERCEL_ENV=production` bricht in diesem Branch ausdrücklich ab. Keine produktive SQL-Migration, RLS-Umstellung oder Veröffentlichung ist Bestandteil dieses Abschlusses.

## Technische Umsetzung

Supabase Auth übernimmt E-Mail/Passwort, sichere Tokens, Wiederanmeldung, automatische Token-Erneuerung und TOTP-MFA. Die App enthält keine eigene Passwortprüfung und keinen Service-Role-Schlüssel. Öffentliche Publishable Keys sind keine Berechtigungsnachweise.

Die Datenbank entscheidet bei jeder Aktion anhand der aktuellen Mitgliedschaft, einer freigegebenen Supabase-Sitzung und des tatsächlichen Auth-Sitzungsdatensatzes. Die Sitzung muss dem angemeldeten Benutzer gehören, noch gültig und nicht anonym sein. Verwaltungsrechte verlangen zusätzlich `aal2`. Veränderbare `user_metadata` erteilen keine Rechte.

Die Oberfläche bleibt auf dem bestehenden V4-Runtime aufgebaut. `scripts/prepare-v41.cjs` erzeugt eine separate authentifizierte Variante. Die ursprünglichen V4-Assets bleiben erhalten. Die allgemeine JSON-Merge-Schnittstelle und direkte Tabellenänderungen werden in der sicheren Variante nicht verwendet. Ein- und Auschecken, Stammdaten, Import, Sondergäste, Abreisen und Tagesabschluss haben begrenzte serverseitige Aktionen. Änderungen mehrerer Zimmer laufen atomar. Bestätigungen erscheinen erst nach erfolgreicher Speicherung.

Die Foto-Import-API erhält ebenfalls eine serverseitige Rezeptionsprüfung. Ihre Erkennungslogik bleibt unverändert; der Regressionstest prüft weiterhin den ursprünglichen Hash des Fachcodes. Der Mews-Excel-Import bleibt der bestehende Parser.

## Rollenrechte

| Aktion | Service | Rezeption | Verwaltung |
|---|---|---|---|
| Heutige Frühstücksliste lesen | Ja | Ja | Ja |
| Check-in, Tisch, Roomservice, gezielte Rücknahme | Ja | Ja | Ja |
| Opera / externe Gäste erfassen und zurücknehmen | Ja | Ja | Ja |
| Anwesende Gäste als gegangen markieren | Ja | Ja | Ja |
| Gastnamen, Personen, Frühstück, Aufenthalt, Bemerkung | Nein | Ja | Ja |
| Mews-/Foto-Import | Nein | Ja | Ja |
| Tagesabschluss / heutigen Tag wieder öffnen | Nein | Ja | Ja |
| Leere heutige Liste zurücksetzen | Nein | Nur ohne Buchungen | Nur ohne Buchungen |
| Tagesstatistik | Ja | Ja | Ja |
| Historischer Wochenvergleich ohne Gastidentitäten | Nein | Ja | Ja |
| Historische Tagesdaten lesen | Nein | Nein | Ja, mit MFA |
| Historische Buchungen verändern oder löschen | Nein | Nein | Nein |
| Rollen und Gerätesitzungen verwalten | Nein | Nein | Ja, mit MFA |

Ein Wechsel zwischen Service- und Rezeptionsansicht verändert die Datenbankrolle nicht. Die Service-Rolle kann durch Manipulation eines Menüs oder Browser-Speichers keine Verwaltungsrechte erhalten. Der letzte aktive Administrator kann nicht über die App entfernt werden. Rollenänderungen widerrufen vorhandene Gerätefreigaben des betroffenen Kontos.

## Isolierte Datenbank und Migrationen

Testprojekt: `jeuvmhahanaulvrnasgq` – bestehendes Ambassador-STAGING.
Eigene Schemas: `bf41_data` und `bf41_security`; eigene API-Funktionen: `public.bf41_*`.
Vorhandene Tabellen anderer Testanwendungen, insbesondere `public.breakfast_lists`, werden nicht verwendet oder verändert. Globale Auth-Einstellungen bleiben unverändert. Es handelt sich um eine logische Trennung innerhalb eines vom Production-Projekt getrennten STAGING-Projekts.

Die fünf Migrationen unter `supabase/migrations/` bilden gemeinsam den geprüften Stand:

1. `20261015040542_breakfast_v41_secure_auth.sql`: eigene Datentabelle, unverändert übernommene Fachfunktionen mit kanonischem Roomservice, RLS, Mitgliedschaften, Sitzungen und begrenzte APIs.
2. `20261015041542_breakfast_v41_atomic_batch.sql`: atomare Zimmeraktionen.
3. `20261015042153_breakfast_v41_auth_claim_helpers.sql`: Supabase-kompatible Claim-Abfrage ohne zusätzliche Auth-Schema-Rechte; gefilterte Historienprojektion.
4. `20261015043408_breakfast_v41_private_function_acl.sql`: Rechte explizit als tatsächlicher Funktionsbesitzer setzen und mit Postconditions prüfen.
5. `20261015043709_breakfast_v41_historical_summaries.sql`: begrenzter historischer Statistikzugriff und Berücksichtigung gezielter sowie älterer signierter Korrekturen.

Nicht einzeln aus Migration 1 ableiten: Erst alle fünf Migrationen zusammen bilden den fertigen Rechtezustand. Die Installation verweigert ein Ziel mit den vorhandenen produktiven Frühstücksfunktionen. Diese Dateien sind **keine freigegebene Production-Migration**.

Alle neuen Tabellen haben RLS. `anon` hat weder Lese-/Schreibrechte auf diese Tabellen noch Ausführungsrechte auf App-Funktionen. `authenticated` darf keine Tabelle direkt verändern. Die schmalen Fachfunktionen laufen als `bf41_executor`, eine Rolle ohne Login und ohne RLS-Bypass. Die Auth-Sitzungsprüfung und die historische Statistik verwenden jeweils eine private, begrenzte Hilfsfunktion. Keine private Schema-Freigabe in PostgREST erforderlich.

Die ursprüngliche Roomservice-Migration bleibt separat unter `sql/migrations/20261013_breakfast_roomservice_table_choice.sql`; ihre Rückfallfassung liegt unter `sql/rollback/`. Sie erweitert ausschliesslich die bestehende Validierung. `Roomservice` bleibt fachlich eindeutig; es wird keine künstliche Tischnummer verwendet. Alte Zuordnungen `Tisch 1` bis `Tisch 50` bleiben lesbar und rücknehmbar, die aktuelle Oberfläche bietet weiterhin 14 Tische.

## Geräte und Sitzungen

Die Gerätefreigabe bezieht sich auf eine echte Supabase-Sitzung, nicht auf einen manipulierbaren Browser-Fingerabdruck. Ein neuer Login oder ein Gerätewechsel benötigt eine neue Freigabe. Normale Token-Erneuerung behält dieselbe Sitzung. Service/Rezeption können für maximal 30 Tage freigegeben werden, Verwaltung maximal 12 Stunden. Die Ablaufzeit ist im Konto sichtbar.

Die Anmeldung öffnet zunächst nur die Zugriffskontrolle. Noch nicht freigegebene Konten/Geräte sehen keine Gästeliste. Eine Sperre oder Rollenänderung wirkt bei der nächsten Datenbankaktion sofort; die laufende Ansicht prüft den Status zusätzlich alle 15 Sekunden und bei Fokus/Verbindungswechsel.

Bei Verbindungsfehlern wird keine Speicherung bestätigt. Offene Formulare bleiben hinter der Anmeldemaske erhalten. Unbestätigte Aktionen behalten ihre UUID und werden nur für denselben Benutzer und den passenden Tag erneut geprüft. Eine verlorene Antwort erzeugt dadurch keinen zweiten Check-in.

Gastcaches sind nach Testprojekt und Benutzer getrennt. Spracheinstellungen bleiben erhalten. Abmelden entfernt die angezeigten Daten und bestätigten Gastcaches; unbestätigte Aktionen bleiben zur Klärung ihrem ursprünglichen Benutzer zugeordnet. Ein Offline-Logout wird ausdrücklich als lokal erfolgt und serverseitig unbestätigt bezeichnet. QR-Einrichtungsdaten und Verwaltungslisten werden bei Abmeldung aus der Oberfläche entfernt.

Bisherige anonyme Offline-Warteschlangen werden weder gelöscht noch automatisch abgesendet. Ihre Anwesenheit blockiert den Wechsel mit einem Hinweis an die Hotelverwaltung. Diese Änderungen müssen vor der Umstellung anhand der bisherigen App und des bestätigten Datenbankstands abgeglichen werden.

## Kontrollierter Gerätewechsel vor Production

1. Geräteinventar erstellen: iPads, iPhones, Browserprofil, verantwortliche Person, letzte bestätigte Synchronisierung, offene Warteschlange, Sprache.
2. Vor dem Frühstücksservice mindestens zwei Verwaltungszugänge mit Supabase Auth und MFA einrichten; Wiederherstellungsverfahren ausserhalb der Gästetabellen dokumentieren.
3. Service-/Rezeptionskonten ausschliesslich über Supabase Auth bereitstellen. Mitgliedschaften anhand der echten Auth-User-IDs freigeben. Keine Passwörter in SQL, Browsercode oder Git speichern.
4. Auf jedem Gerät Anmeldung und Freigabe durchführen. Gerätecode mit der tatsächlich vorliegenden Sitzung abgleichen. Ablaufzeit muss den gesamten nächsten Service mit Reserve abdecken.
5. Pro Gerät Sprache, 44 Zimmer, Tagesdatum, Verbindung, Wiederanmeldung und Abmeldung in der Testumgebung prüfen. Offene alte Änderungen vor der Umstellung einzeln klären.
6. Erst wenn alle operativen Geräte und eine Ersatzanmeldung einsatzbereit sind, einen angekündigten Termin ausserhalb des Frühstücksbetriebs freigeben.
7. Während der Umstellung keine unbeaufsichtigten Hintergrundaktionen und keine automatischen Gastdaten-Resets. Erst nach bestätigtem Abschluss den Service starten.

## Rollout nach gesonderter Freigabe

1. GitHub- und Vercel-SHAs sowie Production-Schema, Funktionsdefinitionen, ACLs und RLS erneut lesend aufnehmen. Datum und Prüfsummen der historischen Datensätze sichern; Gästepayloads gehören nicht in Entwicklungsartefakte.
2. Wiederherstellbaren Datenbankstand und den bisherigen Deployment-Stand verifizieren. Rücksicherung zunächst mit synthetischen Daten erproben.
3. Eine **eigene, zielgenaue Production-Migration** aus dem geprüften Stand erstellen: bestehende `public.breakfast_lists` anbinden, bestehende Daten unverändert lassen, alle fünf alten Schreib-RPCs einschliesslich `merge_breakfast_changes` berücksichtigen, vorhandene anonyme Tabellenrechte und vier permissive Richtlinien gezielt ersetzen. Keine globalen Rechte anderer Anwendungen ändern.
4. Diese konkrete Production-SQL inklusive Vorbedingungen, Sperrzeitgrenzen, Rückfallplan und Auswirkungen separat zur Freigabe vorlegen. Die STAGING-Migrationen nicht blind auf Production ausführen.
5. Auth-Projekteinstellungen zu Refresh, Inaktivität, Sitzungslaufzeit, Passwortwiederherstellung und MFA im Production-Projekt prüfen. Die beobachteten Test-Sitzungen hatten `not_after = NULL`; daraus lässt sich keine Production-Einstellung ableiten.
6. Produktionskonfiguration und CSP der App nach Freigabe auf das bestätigte Ziel umstellen; Build-Sperre bewusst in einem überprüften Release-Commit ersetzen. Eine weitere isolierte Abnahme dieses Release-Commits ist erforderlich.
7. Geräte vorher anmelden/freigeben. Zum angekündigten Termin Schreibwege umstellen, anonyme Frühstücksschreibrechte schliessen und nur den exakt abgenommenen Commit veröffentlichen.
8. Während des ersten Services Fehler, Rollenprüfungen, Synchronisierung und unbestätigte Aktionen beobachten. Kein Testeintrag in produktiven Gästedaten.

## Sicherer Rückfall

Vor Aktivierung: Production unverändert lassen und die Preview zurückziehen. Es gibt keinen Grund, Gastdaten zurückzusichern.

Nach späterer Aktivierung: Bei Problemen zuerst neue Gastschreibvorgänge über den App-Rolloutstatus pausieren; bestätigte Datensätze erhalten. Ein kompatibles, authentifiziertes Frontend zurückrollen. Offene UUID-Aktionen vor weiteren Änderungen abgleichen.

Anonyme Schreibrechte **nicht automatisch wieder öffnen**. Ein Rücksprung auf die alte anonyme App wäre eine gesonderte Sicherheitsentscheidung und ist nicht der Standard-Rollback. Die bisherige Roomservice-Funktionsfassung kann separat nach ihrem geprüften Rückfallplan wiederhergestellt werden; bereits gespeicherte Roomservice-Buchungen dürfen dabei nicht gelöscht oder in Tischnummern umgewandelt werden.

## Prüfungen und verbleibende Freigabepunkte

Die Abnahmeunterlagen enthalten Build-/TypeScript-/Lint-Protokolle, bestehende Regressionstests, SQL-Berechtigungstests, echte Supabase-Auth- und RPC-Prüfungen sowie Screenshots für 393×852, 1024×768, 1194×834 und Desktop. Browser-Tests verwenden ausschliesslich synthetische Zimmer und Auth-Konten. Die konkrete Commit-/Preview-Zuordnung und endgültigen Testzahlen stehen im Abschlussbericht.

Vor Production offen: separate Freigabe der zielgenauen SQL und des Deployments; reale Mitarbeiterkonten/MFA-Wiederherstellung; Inventar und Freigabe aller Hotelgeräte; Prüfung der globalen Production-Auth-Einstellungen. Browsergrössen sind geprüft, ein Vor-Ort-Test der tatsächlich eingesetzten iPads und ihrer Safari-/iPadOS-Versionen bleibt Teil der Geräteabnahme.

Die gemeinsame Gästegedächtnis-Tabelle anderer Anwendungen wird in der isolierten Preview nicht angebunden. Bemerkungen in Frühstückszimmern bleiben verfügbar. Fotoerkennung über den externen KI-Anbieter wurde nicht mit Gästefotos getestet; geprüft sind die Zugriffssperre und die unveränderte Erkennungslogik. Production verwendet bis zur gesonderten Umstellung weiterhin seine bisherigen Zugriffsregeln.
