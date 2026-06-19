export const EAST_DIRECTION = 2;

export const ACTION_GROUPS = [
  {
    label: "Core",
    actions: [
      "standing",
      "walking",
      "running",
      "stance",
      "stance2",
      "attack1",
      "attack2",
      "attack3",
      "attack4",
      "spell",
      "harvest",
      "struck",
      "die",
      "dead",
      "revive",
      "mine",
      "lunge",
    ],
  },
  {
    label: "Mount",
    actions: [
      "mountStanding",
      "mountWalking",
      "mountRunning",
      "mountStruck",
      "mountAttack",
    ],
  },
  {
    label: "Fishing",
    actions: ["fishingCast", "fishingWait", "fishingReel"],
  },
];

export const PLAYER_ACTIONS = {
  standing: { label: "Stand", start: 0, count: 4, skip: 0, interval: 500 },
  walking: { label: "Walk", start: 32, count: 6, skip: 0, interval: 100 },
  running: { label: "Run", start: 80, count: 6, skip: 0, interval: 100 },
  stance: { label: "Stance", start: 128, count: 1, skip: 0, interval: 1000 },
  stance2: { label: "Stance 2", start: 300, count: 1, skip: 5, interval: 1000 },
  attack1: { label: "Attack 1", start: 136, count: 6, skip: 0, interval: 100 },
  attack2: { label: "Attack 2", start: 184, count: 6, skip: 0, interval: 100 },
  attack3: { label: "Attack 3", start: 232, count: 8, skip: 0, interval: 100 },
  attack4: { label: "Attack 4", start: 416, count: 6, skip: 0, interval: 100 },
  spell: { label: "Spell", start: 296, count: 6, skip: 0, interval: 100 },
  harvest: { label: "Harvest", start: 344, count: 2, skip: 0, interval: 300 },
  struck: { label: "Struck", start: 360, count: 3, skip: 0, interval: 100 },
  die: { label: "Die", start: 384, count: 4, skip: 0, interval: 100 },
  dead: { label: "Dead", start: 387, count: 1, skip: 3, interval: 1000 },
  revive: { label: "Revive", start: 384, count: 4, skip: 0, interval: 100, reverse: true },
  mine: { label: "Mine", start: 184, count: 6, skip: 0, interval: 100 },
  lunge: { label: "Lunge", start: 139, count: 1, skip: 5, interval: 1000 },
  mountStanding: { label: "Mount Stand", start: 416, count: 4, skip: 0, interval: 500 },
  mountWalking: { label: "Mount Walk", start: 448, count: 8, skip: 0, interval: 100 },
  mountRunning: { label: "Mount Run", start: 512, count: 6, skip: 0, interval: 100 },
  mountStruck: { label: "Mount Struck", start: 560, count: 3, skip: 0, interval: 100 },
  mountAttack: { label: "Mount Attack", start: 584, count: 6, skip: 0, interval: 100 },
  fishingCast: { label: "Fish Cast", start: 632, count: 8, skip: 0, interval: 100 },
  fishingWait: { label: "Fish Wait", start: 696, count: 6, skip: 0, interval: 120 },
  fishingReel: { label: "Fish Reel", start: 744, count: 8, skip: 0, interval: 100 },
};

export function actionOffset(action) {
  const spec = PLAYER_ACTIONS[action];
  return spec.count + spec.skip;
}

export function sourceFrameFor(action, frameIndex, direction = EAST_DIRECTION) {
  const spec = PLAYER_ACTIONS[action];
  return spec.start + actionOffset(action) * direction + frameIndex;
}
