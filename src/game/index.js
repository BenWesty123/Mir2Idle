import { installConstants } from "./constants.js";
installConstants();

import "./modules/persist.js";
import "./modules/audio.js";
import "./modules/stats.js";
import "./modules/offline.js";
import "./modules/mining.js";
import "./modules/training.js";
import "./modules/inventory.js";
import "./modules/zone.js";
import "./modules/town.js";
import "./modules/render.js";
import "./modules/draw.js";
import "./modules/combat.js";
import "./modules/groupDungeon.js";
import "./modules/bossParty.js";
import "./modules/coreD.js";
import "./modules/coreE.js";
import "./modules/coreF.js";
import { boot } from "./bootstrap.js";
import { els } from "./runtime.js";

boot().catch(async (err) => {
  els.status.textContent = err.message;
  els.status.classList.add("bad");
});
