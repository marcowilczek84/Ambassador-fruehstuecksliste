# Ambassador Frühstück V3 — Precision Service

Stand 12.10.2026. Vom Nutzer ausdrücklich zur direkten Veröffentlichung nach QA freigegeben. Production veröffentlicht und offizieller Alias geprüft.

## Tatsächliche Versionen

- Repository: `marcowilczek84/Ambassador-fruehstuecksliste`.
- Eigener Branch: `breakfast-v3-precision-20261012`.
- Production-Commit: `a4e72fb3aba5db1a7edca69cfaf7b876ec7de483`.
- Production: https://ambassador-fruehstuecksliste.vercel.app/ — `dpl_DrrK8T3rdCwrJqNajeaheQqbS5jf`, READY, target=production.
- Geprüfte Preview desselben Commits: https://ambassador-fruehstuecksliste-fu2a6tjee-restaurant-silk.vercel.app/qa-service-review.html.
- Rückfall: `67da031181abd62198ab0d0d618ac915dc1c2354`, `dpl_91RMjj7BbPc8MPKJFDBpFeCTCwva`, https://ambassador-fruehstuecksliste-j2ut2j0sd-restaurant-silk.vercel.app.

Vor Beginn und vor Veröffentlichung Production sowie Branchspitzen verglichen. Keine fremden Branches zusammengeführt. `main` ist älter und keine Release-Quelle. Ein erster Preview-Aufruf mit SHA als Ref scheiterte vor dem Build (`git_info_fail`); Branch plus exakt gebundener SHA wurde erfolgreich gebaut. Kein Kontingentproblem, keine Änderung der Git-/Zugriffsrechte.

## Gestaltung und praktischer Nutzen

- Funktionale Sans Serif statt dekorativer Serifenziffern. Zimmernummern 23 px/600, Namen 13 bzw. 14 px; Original-Hotellogo und bestehendes Frühstücksicon erhalten. Auch der App-Name in der Bereichswahl ist jetzt bewusst Sans Serif.
- Ruhige Zeilen mit einer feinen unteren Trennlinie, keine umlaufenden Kartenrahmen oder Schatten. Originale Zweiteilung und Statusbalken bleiben erhalten.
- Suchfeld und Hauptaktionen auf iPad von gemessenen 36 auf 44 px Höhe vergrößert. Kopfbereich bleibt kompakt. Gelbe Fortschrittslinie erhalten.
- Vollständig erfasste Zimmer ruhiger, aber lesbar; offene und teilweise erfasste Zimmer mit funktionalem Gelb und eindeutigem Erfassungsstand.
- Fünf feste Zimmergruppen bleiben erhalten: Die bekannte Position jedes Zimmers und die vollständige Sichtbarkeit sind für dieses Hotel sinnvoller als eine neue Reihenfolge. 44 echte Zimmer, 55 bleibt leere, nicht interaktive Position.
- Der Offenfilter hat eine stabile Beschriftung und einen sichtbaren Auswahlzustand. Suche und Filter bilden eine Schnittmenge. Erledigte, nicht inkludierte, abgereiste und leere Zimmer sind ausgeschlossen; teilweise erfasste inklusive Zimmer bleiben sichtbar.
- Zuvor zeigte die Suche nach „Berger“ trotz aktivem Offenfilter das nicht inkludierte Zimmer 22. In V3 korrekt null Treffer einschließlich sichtbarer Rückmeldung. Versteckte Zimmer zählen nicht mehr als Suchtreffer.
- Auf großen Desktops begrenzt die Oberfläche die Inhaltsbreite auf 1800 px und die Zimmerübersicht auf 880 px Höhe; auf dem Telefon bleibt die native vertikale Liste.

## Tatsächlich ausgeführte Prüfungen

