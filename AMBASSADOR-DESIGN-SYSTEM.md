# Ergänzung 12.10.2026 — Designsystem 1.5

Diese Ergänzung hat Vorrang vor widersprechenden historischen Regeln weiter unten. Gemeinsame Marke bedeutet unterschiedliche, fachlich geeignete Oberflächen.

- **Ambassador Frühstück V3:** funktionale Sans Serif auch für App-Titel und Zimmernummern; kein dekoratives Serif Italic in dieser App. Originales Hotellogo und Original-Frühstücksicon erhalten. Klare Ziffern 600, Namen 400, Hauptaktionen mindestens 44 px. Fünf feste Zimmergruppen, dünne untere Trennlinien statt umlaufender Kartenrahmen. Gelb ausschließlich für offene/teilweise inklusive Frühstücke und die Fortschrittslinie. Abgeschlossene Zimmer neutral und lesbar. Suche und Offenfilter immer als Schnittmenge.
- **SILK Inside V2.3:** freigegebene Premium-Homepage unverändert. Editorial-Qualität auf Gerichte, Weine und Cocktails erweitern; echte Fotos und vorhandene Inhalte. PDF-Zustand bei Detailansichten erhalten. Großzügige adaptive Details, keine schmale rechte Wissensspalte als Hauptansicht.
- **Hub und Trinkgeld:** durch diese Ergänzung keine Runtime-Änderung. Hub-Varianten bleiben erhalten; Nutzervorliebe A — Cinematic. Keine pauschale Übertragung der operativen Frühstückstypografie auf Inside/Hub/Trinkgeld.
- Weiß #FFFFFF, Anthrazit #202326 und Türkis #1C777B bleiben verbindlich. Keine neuen generischen Markenicons, keine warmen Hintergründe.

Veröffentlichte Versionen, QA-Grenzen und Zuständigkeiten: [PROJECT-STATUS.md](PROJECT-STATUS.md).

---

# AMBASSADOR DIGITAL – verbindliches Designsystem

Stand: 12.10.2026 · Version 1.4 · Freigegebene Header-/Startseitenkorrekturen und Inside-Service-Dashboard veröffentlicht. Die acht verbindlichen Designentscheidungen und die spezialisierte Zimmerkartenstruktur bleiben unverändert. Dieses Dokument ersetzt widersprechende ältere Designregeln; konkrete Releases siehe [PROJECT-STATUS.md](PROJECT-STATUS.md).

## Produktfamilie und Grundhaltung

Ambassador App-Hub, SILK Inside, Ambassador Frühstück und SILK Trinkgeld bleiben bestehende, eigenständige Anwendungen. Eine gemeinsame Designsprache vereinheitlicht Farben, Typografie und Bedienelemente. App-spezifische Arbeitsabläufe bestimmen die Oberfläche. Keine komplette Neugestaltung, keine neue Abrechnungs-, Import- oder Datenarchitektur.

Jung, modern, frisch, hochwertig; klare Typografie, überwiegend geradlinige Formen, wenige Umrandungen und Untermenüs, wenig Erklärungstext. Der SILK-Wine-&-Dine-Flyer ist Referenz für Schrift, Linien und Farben, keine Layoutvorlage. Originale Markenassets erhalten. Kein Beige, Greige oder warmes Offwhite in der Oberfläche. Original-PDFs und Inhaltsfotos bleiben unverändert.

## Acht verbindliche Entscheidungen der finalen Designabnahme

