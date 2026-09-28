# Physischer iPhone-Restfix – Ausgangspunkt und Soll/Ist

Branch: ambassador-final-uiux-20260927
HEAD: 1a702083bb6534470309266f0a3ea0bd29125679
Preview: https://ambassador-fruehstuecksliste-nc34ggbin-restaurant-silk.vercel.app/index-live.html
Deployment: dpl_DETC86gJM5vS4f2TS5EpWWRC3bLJ (READY, Preview)
Vorprüfung: 394 PASS / 0 FAIL (86 + 97 + 66 + 145).

Vor jeder Codeänderung geprüft: physische iPhone-Bilder IMG_6659–IMG_6667; letzter Service-Modal-Audit und aktueller DOM-Ablauf mit ausschließlich synthetischen Daten / blockiertem Supabase.

| Befund | Ist / Ursache | Begrenztes Soll |
|---|---|---|
| 1 Logo | weiße Tasse noch zu klein/zurückhaltend | markanter gefüllt; unveränderte 64er Vektorkachel, 52/60 CSS px |
| 2 Auswahl | alte grid-row-/Margin-Regeln am Icon | eine gemeinsame feste Iconspalte, vertikal zentrierter Textblock |
| 3/4 Menüs | letzte Zeile border-bottom + nächste Section border-top | eine Linie je Zeilen-/Sectiongrenze; Footer einmal |
| 5 Woche | Empty-State-Kalender zu groß/grau | vorhandenes Outline-SVG petrol, 22 px |
| 6 Aktionen | mobile dominante Aktionen / Abstand | 44 px, gleiche Höhe, enger zur Überschrift; nur Mobile |
| 7 Bemerkung | mobile eigene rechte Zelle mit leerem Gedankenstrich | leere Zelle ausblenden; vorhandene Notiz im Gastbereich kennzeichnen |
| 8 Service-Detail | guest-info-live / detail-item als Cards, einzelner halber Footerbutton | ruhige Read-only-Datenstruktur, Schließen volle Breite |
| 9 P1 | Klick auf Gastinfo setzt nativen Picker-Zustand; späterer Editor rendert Picker. removeManualGuestInfo entfernt Picker-Section, lässt .guest-info-picker-layer leer und interaktiv zurück. elementFromPoint(195,350) trifft leere Layer (z=1400). | nativen Picker schließen, keine leere aktive Layer; Header/Body/Footer klar getrennt; kein z-index-Workaround |

Erhaltene WebKit-Modalbounds (390×844): Check-in und Spezialgäste x12/y80/w366/h751.984; Erfolg x12/y108.438/w366/h695.094. Header sichtbar. iPad 1024×1366: Check-in x24/y378.906/w976/h664.172; Spezialgäste x24/y283.203/w976/h855.578; Erfolg x222/y399.453/w580/h623.094. Header sichtbar.

Frozen: ursprüngliche React-Anwendung, Datenzugriff, sämtliche fachlichen Handler, Parser, Persistenz, Konfiguration, Übersetzungslogik, Service-Hauptansicht, vorhandene Service-Arbeitsmodals und Rezeptions-Detail / Tablet / Desktop. Nur benannte Präsentationsregeln und notwendiger Overlay-Lifecycle.

Physische Wiederabnahme bleibt offen. Automatisierte WebKit-Ergebnisse ersetzen diese nicht.
