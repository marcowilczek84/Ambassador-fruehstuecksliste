# Externe und Opera-Gäste – V4 Ergänzung

- Basis: Production 6104aee, eigener Branch breakfast-v4-external-opera-20261012.
- Bestehender Erfassungsdialog war unter „Gäste ohne Zimmer“ im Footer versteckt. Zugang jetzt als „Extern / Opera“ vor der Zimmerliste bei Suche/Filter, auch auf kleinen iPhones direkt erreichbar.
- Reproduzierter Fehler: externes Rückgängig erschien nach dem additiven Server-Merge/Neuladen wieder. Rücknahmen werden jetzt als gezielte negative Ereignisse gespeichert; Verlauf und Statistik verwenden die vorhandene effectiveArrivals-Berechnung.
- Erfassung gegen mehrfache Klicks während der Bestätigung gesperrt. Bestehende Gastarten, Personenzahl, Tischwahl und optionale Erfassung ohne Tisch bleiben erhalten. Keine Datenbankmigration.
- Preview e1fc5c0 interaktiv geprüft: Opera 3 Personen/Tisch 7 und extern 2 Personen/Tisch 5, beide nach Neuladen erhalten; gezieltes externes Rückgängig nach Neuladen weiterhin wirksam, Opera unverändert, Statistik 3 zusätzliche Gäste / 41 insgesamt. Auf 320×568 auch externe Erfassung ohne Tisch möglich.
- iPad 1194×834 und 1024×768: 44 Zimmer, fünf Spalten, kein Dokumentüberlauf; neuer Button 44 px hoch. iPhone 393×852 und 320×568: Zugang vor Zimmerliste, kein horizontaler Überlauf; Dialogaktionen erreichbar. Chromium mit isolierten Testdaten, keine physischen Geräte-/Safari-/Windows-Tests.
- Paralleler Branch breakfast-v4-checkin-room-default-20261012 bis bdec71aa4c5a6869644262f7aacd964c4fdbe4d9 erkannt. Dessen zwei Änderungen (Standard = alle noch offenen Zimmergäste; Tests für manuelle Teilanreise) unverändert und konfliktfrei in diesen Branch integriert. GitHub-Merge hat beide Branch-Spitzen als Eltern; fremder Branch bleibt unverändert.
- 16 Tests und Build nach Integration erfolgreich. Vor Production erneut Branch-/Deployment-Stand prüfen und integriertes Preview öffnen.
- Rollback für diese Ergänzung: Production 6104aee / dpl_3cqdSA7GstgAQvfXULV6afqkaNpF. Keine Gastdaten zurücksetzen.