1. **Markenarchitektur:** Ambassador bleibt Dachmarke und Hauptlogo des Hubs. Frühstück heißt **Ambassador Frühstück**. Verbindliche Hub-Reihenfolge: Ambassador Frühstück, SILK Inside, SILK Trinkgeld. Meili Selection bleibt dezent im Footer. Keine zusätzlichen SILK-Logos in Hub-Karten.
2. **App-Startseiten:** Ambassador Frühstück verwendet das bestehende originale Ambassador-Hotellogo; Inside und Trinkgeld die originale schwarze SILK-Wortmarke. Jeweils ohne Kreis/Kasten, darunter das unveränderte türkise Hub-App-Icon, darunter nur Frühstück, Inside oder Trinkgeld in Serif Italic Regular 400. Keine redundanten Untertitel. Arbeitsansichten bleiben kompakt.
3. **Originalicons:** Exakt die bestehenden Hub-Motive Buch, Frühstückstasse und Münzen; keine Ersatzsymbole. Freistehend auf Startseiten. PWA-Flächen dürfen technisch quadratisch sein, das Motiv bleibt gleich.
4. **Typografie:** App-Namen auf Startseiten und Hub-Karten: Noto Serif Italic Regular 400 in Anthrazit. Operative Header: kurzer App-Name in Sans Medium 500. Sans 400/500/600 nach Funktion, 700 nur begründet. Gleiche optische Gewichtung.
5. **Farben:** Reinweiß dominiert; Türkis #1C777B, Anthrazit #202326, kühles Grau und sehr dezentes Helltürkis. Funktionale Statusfarben bleiben erhalten.
6. **Navigation:** Inaktiv freistehende neutrale Outline-Icons. Nur aktive Hauptnavigation erhält türkises Icon, Helltürkis und feine eckige Einfassung ohne Schatten. Bestehende Funktionen und Routen bleiben erhalten. Ergänzung vom 11.10., 22:25 Uhr: Inside erhält das Header-Menü für Verwaltung; auf iPad werden die bestehenden Wissensziele direkt aufgeführt.
7. **Große Auswahlflächen:** Nur Hub und Service/Rezeption: weiß, vollständiger neutralgrauer Rahmen, etwa 4 px Radius, dezenter Schatten rechts/unten. Bestehende Hub-Geometrie erhalten.
8. **Operative Zimmerkarten:** Bewährte linke Identifikation und rechte Gast-/Statusinformationen, linker Statusbalken, feste Plätze, 44 Zimmer in fünf iPad-Spalten ohne Scrollen; Zimmer 55 inert. Keine neue Architektur und keine beliebige Schriftverkleinerung.

Die Regeln sind verbindlich. Die konkrete Umsetzung in einer Preview gilt erst nach ausdrücklicher Nutzerabnahme als abgenommen.

### Originalassets und Proportionen

Frühstück verwendet das unveränderte vorhandene `public/ambassador-logo.svg` (Ambassador Hotel Zürich), auch in der Startanimation. Sichtbare App-Namen und Apple-Home-Screen-Titel heißen Ambassador Frühstück. Bestehende Domains und Repositories bleiben erhalten. Die Markenberichtigung ist durch die ausdrückliche Nutzerergänzung vom 11.10.2026, 21:47 Uhr Europe/Zurich, Teil dieses Releases.

Die schwarze SILK-Wortmarke für Inside und Trinkgeld wird bytegleich aus Inside `public/assets/silk-wordmark.jpg` übernommen und lokal als `silk-wordmark.jpg` ausgeliefert. Die drei SVG-Dateien `app-icon-inside.svg`, `app-icon-breakfast.svg`, `app-icon-tips.svg` enthalten die ursprünglichen Hub-Pfade, Viewbox 24 × 24, 1,75 px Strichstärke und runde Linienenden. Keine Filter oder künstlichen Wortmarken.

Startseiten: Originalwortmarke in einer 128 px hohen, unverzerrten Logo-Zone; SILK 168–220 px breit, Ambassador 220–280 px. App-Icon 44 px, App-Name 36 px / 1,2, Regular 400 ohne künstliche Fettung und ohne negative Laufweite. Auf iPhone: Logo-Zone 96 px hoch, SILK 168 px / Ambassador 220 px breit, Icon 36 px, Name 30 px. Zwischen Logo-Zone und Icon 32 px, zum Namen 16 px; mobil 24 / 14 px. Die verschiedenen Logoformen bleiben original und werden mit `object-fit:contain` optisch ausgerichtet. Auswahlflächen folgen mit zusätzlichem Abstand.