- `npm run build`: Next-Production-Build und TypeScript erfolgreich. Beide Vercel-Builds READY.
- `npm test`: fünf automatisierte Tests bestanden: Offen-/Teil-/Abschlussstatus, Ausschlussregeln, Filterzustand/Suchbegriff, Nulltrefferanzeige und Bestandsschutz.
- Bestandsschutz prüft SHA-256 von 26 unveränderten Dateien einschließlich nativer App-Bundles und Serverrouten sowie drei unveränderter Funktionen für Service-Animation, Check-in-Dialog und Tagesdaten.
- Echte Chromium-Preview mit isolierten, ausschließlich fiktiven Daten und blockierten API-/Schreibzugriffen. 44 Zimmer in fünf Gruppen ohne horizontalen oder vertikalen Überlauf bei 1194×834, 1024×768 und zusätzlich 1024×748. Die Testhülle reserviert 44 bzw. 20 px für Systemflächen; die tatsächlich verfügbare App-Fläche ist daher kleiner. Bei 1024×748 verbleiben 56,22 px Kartenhöhe und mindestens 1,22 px Abstand zwischen Frühstücks- und Statuszeile.
- 1194er-App-Fläche: Suchfeld und Hauptaktionen jeweils 44 px, vollständige Übersicht ohne Scrollen.
- 320×568: kein horizontaler Überlauf, Suchfeld 46 px; Check-in-Dialog 294 px breit, feste 48-px-Aktionen. Dialoginhalt kann vertikal gescrollt werden.
- 2560×1440: fünf Gruppen und 44 Zimmer, 1800 px Inhaltsbreite, 880 px Übersicht, 16-px-Gastnamen, kein Überlauf. Kleiner Desktop wird durch die 1024er-Prüfung abgedeckt.
- Zimmer 20: einen von zwei Gästen an Tisch 4 erfasst; Teilstatus und erneutes Öffnen geprüft.
- Zimmer 23: unter aktivem Offenfilter und Suchbegriff „23“ den fehlenden Gast erfasst. Nach Bestätigung ausgeblendet; Suchbegriff und Filter erhalten, null Treffer. Keine Zurücksetzung des Arbeitszustands.
- Roomservice ausgewählt, anschließend abgebrochen: Zimmer 21 bleibt unverändert offen.
- Rezeption: Gasteditor geöffnet, fiktiven Namen geändert, Schließen ausgelöst. Warnung vor ungespeicherten Änderungen vorhanden; Verwerfen erhält die ursprünglichen Daten.
- Bereichswahl mit Original-Logo und Original-App-Icon geprüft. Start- und Service-Animation unverändert.
- Production lesend geprüft: Startseite, Bereichswahl, Serviceübersicht mit 44 Zimmerpositionen, Hub-Link und offizieller Alias. Keine produktiven Gastdaten geschrieben. Keine App-Fehler in Browserkonsole oder gefiltertem Vercel-Fehlerprotokoll im geprüften Zeitfenster gefunden.

## Grenzen

Keine physische Safari-/iPad-/iPhone- oder Windows-Geräteprüfung; die Auflösungen wurden in Chromium geprüft. Sehr lange Namen mehrerer Gäste können in der vollständigen iPad-Übersicht weiterhin gekürzt erscheinen; Öffnen des Zimmers zeigt die vollständigen Namen. Namen wurden nicht unter 13 px verkleinert.

Mews-Import, Export, Login, API, Berechnung und persistente Synchronisierung wurden nicht neu implementiert und nicht erneut vollständig Ende-zu-Ende gegen Production getestet. Der native Code ist unverändert und per Hash abgesichert. Der isolierte Browsertest speichert ausschließlich im Arbeitsspeicher; er behauptet keinen neuen Nachweis geräteübergreifender Synchronisierung. Die bereits vorhandene Meldung „Gastinfo in diesem Release nicht verfügbar“ wird durch V3 nicht geändert.

## Betrieb und Rückfall

Bei kritischer Regression auf das oben genannte vorherige Production-Deployment zurücksetzen. Keine Datenmigration und keine Änderungen an Authentifizierung oder Speicherpfaden. Hub, Trinkgeld und Inside wurden in diesem Frühstücksrelease nicht verändert. Zentrale Familien-Dokumentation: `silk-service`, Branch `silk-inside-v23-editorial-20261012`.
