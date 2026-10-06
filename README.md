# Fortward

Mobilná hra (iOS + Android): obrana radnice s kráľom proti hordám. Hrá sa na výšku, radnica je dole a hordy prichádzajú zhora. Medzi vlnami hráč stavia na mriežke okolo radnice veže, kasárne, hradby a pasce. Hra nemá reklamy a gemy sa kupujú v aplikácii.

## Spustenie prototypu

```bash
python tools/devserver.py 8421
```

Potom otvor http://localhost:8421. Na zobrazenie mobilu použi responzívny režim prehliadača (F12, ikonka telefónu).

### Na mobile (tá istá Wi-Fi)

```bash
python tools/devserver.py 8421 --lan
```

Server vypíše adresu (napr. `http://192.168.0.123:8421`) a tú otvoríš v prehliadači na mobile. Windows sa môže pri prvom spustení opýtať na povolenie vo firewalle, vtedy povoľ **súkromnú sieť**. V sieťovom režime je ukladanie snímok vypnuté.

## Štruktúra

- `www/`: samotná hra. Tento priečinok neskôr zabalí Capacitor do iOS/Android aplikácie.
  - `index.html`: rozhranie (HUD, obchod medzi vlnami, menu) a štýly.
  - `js/audio.js`: zvukové efekty a hudba generované cez Web Audio (bez zvukových súborov).
  - `js/sprites.js`: pixel-art sprity zapísané ako textové bitmapy a pixelové písmo.
  - `js/scene.js`: procedurálne bojisko (dithering Bayer 4×4).
  - `js/buildings.js`: procedurálne sprity budov (radnica, veže, kasárne, hradby, jama).
  - `js/map.js`: mapa ostrova s 10 misiami (názvy, rozloženie, generovanie ostrova).
  - `js/game.js`: herná logika (mriežka 16 px, hľadanie cesty Dijkstrom okolo budov), vlny, rytieri, kráľ, vykresľovanie a UI.
- `www/dev/sim.js`: automatický hráč na simuláciu kampane a ladenie obtiažnosti. Hra ho nenačítava.
- `tools/devserver.py`: lokálny server. `POST /snap` ukladá snímky z hry na ladenie grafiky.

## Ladenie v konzole prehliadača

- `FW.st`: stav hry (napr. `FW.st.gold = 999`).
- `FW.snap('nazov')`: uloží zväčšenú snímku herného rastra.
- `FW.sheet('nazov')`: uloží prehľad všetkých spritov.

## Simulácia kampane

Obtiažnosť sa nastavuje v objekte `DIFF` v `www/js/game.js`. Overíš ju v konzole prehliadača:

```js
await new Promise(r => { const s = document.createElement('script'); s.src = 'dev/sim.js'; s.onload = r; document.head.appendChild(s); });
SIM.campaign({ retries: 3 })          // celá kampaň od misie 1 (postup v prehliadači sa obnoví)
SIM.mission(5, { volley: false })     // jedna misia bez šípovej salvy
```