### Ergänzung aus den Nutzungshinweisen vom 11.10.2026, 22:20–22:29 Uhr

- Operative Header verwenden nur **Inside**, **Frühstück**, **Trinkgeld**, Sans Medium 500, 20 px bzw. 18 px auf schmalen iPhones. Originale Markenlogos bleiben; das zusätzliche Buch-App-Icon neben Inside entfällt.
- In allen drei Apps führt das gleiche neutrale Outline-Raster mit 20 px Symbol / 44 px Klickfläche zum bestehenden Hub. Rechts daneben sitzt das jeweilige App-Menü mit freistehendem Menü-Icon. Keine zusätzliche Iconkachel und kein Schatten.
- Zusatz-App-Werbeverweise zwischen Frühstück und Trinkgeld entfallen. Der Hub übernimmt den App-Wechsel. Trinkgeld verwendet dabei dieselbe bestehende Abfrage für ungespeicherte Eingaben; keine neue Speicherlogik.
- Frühstück nennt weiterhin Service oder Rezeption als sekundären Arbeitsbereich. Das Hotellogo führt zur bestehenden Bereichswahl. Die fünf Zimmer-Spalten werden nicht verändert.
- Inside: Verwaltung im Header-Menü, nicht mehr unter Mehr oder zusätzlich in der Seitenleiste. Ab 700 px Breite werden alle bestehenden fachlichen Bereiche direkt in der Seitenleiste angeboten, einschließlich Gerichte & Servicewissen. Auf dem iPhone bleiben die fünf bestehenden Hauptpunkte mit Mehr.
- Inside-Startinhalt: klar abgegrenzte Inhaltsgruppen für aktuelle Angebote, Zeiten, Wein der Woche (falls konfiguriert) und den Cocktail-Einstieg. Weiß, feiner Rahmen, 4 px Radius, **kein Schatten**. Einzelne Informationen innerhalb der Gruppen erhalten keine weiteren Kästen.

Diese Ergänzungen wurden vom Nutzer zur Veröffentlichung freigegeben und am 12.10.2026 veröffentlicht. Inside erhielt durch den späteren Dashboardauftrag ausdrücklich eine horizontal zentrierte Logo-/Titelgruppe; dessen Header-App-Name verwendet Serif Italic 400. Frühstück und Trinkgeld behalten den kompakten Sans-Medium-Arbeitsheader. Keine nachträgliche Designangleichung im Release.

## Gemeinsame Tokens

| Zweck | Wert |
|---|---|
| Seiten und Flächen | `#FFFFFF` |
| Türkis / aktiver Zustand | `#1C777B` |
| Türkis bei Hover | `#155F63` |
| Anthrazit | `#202326` |
| Kühler Sekundärtext | `#62686B` |
| Gliederungslinie | `#E2E6E8` |
| Eingaberahmen | `#B7C0C5` |
| Auswahlflächenrahmen | `#D5DCDF` |
| Lokaler aktiver Hintergrund | `#EDF6F6` |
| Frühstück offen / Fortschritt | `#F3CF24` |
| Fehler | `#A33E3A` |

Lokal ausgelieferte Schrift: Digital Sans / Noto Sans, 400 für Inhalte, 500 für Menüs und Bereichsüberschriften, 600 für wichtige Zahlen. 700 nur in begründeten Ausnahmen. Digital Serif / Noto Serif Italic, Regular 400, ausschließlich für App-Namen und Markenakzente; keine dekorative Kursivschrift in operativen Inhalten. Originales Ambassador-Hotellogo und dezentes Meili-Selection-Branding erhalten; keine nachgebauten Wortmarken. Abstandsskala: 4, 8, 12, 16, 24, 32, 48 px.

## Komponentenregeln

