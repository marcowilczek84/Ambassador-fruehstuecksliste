# Delta nach Feinschliff III – Ausgangspunkt und freigegebene Grenze

Vor Änderungen am 28.09.2026 geprüft:

- Branch: `ambassador-final-uiux-20260927`
- Frisch geprüfter Remote-HEAD und sauberer Checkout: `5c62497c3647854a1356d0a20eac5a0205ee2b74`
- Preview READY: https://ambassador-fruehstuecksliste-ddnucj3ck-restaurant-silk.vercel.app/index-live.html
- Deployment: `dpl_8mjncBLEQUcDknem39CcXbATPfy9`, target null (Preview).
- Abgeschlossener Feinschliff III: 851 PASS / 0 FAIL, einschließlich 582 bisheriger Invarianten und 269 Zusatzprüfungen.
- Freigabevorlagen gelesen: Ambassador_Icon_Entscheidungstest(1).pdf (8 Seiten), DESIGNSTUDIE_Iconvergleich_1zu1(1).png, Ambassador_Product_Design_Audit(1).pdf (6 Seiten).

| Punkt | Ist | Einzige erlaubte Änderung / Nachweis |
|---|---|---|
| App-Zeichen | Filled-Tasse, 52 px iPhone / 60 px iPad | Unverändert, Asset bytegleich |
| Rollenicons | Bestehende Tasse und Empfangsicon, SVG 26 px im unveränderten Slot | Freigegebene Hybridrollen Person+Tablet / Person+Tresen, 26 px |
| Iconfamilie | Freigabevorlage enthält Vektorpfade auf Seite 8 | Diese Pfade in 32er-Koordinaten, Strich 2 (bei 26 px effektiv 1,625 px), runde Enden / Ecken; keine Klingel |
| Bereichswahl | Gemeinsame Slots, Textachsen, Flächen, Branding bereits abgenommen | Außerhalb der beiden 26-px-SVG-Flächen keine relevante Pixeländerung gegen 5c62497 |
| Zimmer hinzufügen mobil | Freigabeaudit dokumentiert ca. 55 px Freiraum zwischen Label und Control; flexendes Formular mit gestreckten Grid-Zeilen | Mobile Grid-Inhalte oben bündeln, Labelgap 8 px, Feldgruppengap 20 px; Rahmen, Footer, Controls unverändert |
| iPad / Desktop | Feldgruppen bereits akzeptiert | Keine mobile Regel außerhalb vorhandenem Breakpoint max-width:699px; Vorher/Nachher-Messung |
| Animation und übrige App | Feinschliff-III-Verhalten eingefroren | Alle bisherigen JS-Funktionen außer den beiden Iconaufrufen im Chooser bytegleich; bisherige CSS-Regeln und Tests bytegleich |
| Tastatur | Linux-WebKit liefert keine native iOS-Systemtastatur | Fokus, verkleinerte sichtbare Höhe und Scrollen automatisiert prüfen; echte Tastatur bleibt physische Safari-Abnahme, kein fingierter Tastatur-Screenshot |

Kein Production-Deployment, keine Datenbank-/Supabase-, Mews-, Sync-, Persistenz-, Rollen-, Übersetzungs- oder Geschäftslogikänderung. Ausschließlich synthetische browserlokale Testdaten; Supabase-Anfragen in Tests blockieren.
