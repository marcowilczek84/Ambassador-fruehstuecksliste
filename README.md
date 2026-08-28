# Ambassador Frühstücksliste

Dieses Repository enthält ausschließlich den gesicherten, geprüften Produktionsstand der App `ambassador-fruehstuecksliste` vom 28. August 2026.

Die ursprünglichen ausgelieferten Next.js-Dateien liegen unter `public/recovered`. Eine kleine Next.js-Hülle hält ihre originalen `/_next/static`-Pfade stabil. Dadurch wird ausschließlich die geprüfte Benutzeroberfläche dieses Repositorys geladen; frühere Quellstände werden nicht benötigt.

## Prüfung

```bash
npm install
npm run build
```

Die Produktionsadresse darf erst nach erfolgreicher Prüfung einer separaten Vercel-Vorschau auf diesen Stand umgestellt werden.