| Komponente | Verbindliche Ausführung |
|---|---|
| Große Auswahlflächen | Reinweiß, vollständiger feiner 1-px-Rahmen, 4 px Radius, Schatten `2px 3px 8px rgba(20,30,35,.07)`, türkises Outline-Icon. Gilt für drei Hub-Einstiege sowie Service/Rezeption. |
| Normale Aktionsbuttons | Kein Schatten, auch nicht Gäste bearbeiten, Frühstück beenden, Check-in, Speichern oder Abbrechen. Bestehende eindeutige Hierarchie erhalten. |
| Informations- und Zimmerkarten | Flach, ohne dekorativen Schatten; keine Übertragung des Auswahlflächendesigns auf Zimmerkarten. |
| Menü-Icons | Gemeinsame Outline-Sprache, 20 px, Strichstärke 1,75, runde Linienenden, 12 px Textabstand. Kein zusätzlicher Iconkasten oder Doppelrahmen. Inaktiv neutral und transparent ohne Einfassung; nur aktive Hauptnavigation Türkis mit `#EDF6F6`, feiner `#C5DEDF`-Einfassung, 4 px Radius und ohne Schatten. Gewöhnliche Menülisten bleiben freistehend. |
| Auswahlflächen-Icons | Vorhandene größere 32-/36-px-Variante zulässig; nicht mit kleinen Menü-Icons gleichsetzen. Für die drei App-Kennzeichnungen gilt exakt das jeweilige bestehende Hub-Motiv. |
| Fokus | Sichtbarer 2-px-Fokus in Türkis, 3 px Abstand. |
| Dialoge | Bestehende Struktur und Funktionen erhalten; 8 px Radius, nutzbarer innerer Scrollbereich. |

## Ambassador Frühstück: verbindliche Spezialansicht

Die über Wochen entwickelte Zweispalten-Kartenstruktur wird wiederverwendet. Links stehen Zimmernummer und darunter Personenicon mit Gästeanzahl. Rechts stehen Gastnamen untereinander, Frühstück inklusive/nicht inklusive und darunter Erfassungsstatus sowie Tisch oder Roomservice. Ganz links bleibt der Statusbalken. Keine Tabelle, keine Vermischung der Informationsbereiche, keine zusätzlichen Tassenkreise.

Alle 44 realen Zimmer müssen in der iPad-Serviceübersicht gleichzeitig sichtbar sein. Fünf feste Spalten: **20–28 | 30–38 | 40–48 | 50–58 | 60–68**. Position 55 ist ein inertes, nicht interaktives Leerfeld. Prüfrahmen: **1024 × 748** und **1194 × 834**, kein horizontales oder vertikales Scrollen der Übersicht. Die ältere Regel „mindestens 82 px, auf kurzen Displays scrollen“ ist für diese Ansicht ausdrücklich aufgehoben.

Im freigegebenen veröffentlichten Stand: Namen 13 px, Status 12 px, stabile vier Textzeilen und feste linke Identifikationsspalte. Sehr lange Namen werden mit Auslassung gekürzt und im vorhandenen Dialog vollständig gezeigt. Ab drei Gästen bleibt ein `+N`-Hinweis. Diese sichtbare Einschränkung bleibt dokumentiert; sie erlaubt keine beliebige zusätzliche Verdichtung.

Gelb kennzeichnet offene inklusive Frühstücke und bleibt in der Fortschrittslinie. Vollständig erfasste Zimmer treten neutral zurück; kleine Bestätigungshaken dürfen Türkis bleiben. „Nur offene Zimmer“ blendet erledigte und nicht inklusive Zimmer aus, Teilerfassungen bleiben sichtbar. Feste Zimmerpositionen dürfen dadurch nicht verrutschen. iPhone und Rezeption behalten ihre eigenen geeigneten Listen-/Arbeitsabläufe.

Mews-Import, Frühstückslogik, Persistenz und Check-in dürfen durch Designharmonisierung nicht verändert werden.

## Umsetzung und Quellen

Kanonische CSS-Tokens: `design-system/ambassador-digital.css` in `marcowilczek84/silk-service`. Identische Laufzeitkopien: `public/ambassador-digital.css`, `ambassador-hub/public/ambassador-digital.css`, Frühstück `public/ambassador-digital.css`, Trinkgeld `ambassador-digital.css`. Im neuen Entwicklungsstand sind alle fünf Dateien bytegleich (SHA-256 `6ec083051c1e582a5e82d2df839704b621d6010041a8c193dcad7241647baed8`).

