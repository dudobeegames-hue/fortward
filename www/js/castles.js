'use strict';
// Fortward – hrady (tábory) protivníka pre misie 6–10. Súbor zapisuje editor hradov (www/dev/castle-editor.html).
// Pre každú rasu protivníka a misiu zoznam stavieb: k = druh stavby rasy (CAMP_PIECES v js/camp.js),
// c, r = ľavé horné políčko stavby v mriežke bojiska (stĺpec 0–10, riadok od hornej hrany).
const CASTLES = {
  human: {
  },
  orc: {
    "6": [{"k": "catapult", "c": 2, "r": 4}, {"k": "goblinTent", "c": 7, "r": 3}],
    "7": [{"k": "catapult", "c": 3, "r": 4}, {"k": "goblinTent", "c": 7, "r": 3}, {"k": "drum", "c": 7, "r": 5}],
    "8": [{"k": "catapult", "c": 2, "r": 4}, {"k": "goblinTent", "c": 7, "r": 3}, {"k": "drum", "c": 6, "r": 5}, {"k": "tower", "c": 2, "r": 6}],
    "9": [{"k": "catapult", "c": 2, "r": 4}, {"k": "catapult", "c": 7, "r": 4}, {"k": "goblinTent", "c": 6, "r": 2}, {"k": "totem", "c": 3, "r": 2}, {"k": "tower", "c": 2, "r": 6}, {"k": "tower", "c": 7, "r": 6}],
    "10": [{"k": "catapult", "c": 2, "r": 4}, {"k": "catapult", "c": 7, "r": 4}, {"k": "goblinTent", "c": 6, "r": 2}, {"k": "totem", "c": 3, "r": 2}, {"k": "drum", "c": 4, "r": 3}, {"k": "tower", "c": 3, "r": 6}, {"k": "tower", "c": 7, "r": 6}]
  }
};
