# Trainingsplanner — PWA

Hardloop- en trailrun trainingsplanner met logboek. Werkt als app op je telefoon via "Aan beginscherm toevoegen".

## Wat zit erin

- `index.html` — de app-shell (CSS, meta-tags, service-worker-registratie)
- `app.js` — de pre-gecompileerde React-app (geen build nodig)
- `manifest.json` — PWA-manifest
- `sw.js` — service worker (offline-werking)
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `icon.svg`

## Hosten op GitHub Pages (aanbevolen)

1. Maak een nieuwe repository op GitHub, bijv. `training-planner`. Publiek of privé maakt niet uit — Pages werkt met beide (privé vereist GitHub Pro).
2. Upload alle bestanden uit deze map naar de root van de repo (via web-upload of `git push`).
3. Ga naar **Settings → Pages**.
4. Bij **Source**, kies "Deploy from a branch", branch `main`, folder `/ (root)`. Klik Save.
5. Na 1-2 minuten staat de app op `https://<jouw-username>.github.io/training-planner/`.

### Belangrijk

- GitHub Pages serveert HTTPS automatisch — service workers werken alleen via HTTPS of `localhost`.
- Eerste keer openen op telefoon: laat hem volledig laden zodat de service worker alles kan cachen. Daarna werkt het offline.

## Installeren op je telefoon

### iOS (Safari)

1. Open de URL in **Safari** (niet Chrome — andere browsers op iOS hebben geen "Aan beginscherm" feature).
2. Tik op het deel-icoon (vierkant met pijl omhoog) onderaan.
3. Scroll en kies **"Zet op beginscherm"**.
4. Bevestig met "Voeg toe".

De app verschijnt nu tussen je apps, opent fullscreen zonder Safari-balken, en werkt offline.

### Android (Chrome)

1. Open de URL in Chrome.
2. Een banner verschijnt onderaan met "Installeer". Tik erop.
3. Of: tap menu (drie puntjes) → "App installeren" / "Aan startscherm toevoegen".

## Lokaal testen

```bash
# Optie 1: Python
python3 -m http.server 8000

# Optie 2: Node
npx serve .
```

Daarna `http://localhost:8000` openen.

**Let op:** Service worker registreert alleen op `localhost` of HTTPS. Voor échte iPhone-installatie moet de app via een HTTPS-URL beschikbaar zijn (GitHub Pages).

## Data en privacy

Alle gegevens (training-instellingen, voortgang, logs) worden lokaal opgeslagen in `localStorage` van je browser/PWA. Niets gaat naar een server. Als je de app verwijdert of browserdata wist, zijn de gegevens weg — overweeg af en toe een handmatige export (via DevTools → Application → Local Storage).

## Updates uitrollen

Als je de app aanpast en de wijziging wilt forceren bij gebruikers die hem al hebben geïnstalleerd: verhoog `CACHE_VERSION` in `sw.js` (bijv. naar `"training-v2"`). De service worker zal dan oude cache verwijderen bij de volgende bezoek.
