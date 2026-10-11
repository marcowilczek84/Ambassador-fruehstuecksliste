# SILK Frühstück – Einstieg in das Master-Projekt

Stand: 11.10.2026. Die zentrale Ambassador/SILK-Projektführung und verbindliche Dokumentation liegen im bestehenden Repository **marcowilczek84/silk-service**, Branch **ambassador-master-project-20261011**.

- [PROJECT-STATUS.md](https://github.com/marcowilczek84/silk-service/blob/ambassador-master-project-20261011/PROJECT-STATUS.md)
- [AMBASSADOR-DESIGN-SYSTEM.md](https://github.com/marcowilczek84/silk-service/blob/ambassador-master-project-20261011/AMBASSADOR-DESIGN-SYSTEM.md)
- [RELEASE-HISTORY.md](https://github.com/marcowilczek84/silk-service/blob/ambassador-master-project-20261011/RELEASE-HISTORY.md)

Production dieser Übernahme: **4c9418f84267be57c99a46520d4835ef74b9b1f8**, Deployment **dpl_5WaxzGRNEEd8cbqsks4bFb1uvdCW**, bestehende Domain unverändert. `main` ist älter und darf nicht ungeprüft als Releasebasis verwendet werden.

Der Nutzer bestätigte den Abschluss des anderen Zimmerkarten-Chats. Dessen finaler Quellstand **9824d70df027990579f1360743809754c4be39e1** auf `ipad-service-reference-cards-20261011` bleibt unverändert. Die gezielt geprüfte Zusammenführung mit den veröffentlichten Auswahl-/Menüregeln liegt auf **ambassador-master-integration-20261011**, Runtime-Commit **ab267724cb9ebac282aeeb6852215d77d68220ec**.

[Geprüfte Preview mit isolierten fiktiven Daten](https://ambassador-fruehstuecksliste-3tj9e364b-restaurant-silk.vercel.app/qa-service-review.html?mode=small). Abnahme und Production-Freigabe sind offen. Spätere reine Dokumentations-/Whitespace-Commits ändern diesen geprüften Runtime-Stand nicht.

44 reale Zimmer, fünf feste Spalten, Zimmer 55 inert; linke Zimmer-/Personenspalte und rechter Informationsbereich. Kein Scrollen der iPad-Serviceübersicht bei 1024×748 und 1194×834. Große Auswahlflächen mit Rahmen und dezentem Schatten; normale Buttons und Zimmerkarten ohne Schatten. Mews-Import, Speicherung, Frühstückslogik und Check-in nicht verändern.

Vor jeder Folgeänderung aktuelle Branch-Spitzen, Production-Alias und mögliche andere Work-Chats prüfen. Kein Force-Push, kein ungeprüfter Merge und keine Production-Veröffentlichung ohne ausdrückliche Nutzerfreigabe. Details, getestete Fälle und ehrliche Testgrenzen stehen in der zentralen Dokumentation.
