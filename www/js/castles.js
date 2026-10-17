'use strict';
// Fortward – hrady (tábory) protivníka pre misie 6–10. Súbor zapisuje editor hradov (www/dev/castle-editor.html).
// Pre každú rasu protivníka a misiu zoznam stavieb: k = druh stavby rasy (CAMP_PIECES v js/camp.js),
// x, y = spodok stavby v herných px od ľavého horného rohu mriežky bojiska.
const CASTLES = {
  human: {
  },
  orc: {
    "6": [{"k": "catapult", "x": 46, "y": 68}, {"k": "tent", "x": 112, "y": 52}],
    "7": [{"k": "catapult", "x": 51, "y": 68}, {"k": "tent", "x": 117, "y": 52}, {"k": "drum", "x": 113, "y": 88}],
    "8": [{"k": "catapult", "x": 43, "y": 70}, {"k": "tent", "x": 113, "y": 50}, {"k": "drum", "x": 109, "y": 90}, {"k": "tower", "x": 47, "y": 104}],
    "9": [{"k": "catapult", "x": 43, "y": 72}, {"k": "catapult", "x": 117, "y": 76}, {"k": "tent", "x": 105, "y": 46}, {"k": "totem", "x": 55, "y": 48}, {"k": "tower", "x": 47, "y": 108}, {"k": "tower", "x": 113, "y": 110}],
    "10": [{"k": "catapult", "x": 46, "y": 72}, {"k": "catapult", "x": 124, "y": 76}, {"k": "tent", "x": 110, "y": 44}, {"k": "totem", "x": 60, "y": 46}, {"k": "drum", "x": 78, "y": 62}, {"k": "tower", "x": 52, "y": 108}, {"k": "tower", "x": 118, "y": 110}]
  }
};
