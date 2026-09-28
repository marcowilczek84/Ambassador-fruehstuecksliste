# Service-Modalgeometrie nach physischem iPhone-Test

Ausgangspunkt: `34f86730fbc5374317a2189abec75a1caec87be1`, Branch `ambassador-final-uiux-20260927`; lokaler und Remote-Stand identisch, Arbeitsverzeichnis sauber. Branding-Audit: 66 PASS / 0 FAIL. Restfix davor: 97 PASS / 0 FAIL, 86 Bestandsinvarianten PASS.

Vor Änderungen: neue Realgerätebilder IMG_6639–IMG_6651 gelesen. Lokale Reproduktion bei 390×844 mit isolierten synthetischen Daten und vor Navigation blockierten Supabase-Anfragen:

| Ansicht | Ist | Soll |
|---|---|---|
| Check-in | top 8, left 0, width 390, height 836; verdeckt 68-px-Serviceheader | ab 80 px, 12 px seitlich, begrenzte Höhe, interner Body-Scroll |
| Gäste ohne Zimmer | top 8, left 10, width 370, height 836 | dieselbe äußere Geometrie wie Check-in |
| Erfolg mit Bemerkung | top 8, left 10, width 370, height 728; keine getrennten Scrollzonen | kompakter Dialog im verfügbaren Bereich, Header/Body/Footer strukturell getrennt |
| Gast bearbeiten | funktionsfähige Vollbild-Arbeitsansicht | vollständig erhalten |
| Bemerkung | kompakter Dialog, top 282, height 279 | erhalten; verkürzte Viewporthöhe als ergänzende Prüfung |

Gemeinsame Service-Overlayregeln gelten ausschließlich bei direktem Kind Check-in, Sondergastdialog oder Erfolgsdialog. Oberer Abstand lässt den Originalheader sichtbar; transparente Abdunklung, 16 px Radius, nur der Body scrollt. iPad behält die vorhandene Zweiteilung. Im Erfolgsdialog werden vorhandene DOM-Elemente nur in Präsentationsbereiche gruppiert; bestehende Inhalte und der originale Verstanden-Button mit seinem Handler bleiben erhalten.

Keine Änderung von Geschäftsfunktionen, Übersetzungen, Rezeption, Bereichswahl, Service-Hauptlayout, Menüs oder Gast-bearbeiten-Regeln. Kein Production- oder Supabase-Schreibvorgang. Synthetischer Check-in ausschließlich im isolierten Browser zur Erzeugung des realen Erfolgsdialogs.

Pflichtnachweise: iPhone/iPad, Chromium/WebKit; Screenshots und Modal-/Header-/Body-/Footer-Bounds. Ergänzende verkürzte Viewporthöhe ist kein physischer iOS-Tastaturtest. Bestehende Audit-Skripte bleiben erhalten und werden erneut ausgeführt.
