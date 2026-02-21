# 3Cat Downloader

Descarrega episodis de sèries de [3Cat](https://www.3cat.cat).

## 🌐 App en línia

**[https://3catdownloader.vercel.app/](https://3catdownloader.vercel.app/)**

## Funcionalitats

- 🔍 Cerca qualsevol sèrie de 3Cat per URL
- 📺 Veure totes les temporades i episodis disponibles
- ⬇️ Descarregar episodis individuals en màxima qualitat
- 📦 Descarregar una temporada completa en un clic
- 📝 Format del nom de fitxer seleccionable:
  - `Sèrie - S01E01 - Títol.mp4` — format clàssic
  - `Sèrie - T1xC1 - Títol.mp4` — format 3Cat *(per defecte)*
  - `Títol complet de l'API.mp4` — valor brut del camp `titol_complet`
- 📊 Barra de progrés de descàrrega amb percentatge en temps real
- ⚡ Indicador de velocitat de descàrrega (KB/s · MB/s)
- 🗂️ Mida total del fitxer visible durant la descàrrega
- ❌ Cancel·lació de descàrrega en qualsevol moment (clic sobre el spinner)

## Tech stack

- Next.js 16 — framework web
- React 19 — UI
- Tailwind CSS 3 — estils i disseny responsive
- lucide-react — icones
- Bun 1.3 — gestor de paquets i runtime
- Vercel — deploy

---

## Desenvolupament local

```bash
bun install
bun dev
```


