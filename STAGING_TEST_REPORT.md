# Gastgedächtnis: Staging-Prüfung, 24.09.2026

Arbeitsbranch `guest-memory-preview-20260924`; getrenntes Supabase-Projekt
`jeuvmhahanaulvrnasgq` mit synthetischen Daten. Production wurde nicht verändert.
Die Dateien in `supabase/migrations/` sind **Staging-spezifisch**; insbesondere
die leere Frühstücks-Kompatibilität und deren `anon`-Rechte dürfen nicht auf
Production angewandt werden.

## Tatsächlich geprüft

- `npm run build` und Syntaxprüfung von `guest-memory.js`: erfolgreich.
- Staging enthält zwölf Tabellen mit aktiviertem RLS und die registrierten
  Gastgedächtnis-Migrationen; der tägliche Cron-Job ist aktiv.
- SQL mit simulierter authentifizierter SERVICE-Rolle: Merge,
  Identitätsbestätigung, Legacy-Zuordnung und Legacy-Löschung werden mit
  SQLSTATE 42501 abgelehnt. RECEPTION konnte Legacy-Löschung in einer
  zurückgerollten Transaktion ausführen.
- Zwei gleichnamige synthetische Gäste mit identischen Reisedaten in Zimmer
  31 und 32 erhalten durch `gm_upsert_stay_checked` zwei Stay-UUIDs.
  Zimmerwechsel 31 → 32 bei vollständigem Tages-Snapshot erhält eine UUID.
  Beide Versuche wurden nach der Prüfung zurückgerollt.
- Alter Import-RPC für `authenticated` gesperrt; neuer Snapshot-RPC ist für
  `authenticated`, aber nicht für `anon` ausführbar und prüft die Mitgliedschaft.
- Retention-Funktion entfernte eine 31 Tage zuvor soft-gelöschte synthetische
  Notiz und einen synthetischen Aufenthalt aus 2024 samt STAY-Notiz;
  beide Prüftransaktionen wurden zurückgerollt.
- Vorherige Staging-Prüfungen: einzelne Notiz anlegen/bearbeiten/soft-delete,
  `created_at` erhalten; getrennte Profile und Notizen; Merge und Restore;
  Ablehnung eines Kandidaten und erneuter Tagesimport; Legacy-Backfill
  einmal eindeutig und einmal ungeklärt, wiederholter Lauf ohne Duplikate.
  Der aktuelle Staging-Bestand enthält zwei Legacy-Quellen, eine ungeklärte
  Notiz und einen protokollierten, wiederhergestellten Merge.

## Noch nicht nachgewiesen

- Echte Anmeldung durch die laufende Web-App mit SERVICE und REZEPTION.
- Direkte REST-Anfragen mit echten Auth-JWTs statt SQL-Rollensimulation.
- Zwei unabhängige Browserprofile und A→B/B→A-Synchronisation.
- UI-E2E für Kandidaten, Merge-Vorschau, Journal, iPhone, iPad und Tastatur.
- Ausführung des Cron-Jobs zu seinem geplanten Zeitpunkt (die Funktion selbst
  wurde mit abgelaufenen synthetischen Datensätzen geprüft).
- Veröffentlichte Preview und Vercel-Deployment-ID. Direkter GitHub-Push
  benötigt eine hier nicht vorhandene Anmeldung; der verfügbare Vercel-
  Deployment-Aufruf antwortet mit „Tool deploy_to_vercel not found“.

Die unter „Noch nicht nachgewiesen“ genannten Fälle sind keine Freigabe für
eine Production-Migration.