App-Adapter bleiben getrennt: Inside `public/digital-inside.css` und `public/digital-navigation.css`; Hub `ambassador-hub/public/styles.css`; Frühstück `public/digital-breakfast.css` und `public/digital-selection-navigation.css`; Trinkgeld `digital-tips.css` und `digital-navigation.css`. Der finale reine Darstellungsadapter heißt in den drei SILK-Apps `final-brand.css`. Nur gezielte Regeln ändern. Gemeinsame Tokens dürfen die Spezialgeometrie der Frühstücksansicht nicht überschreiben.

Historische Dokumentation bleibt als Nachweis erhalten: `docs/AMBASSADOR-DIGITAL-DESIGN-SYSTEM-1.0.md`. Bei Widersprüchen gilt dieses Master-Dokument und anschließend eine ausdrücklich dokumentierte neuere Nutzerentscheidung.


## Verbindlicher Nachtrag 1.4 · Service-Dashboard (11.10.2026)

- Inside-Header: originales schwarzes SILK-Wortzeichen und Inside als horizontal zentrierte Einheit; Name Serif Italic 400. Hub-Icon und Menü rechts, auf dem iPad sämtliche bestehenden Wissensziele direkt in der Navigation.
- Start: Suche erhalten; Wein-/Cocktailempfehlungen mit Originalfotos zuerst, auf dem iPad nebeneinander; danach Jetzt servieren wir/Servicezeiten und kompakter Allergie-Check. Keine dekorativen Kennzahlen.
- Fehlende Fotos: lokale neutrale SVG-Motive (eigene CC0-Arbeit, Herkunft `public/fallbacks/LICENSE.txt`), keine Bild-KI/API. Originalfoto hat Vorrang.
- Allergie-Check: 14 Gruppen getrennt von vegan/vegetarisch. Unvollständige, unveröffentlichte oder widersprüchliche Angaben bedeuten Rückfrage. Keine Allergenfrei-/Sicherheitsbehauptung. Auch verifizierte Negativauskunft ist keine Sicherheitsgarantie.
- Hubnamen weiterhin durchgehend Serif Italic Regular 400. Ambassador Frühstück bleibt die Marke der Frühstücks-App; freigegebenes Frühstücks-Icon bleibt unverändert.

## Inside-Service-Dashboard – veröffentlichte Ergänzung

Wochenempfehlungen vor aktuellen Servicezeiten/Karten, Allergie-Check als kompakter Zugriff. Originalfotos haben Vorrang; vorhandene lokal dokumentierte Ersatzmotive nur bei fehlenden Bildern. Empfehlungskarten bleiben flach und ohne dekorative Schatten. Eine nicht ausgewählte Empfehlung wird nicht durch Demo-Inhalte ersetzt. Allergieergebnisse verwenden dokumentierte Rezepturen konservativ; fehlende/veraltete/widersprüchliche Angaben erfordern Küchenrückfrage. Keine Allergenfreiheits- oder Sicherheitsgarantie. Keine neue Designrunde Bestandteil des Releases vom 12.10.2026.


## Premium UX – Preview-Erweiterung vom 12.10.2026

Noch nicht abgenommen. Gilt nur für Frühstück und Inside; keine automatische Änderung von Hub oder Trinkgeld. Operative Zimmerübersicht mit fünf Gruppen nutzt die volle Breite, sehr feine Konturen ohne Schatten und 13–14 px Namen. Inside nutzt Editorial-Überschriften in Serif Regular, fotozentrierte Restaurantinhalte und eine kompakte Seitenleiste auf iPad/Desktop. App-Name weiterhin Serif Italic Regular. Originales Ambassador-Logo links, SILK/Inside mittig. Verbindliche Entscheidung, Geometrien und Grenzen: `docs/PREMIUM-UX-20261012.md`.
