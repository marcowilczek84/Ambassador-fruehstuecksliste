# Premium UX – Entwicklungsstand 12.10.2026

Status: funktionsfähige Preview, noch nicht gestalterisch abgenommen. Keine Production-Veröffentlichung.

## Grundlage und Zuständigkeit

- Auftrag: nur Ambassador Frühstück und SILK Inside. Hub und Trinkgeld unverändert.
- Referenz: „Elegante Tablet-Apps für Gastfreundschaft.png“, gemeinsame iPad-Visualisierung vom 12.10.2026. Gestaltung, nicht erfundene Navigation/Inhalte übernommen.
- Inside-Basis: 13d5e813aa42d3976a12c7166c18618b994ff9e7; Production weiterhin 9e9925acc649b12726490654d487872338ab9f29.
- Frühstück-Basis/Production: 63a1483b03758f2a69e4041252ba895568b405d0.
- Zwei getrennte Repository-Branches: jeweils `premium-ux-20261012`. Vor Beginn keine offenen PRs; Basisdateien vollständig gegen GitHub-Blobs geprüft (300 Inside, 126 Frühstück).
- Verantwortung Umsetzung/Prüfung: Codex; visuelle Abnahme und Production-Freigabe: Marco Wilczek.

## Designentscheidungen

1. Frühstück erhält die volle Arbeitsbreite für fünf feste Zimmergruppen. Eine zusätzliche Seitenleiste würde die Namen unnötig verkürzen.
2. 44 Zimmer, 9 Positionen je Gruppe, 55 als inerte Leerstelle. Feste Informationsachsen, schlankere Nummern, sehr feine Konturen, keine Kartenschatten. Der Kopfbereich wird zugunsten lesbarer Karten kompakter.
3. Namen bleiben 13 px auf dem kleinen bzw. 14 px auf dem großen iPad. Keine weitere Verkleinerung, um überlange Namen vollständig zu erzwingen. Zwei Namenszeilen, vorhandenes +1 bei weiteren Personen; vollständige Namen im Zimmerdialog.
4. Inside: schmale, direkte Seitennavigation auf iPad/Desktop, bestehende untere Navigation auf dem Telefon. Verwaltung direkt in der Seitenleiste und weiterhin im Header.
5. Editorialer Einstieg mit einem vorhandenen FOOD-BIBLE-Gericht, echten vorhandenen Fotos und zwei gleichwertigen Wochenempfehlungen. Kein künstliches Gericht, keine künstlichen Kennzahlen.
6. Aktueller Service bleibt an die bestehende Zeit-/Kartenauswahl gebunden. Nicht eindeutig verfügbare PDFs werden nicht durch beliebige Karten ersetzt. Gericht-Hero ist als FOOD-BIBLE-Inhalt bezeichnet, ohne unbelegte Saisonzusage.
7. Originales Ambassador-Logo links im Inside-Header auf ausdrücklichen Zusatzwunsch; originale SILK-/Inside-Gruppe mittig. Reinweiß, Anthrazit, Türkis; Serif Regular für Editorial-Überschriften, Serif Italic Regular für den App-Namen.
8. Verwaltung nach Karte/Restaurantwissen, Bar/Empfehlungen und Service gegliedert. Bestehende Ziele und Aktionen erhalten. Keine neue Datenverwaltung.
9. Nutzerwahl: Old Fashioned als Wochen-Cocktail in der isolierten Preview, dort bereits gespeichert. Passendes lizenziertes Foto ergänzt; dezente Kennzeichnung als Serviervorschlag. Originale Produktfotos haben Vorrang. Siehe Bildnachweise.

## Schutz des Bestands

Frühstücks-JavaScript, Mews-Import, Check-in, Service-Animation, Speicherung, API und Datenbestände unverändert. Nur letzter CSS-Adapter und Einbindung; QA-Seiten getrennt.
Inside-API, Supabase-Dateien, Authentifizierung, Rezepturen, Import, Dokumentenverarbeitung, Persistenz und Berechnungen unverändert. Neue Startseite liest die vorhandene Serviceprojektion; keine Entwürfe als fertiges Gericht veröffentlicht. Kein Datenbank- oder Production-Schreibzugriff im Redesign.

## Bereits tatsächlich geprüft

- 1024 × 748: 44 Zimmer / fünf Gruppen, App-Innenhöhe 728 px mit 20 px simulierter Systemreserve; Content 1024 × 552 px ohne Überlauf, Karten mindestens 57,55 px, keine Überschneidung von Frühstück und Erfassung.
- 1194 × 834: 44 Zimmer / fünf Gruppen, App-Innenhöhe 790 px mit 44 px simulierter Systemreserve; Content 1194 × 600 px ohne Überlauf, Karten 62 px, keine Textüberschneidung.
- Zimmer 55 bleibt `aria-hidden` und `inert`, kein Button.
- Isolierter Teil-Check-in Zimmer 20: ein fiktiver Gast, Tisch 4; Karte zeigt 1 von 2 erfasst. Keine Server-Schreibzugriffe möglich.
- Filter „Nur offene“: 14 relevante Zimmer sichtbar, kein nicht inkludiertes oder vollständig erfasstes Zimmer sichtbar.
- Frühstück Telefonbreite 393 px: keine horizontale Überbreite. Mobile Listenstruktur und Dialoge bleiben erhalten.
- Inside 1194 × 834 und 1024 × 748: Startseite, fünf Hauptinhalte, Fotos, Navigation ohne horizontalen Überlauf; kleiner iPad-Content 858 × 688 px ohne vertikalen Überlauf.
- Hero öffnet korrekt das bestehende Gerichtwissen. Allergie-Check über neue Navigation erreichbar; Milch/Laktose-Auswahl zeigt dokumentierte Angaben und Küchenhinweise.
- Wochen-Cocktail öffnet Old Fashioned; Detail zeigt „Wochenempfehlung entfernen“, somit gespeicherte Empfehlung, keine bloße Bildattrappe.
- 18 vorhandene Node-Prüfungen bestanden: Allergieklassifizierung, aktuelle Kartenwahl, Dokumenten-/FOOD-BIBLE-Lebenszyklus, Dokumentenersatz, Sessions/CSRF und Zugriffsregeln. Ein erster Lauf fehlte wegen nicht verlinkter jsdom-Abhängigkeit; nach Wiederverwendung der vorhandenen lokalen Abhängigkeiten bestanden alle 18.

## Grenzen

- Chromium-Viewportprüfung, kein physisches iPad/iPhone und kein Safari- oder Windows-Betriebssystemtest.
- Sehr lange Namen werden in der 44-Zimmer-Übersicht gekürzt. Kein Ausblenden ganzer Zimmer und keine kleinere Schrift als oben angegeben.
- Isolierte Inside-Preview hat einen kleineren Datenbestand als Production. Das aktuell fällige Mittagsmenü ist dort nicht eindeutig als gültige Original-PDF hinterlegt; dies wird sichtbar angezeigt. Der Datenbestand wird dafür nicht aus Production kopiert.
- Neuer Mews-Import und vollständiger PDF-Neuimport nicht erneut ausgeführt; betroffene Logik blieb unverändert, bestehende gezielte Regressionstests liefen.
- Finale Desktop-Prüfung und Screenshots folgen im separaten QA-Nachtrag.
