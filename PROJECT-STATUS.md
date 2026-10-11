# Ambassador Frühstück – Arbeitsstand

11.10.2026, Europe/Zurich. Production zuletzt verifiziert: `e74d850597d6f68dbe182ef92cf235950690c279`. Neue, noch nicht veröffentlichte Korrektur auf `ambassador-start-header-20261011`, direkt auf diesem Production-Commit aufgebaut.

Der neue Nutzerauftrag korrigiert den tatsächlich aktiven React-Ladebildschirm (altes Tassenlogo), vereinheitlicht die Starttypografie und ergänzt einen Hub-Link im Header. Der kurze App-Name lautet Frühstück; Service/Rezeption bleiben als Arbeitsbereich sichtbar. Das originale Hotellogo führt zur Bereichswahl. Der Zusatz-App-Verweis entfällt. Zimmerkarten-Geometrie, Import, Check-in, Berechnung und Speicherung unverändert.

Kanonische Dokumentation im Repository `marcowilczek84/silk-service`, Branch `ambassador-start-header-20261011`:

- [Projektstatus](https://github.com/marcowilczek84/silk-service/blob/ambassador-start-header-20261011/PROJECT-STATUS.md)
- [Designsystem](https://github.com/marcowilczek84/silk-service/blob/ambassador-start-header-20261011/AMBASSADOR-DESIGN-SYSTEM.md)
- [Release-Historie](https://github.com/marcowilczek84/silk-service/blob/ambassador-start-header-20261011/RELEASE-HISTORY.md)
- [Gezielte Prüfungen](https://github.com/marcowilczek84/silk-service/blob/ambassador-start-header-20261011/docs/HEADER-STARTSEITEN-QA-20261011.md)

Syntax und isolierte Header-DOM-Prüfungen bestanden. Im aktiven kompilierten Programm unterscheidet sich ausschließlich das Markup des Ladebildschirms. Neue Browserprüfung einschließlich Hydration und 44-Zimmer-Geometrie bei 1024 × 748 / 1194 × 834 noch offen. Ältere Screenshots und bestandene Geometrieprüfungen gelten für den vorherigen Stand, nicht als Abnahme dieser Änderung. Vercel-Neudeployments sind wegen des bereits gemeldeten Tageslimits blockiert. Keine neue Production-Veröffentlichung.
