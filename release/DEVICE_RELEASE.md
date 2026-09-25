# Gerätefreischaltung: Production-Paket (nur Vorbereitung)

**Nicht ausführen, solange die Staging-Web-App einschließlich Neustart und Widerruf nicht vollständig geprüft ist.** Production wurde für dieses Paket nur gelesen.

## Bestand und Freigabegrenzen

- Production-Supabase: `xgbbwnmqgpwxxftnjrkc`; Staging: `jeuvmhahanaulvrnasgq`. Keine Staging-Konten, Codes, Profil-/Aufenthalts-/Bemerkungsdaten oder Secrets exportieren.
- Anonyme Production-Policies für `breakfast_lists` und `guest_preferences` erlauben momentan SELECT/INSERT/UPDATE/DELETE. Die ältere Tabelle `breakfast_list` besitzt ebenfalls offene `public`-Policies und enthält laut erneuter Prüfung am 25.09.2026 einen Datensatz; alle drei Tabellen brauchen den Device-Guard.
- Gastgedächtnis-Tabellen existieren in Production noch nicht. Elf historische Zimmernotiz-Quellen: zwei eindeutig STAY, neun ungeklärt; niemals automatisch PERSISTENT.
- Frei wechselbare Bedienansichten SERVICE/REZEPTION erhalten identische *normale* Rechte auf dem Gerät. Keine Identity-/Legacy-/Merge-RPCs freigeben.

## Vorbereitete SQL-Dateien und Reihenfolge

1. Vorher aktuellen Production-Zustand lesen und einen **verifizierten** DB-Dump der bestehenden Tabellen `breakfast_lists`, `guest_preferences`, `breakfast_list` sowie Schema und Policies sicher ablegen; vorheriges Vercel-Deployment notieren. Kein Cutover ohne Restore-Probe und geprüfte Notiz-Quellzahl. Dump ist noch nicht vorhanden.
2. `guest_memory_production_schema.sql` (additive Tabellen, Funktionen, Retention, RLS; niemals Staging-Testdatensätze) und danach `device_pairing_structure.sql` (Codes, Gerätebindungen, Auth-/RLS-Helfer) vorbereiten. Die technische Geräteidentität entsteht ausschließlich nach einem einmalig verwendbaren, serverseitig geprüften Code. Staging-Testaccounts bleiben in Staging.
3. Die Edge-Funktion `device-enroll` für Production mit **eigenen** Production-Umgebungsgeheimnissen getrennt deployen. Ihre interne Auth-Kennung darf keine Staging-E-Mail-Adresse übernehmen; der Browser sieht keine E-Mail und kein Passwort. Codeausgabe nur durch einen berechtigten Administrator außerhalb der öffentlichen App; Code 128 Bit zufällig, SHA-256-Hash in der Datenbank, kurze Laufzeit. Neue Hotelgeräte mit Production-Codes koppeln, während die bisherige App noch läuft.
4. Production-App-Bundle mit **Production**-URL und Publishable Key bauen. Das bisherige `staging-config.js` und alle Staging-Refs aus dem Production-Bundle entfernen; Geräte-Session-Client und Gastgedächtnis an Production anbinden. Noch nicht fertig: `public/device-auth.js` und `public/guest-memory.js` sind bewusst ausschließlich für Staging festgelegt.
5. In einer geplanten Umschaltung `device_pairing_cutover.sql` anwenden: restriktive Geräte-Policies AND bestehende Frühstückspolicies, `merge_breakfast_changes` nur für gekoppelte Geräte, Gastgedächtnis-RPCs mit Gerätenachweis. App danach zügig veröffentlichen. Die öffentliche App-URL allein darf keine Gastdaten liefern.
6. `production_legacy_backfill.sql` erst nach Vorher-/Nachher-Zählung ausführen; 2 eindeutig zuordenbare STAY-Notizen, 9 ungeklärte Quellen laut Bestandsaudit, alte `room.note`-Werte erhalten. Falls die Zählung abweicht, stoppen und erneut prüfen.
7. Sofortiger Smoke-Test auf gekoppeltem und ungekoppeltem Gerät: Mews-Import, Liste, Check-in, Rezeption, Journal, Synchronisation, Tagesabschluss, direkte anonyme REST-/RPC-Anfragen und Gerätewiderruf. Kein Production-Deployment ohne separate Nutzerfreigabe.

## Rollback

- Vor Cutover: additive Tabellen/Device-Identitäten stehen lassen; alte App und bestehende Frühstückslisten laufen weiter.
- Falls Cutover/Deployment misslingt: bisherigen Vercel-Alias wiederherstellen; restriktive Device-Policies auf `breakfast_lists` und `guest_preferences` kontrolliert entfernen und ursprüngliche RPC-Definition aus dem verifizierten Schema-Backup wiederherstellen. Das öffnet die *vorherigen* anonymen Rechte und ist nur eine zeitlich begrenzte Rücknahme für den laufenden Betrieb, keine akzeptierte Dauerlösung.
- Neue Gastgedächtnis-Tabellen und Legacy-Felder niemals automatisch löschen. Neu geschriebene Journal-Daten vor einem längeren Rückbau separat sichern; alte App schreibt sie nicht zurück in `room.note`.

**Status:** Staging-Datenbank-/HTTP-Tests teilweise bestanden; Web-App-E2E auf einem tatsächlich gekoppelten Browsergerät und Browser-Neustart noch offen. Production-Runtime-Bundle und Production-Dump fehlen. Release noch nicht freigabefähig.

## Einmalcode ausgeben und Gerät widerrufen (später nur durch Administrator)

Für das jeweilige Hotel mit dessen tatsächlich bestätigter UUID aus `gm_hotels`:

```sql
with token as materialized (
  select encode(extensions.gen_random_bytes(16), 'hex') as code
), saved as (
  insert into public.gm_device_codes (hotel_id,code_hash,expires_at)
  select '<HOTEL_UUID>'::uuid,extensions.digest(token.code,'sha256'),
         now()+interval '15 minutes' from token returning id
)
select token.code from token,saved;
```

Den ausgegebenen Code nur auf dem vorgesehenen Hotelgerät eingeben. Er wird nicht wieder angezeigt und ist nach Verwendung oder 15 Minuten ungültig. Widerruf durch Administrator: `update public.gm_devices set revoked_at=clock_timestamp() where user_id='<DEVICE_USER_UUID>'::uuid;`. Alle Gastdaten-Policies prüfen bei jeder Anfrage `revoked_at` direkt in der Datenbank; ein bereits ausgestelltes JWT wird dadurch **nicht** zu einer gültigen Datenberechtigung.
