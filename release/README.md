# Ambassador Gastgedächtnis: Production Release Candidate (vor Freigabe)

**Status:** nur vorbereitet; Production-Datenbank, Auth, Vercel-Environment
und Production-Deployment wurden in diesem Lauf nicht verändert.

## Herkunft und Trennung

- Ausgangspunkt: Gastgedächtnis-Preview-Branch, lokaler Commit `12f1d781a6aa28441101b3f70e63ca3a9c50269b` (gleicher Baum wie veröffentlichter Remote-Commit `8889100a7f13d51a9f09e03bed8c99bb8857c176`).
- Production Supabase: `xgbbwnmqgpwxxftnjrkc`; Staging Supabase: **nur** in der separaten Preview, nicht in diesem App-Bundle.
- Production Schema SQL: `guest_memory_production_schema.sql`, aus den zehn in Staging geprüften Schema-/Funktionsdateien zusammengestellt. Die komplette Staging-Frühstückskompatibilität und die gefährliche pauschale `REVOKE`-Anweisung für alle öffentlichen Tabellen sind ausgeschlossen.
- `production_legacy_backfill.sql`: konservative Übernahme der bestehenden `room.note`-Quellen. Der historische Quellbestand bleibt erhalten.

## Read-only Bestandsaufnahme 25.09.2026

- 27 `breakfast_lists`-Tagesdatensätze, 20 `guest_preferences`-Zeilen, leere `breakfast_list`-Alttabelle; Production enthält zugleich Tabellen der Trinkgeld-App. Diese bestehenden Tabellen und Policies bleiben unverändert.
- 11 gespeicherte Zimmernotiz-Quellen in Tages-Snapshots. Zwei sind eindeutig einem einzelnen Gast und einem gültigen Aufenthaltsdatum zuordenbar; neun werden konservativ als ungeklärte Legacy-Notizen erhalten. Drei Notizen haben strukturell einen Gast und Daten, davon liegt eine außerhalb ihres Aufenthaltsdatums und bleibt ungeklärt.
- `guest_preferences.guest_info` enthält Arrays mit 38 Einträgen in sechs nichtleeren Zeilen; deren Elemente sind Strings, kein Beleg für zusätzliche `room.note`-Journalnotizen. Die Tabelle bleibt erhalten.
- 16 bestehende anonyme Auth-Nutzer; keine Production-Arbeitsrollen-Mitgliedschaften. Neue Rollen dürfen diese anonymen Sessions nicht als Auth-Ersatz verwenden.
- Die vorhandene `breakfast_lists`-RLS und ihr `merge_breakfast_changes`-RPC bleiben erhalten. Die neue RLS gilt nur für die neuen Gastgedächtnis-Tabellen.

## Schritte nach gesonderter Freigabe

