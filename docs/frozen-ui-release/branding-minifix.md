# Bereichswahl: Branding-Minifix

Ausgangspunkt: `3e08880c4e72183c1c89695076ec789aef5b619a`, Branch `ambassador-final-uiux-20260927`.
Vor Änderungen geprüft: Branch/Commit identisch, Arbeitsverzeichnis sauber; letzter Audit 97 Restfix-PASS / 0 FAIL und 86 bisherige PASS.

| Befund | Vorher | Soll |
|---|---|---|
| Produktlogo | fehlt; vorhandenes Favicon mit drei Dampfstrichen ohne Untertasse | eigenes flaches SVG, Petrol #1c777b, weiße Tasse/Untertasse, zwei Dampfstriche |
| Hierarchie | Hotelmarke, Titel, Datum, Arbeitsbereich | Produktlogo zwischen unveränderter Hotelmarke und Titel, 52 px mobil / 60 px größer |
| Auswahlflächen | rechts je ein Chevron | Chevron entfernen, vollständiger Button und bestehende Outline-Icons erhalten |

Kein passendes finales Vektorasset im Repository oder unter den gefundenen Logo-Konzepten verfügbar. Das vorhandene ältere Konzeptblatt enthält A/B/C mit abweichenden Merkmalen. Daher ausdrücklich erlaubter SVG-Fallback nach der aktuellen schriftlichen Geometrievorgabe; kein Rasterbild, keine freie Übernahme des alten Monogramms.

Produktionscode ausschließlich `renderRoleSelection`-Markup, Bereichswahl-CSS und neues SVG. Alle übrigen JavaScript-Zeichen, CSS-Regeln, Originalmarken, Übersetzungen, Anwendungskern und Konfiguration bleiben bytegleich zum Restfix-Commit. Favicon und Homescreen-Icon bleiben unverändert.

Nur Bereichswahl-Regression: Chromium iPhone/iPad/Desktop, WebKit iPhone/iPad. Viewports 390×844, 1024×1366, optional 1440×900. Navigation mit synthetischen lokalen Testdaten, Supabase-Anfragen vor Navigation blockiert; keine Check-ins oder Importe.
97 Restfix-Prüfungen sind außerhalb der Markup-Änderung nicht betroffen; keine Behauptung eines erneuten vollständigen Restfix-Laufs. Die vorhandenen vollständigen Audit-Skripte bleiben erhalten und können über `full_regression` weiterhin ausgeführt werden.

Production und Supabase unverändert. Nach Preview, gezielter Prüfung und Screenshots STOPP.
