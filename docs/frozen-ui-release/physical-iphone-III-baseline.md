# Physischer iPhone-Feinschliff III — Ausgangspunkt / Soll–Ist

Vor Änderungen am 28.09.2026 geprüft:

- Branch: `ambassador-final-uiux-20260927`
- Lokaler und frisch abgerufener Remote-HEAD: `3825aba02d66d8dca8c193054fb29877ad7c88f6`
- Preview READY: https://ambassador-fruehstuecksliste-2gchie4e7-restaurant-silk.vercel.app/index-live.html
- Deployment: `dpl_GahRi1Tf6vQL8P8vkwe4VPnBG1yn`, Preview (`target: null`). Kein neuerer Branch-Stand vorhanden.
- Letzte Audit-Artefakte gelesen: 86 + 97 + 66 + 145 + 188 = 582 PASS, 0 FAIL. WebKit-Screenshotübersicht visuell kontrolliert.
- Die bereits korrigierten Service-Modals bleiben erhalten. Check-in / Gäste ohne Zimmer: iPhone links 12, oben 80, Breite 366; Header dahinter sichtbar, Body scrollt, Footer bleibt.

| Punkt | Ist / Befund | Soll / begrenzte Änderung |
|---|---|---|
| Globaler Header | Gemessen bereits 0 px Unterkante | Ausdrücklich ohne Linie/Schatten erhalten |
| Erfolg | Body hat 0 px unteres Padding | Letzter Bemerkungsblock mit Abstand vollständig erreichbar; bestehende äußere Modalregeln erhalten |
| Importkontrolle | Mobile Fullscreen-Regel, Body display:contents, Liste allein scrollt | Abgegrenztes Modal über Rezeption; Header/Body/Footer, ein Body-Scrollbereich |
| Einstieg | Service eigener 650-ms-Abbruch; direkter Rezeption-Einstieg ohne eigenes Overlay; vorhandene Importanimation 4700 ms | Gemeinsamer visueller Lifecycle beider Bereiche mit bestehender 4700-ms-Referenz; reduzierte Bewegung 80 ms; keine neue Datenabfrage |
| Datumsfelder | Input UND Label haben Border; Label-Padding 10/12 px; zusätzlicher Rahmen | Nur Inputs umrandet, gleich breite Spalten, definierter 16-px-Gap |
| Mehrfachbemerkung | Produkt unterstützt bestehenden Einzelzustand | Nur browserlokale visuelle Testfixture, keinerlei Produktcode/Persistenzfunktion |
| Rezeptionsdetail | Einzelne Aktion nur intrinsisch breit | Single-Action-Footer volle Breite; zwei Aktionen weiterhin 50/50 |
| Service-Detail | Schließen bereits vollbreit | Erhalten und erneut messen |
| Mobile Aktionen | Gruppe x31..389, Suche x16..374 bei 390 px | Gemeinsame Inhaltsachse x16..374, zwei gleich breite Spalten, Höhe 44 px |

Die bisherige Service-Transitionsprüfung `<1200 ms` beschreibt den ausdrücklich zu ersetzenden 650-ms-Ablauf und wird gezielt auf die gemeinsame Referenzdauer aktualisiert. Alle übrigen bisherigen Assertions bleiben erhalten. Keine Geschäfts-, Daten-, Rollen-, Übersetzungs-, Import- oder Syncänderung. Physische Safari-Abnahme weiterhin offen.