1. **Preflight und Sicherung:** Production-Dump von Schema, `breakfast_lists`, `breakfast_list` und `guest_preferences` über eine sichere Production-DB-Verbindung; eingeschränkter Speicherort, Integritätsprüfung und gleiche Quellzählungen. Vorherige Vercel-Production-Deployment-ID `dpl_4S24sAaivmCZrkSPc1vSvxMmH3rt` sichern. Ist ein verifizierbares Backup nicht möglich oder haben sich Quellzählungen geändert, hier stoppen.
2. **Additives Schema:** `guest_memory_production_schema.sql` prüfen und nur nach Freigabe anwenden. Elf neue RLS-geschützte Tabellen, privates Schema, Indizes, Funktionen und Trigger; keine bestehenden Frühstücks- oder Trinkgeldtabellen überschreiben.
3. **Production-Hotel und Rollen:** genau einen Production-Hotel-Datensatz `Ambassador Hotel Zürich` plus Standardfristen erzeugen. Zwei neue nicht-anonyme Supabase-Auth-Arbeitszugänge für SERVICE und RECEPTION sicher anlegen und in `gm_memberships` zuordnen. Die E-Mail-Kennungen bleiben ausschließlich technische Supabase-Auth-IDs: Mitarbeitende wählen den Bereich und geben nur das zugehörige Passwort ein. Keine Staging-Testkonten kopieren; Passwörter über sicheren Kanal festlegen.
4. **Legacy:** `production_legacy_backfill.sql` vor Veröffentlichung ausführen, nur wenn Quellzählung weiterhin 11 ist. Erwartet zwei STAY-Quellen und neun ungeklärte Quellen; keine PERSISTENT-Zuweisung. Bei anderer Anzahl Transaktion abbrechen und neu auditieren. Alte `room.note`-Daten nicht entfernen.
5. **Config:** Vercel Production-Variablen `AMBASSADOR_GM_PRODUCTION_URL=https://xgbbwnmqgpwxxftnjrkc.supabase.co`, `AMBASSADOR_GM_PRODUCTION_PUBLISHABLE_KEY` sowie `AMBASSADOR_GM_SERVICE_LOGIN` und `AMBASSADOR_GM_RECEPTION_LOGIN` für die technischen Auth-Kennungen einrichten. Kein privater `service_role`-Key im Client. `/api/guest-memory-config` liefert Konfiguration nur für das erwartete Production-Projekt mit vollständiger Rollenkonfiguration, sonst `null`.
6. **Deploy und Smoke-Test:** Release Candidate über den bestehenden Vercel-Production-Projektlink deployen; Startseite, Service, Rezeption, Tagesliste, Import, Check-in, Gastdetail, STAY/PERSISTENT, Rollen, Legacy-Bemerkungen und Tagesabschluss sofort prüfen. Erst nach erfolgreichem Smoke-Test Freigabe protokollieren.

## Berechtigungen und Retention

- RLS leitet SERVICE/RECEPTION ausschließlich aus einer aktiven `gm_memberships`-Zeile für `auth.uid()` plus echter nicht-anonymer Supabase-Session ab. SERVICE sieht aktuelle STAY-Daten und bestätigte PERSISTENT-Informationen, darf STAY-Notizen pflegen und dauerhafte Informationen anlegen; Identitätsentscheidungen, Merge und Legacy-Zuordnung sind nur über RECEPTION-berechtigte RPCs möglich. Löschung dauerhafter Informationen bleibt RECEPTION vorbehalten.
- `gm_settings`: Aufenthaltshistorie 24 Monate, gelöschte Notizen 30 Tage. Der Production-Cron `ambassador-gm-production-retention` ruft die geschützte Bereinigungsfunktion täglich auf. PERSISTENT bleibt bis zur bewussten Löschung/Profilbereinigung erhalten.

## Rollback

- Fehlschlag vor Deployment: nicht deployen; neue additive Tabellen können für Analyse stehen bleiben. Die alten Datenpfade und Tabellen wurden nicht entfernt.
- Fehlschlag nach Deployment: Vercel-Alias auf `dpl_4S24sAaivmCZrkSPc1vSvxMmH3rt` zurücksetzen, Production-Gastgedächtnis-Konfiguration deaktivieren, bisherige `breakfast_lists` und `guest_preferences` weiterverwenden. Neue Notizen im Journal gegebenenfalls vor einem längerfristigen Rückbau separat sichern; ein reines App-Rollback synchronisiert sie nicht automatisch zurück in `room.note`.
- **Keine automatische Tabellenlöschung als Rollback.** Erst nach Datenabgleich und separater Prüfung entfernen.

## Grenzen

- Gate 4 wurde vom Nutzer auf dem iPhone mit Safari/SERVICE und Chrome/RECEPTION bestanden. Der direkte RLS-Test mit echtem Web-App-Service-JWT (Gate 1) ist nicht geprüft. Frühere Staging-SQL-Rollentests ersetzen das nicht.
- Die alte Reaktions-/Bearbeitungslogik für das einzelne `room.note` ist intern im älteren App-Code noch vorhanden; `guest-memory.css` versteckt die alte Eingabeoberfläche. Das Journal ist in den getesteten Gastdetails der sichtbare Workflow. Kein riskantes Refactoring vor dem ersten Release.
- Beim Runtime-Endpoint fehlt ohne Production-Environment absichtlich die Konfiguration. Ein erfolgreicher Build beweist noch keinen Production-Login oder eine angewendete Migration.
