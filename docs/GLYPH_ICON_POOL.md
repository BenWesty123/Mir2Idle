# Glyph icon pool (unused frames)

> **For agents / glyph authors.** These frames are ready to assign to new glyphs.
> They are derived variants (flip / hue / channel swap / themed tints) of Body Glyph
> frames 3200-3227. Preview gallery: `docs/glyph-variant-preview/index.html`.
>
> Regenerate / re-promote: `npm run glyph:variants:promote`
> (see `tools/generate-glyph-variants.ps1`).

Last updated: 2026-08-08

## How to use on a new glyph

1. Pick an **unused** frame from the table below (prefer colored sources over near-white ones like 3200 / 3220 - hue shifts barely show on those).
2. Set the glyph item `icon.src` to:
   `./public/item-icons/items/frame_00XXXX.png`
3. Run `npm run build:item-atlas` so the atlas picks it up.
4. Mark the frame as used in this file (move its row to **In use** or delete it) when you ship the glyph.

## In use (from this pool)

| File | Frame | Glyph |
|------|------:|-------|
| `frame_003238.png` | 003238 | Glyph of Angelic Deva (`glyph-angelic-deva`) |
| `frame_003244.png` | 003244 | Glyph of Frenzied Disruptor (`glyph-frenzied-disruptor`) |
| `frame_003249.png` | 003249 | Glyph of Deep Frost (`glyph-deep-frost`) |
| `frame_003261.png` | 003261 | Glyph of Blade Momentum (`glyph-blade-momentum`) |
| `frame_003253.png` | 003253 | Glyph of Vitality (`glyph-vitality`) |
| `frame_003243.png` | 003243 | Glyph of Slow Destruction (`glyph-slow-destruction`) |

Original matching Body Glyph range **3200-3227** is mostly assigned. Frames **3225–3227**
(and their pool variants 3294–3317 / similar) are **glowing cubes**, not spiral glyphs —
do not use them when you need an icon that reads as a Body Glyph rune. Frame **3226** was
freed when Slow Destruction moved off the cube silhouette. Prefer unused spiral frames
from sources **3205 / 3210 / 3215 / 3220** (see table below).

## Available (unused) frames 3230-3317

| File | Frame | Source | Transform | Label |
|------|------:|-------:|-----------|-------|
| `frame_003230.png` | 003230 | 003200 | flip | flip H |
| `frame_003231.png` | 003231 | 003200 | hue60 | hue +60 |
| `frame_003232.png` | 003232 | 003200 | hue120 | hue +120 |
| `frame_003233.png` | 003233 | 003200 | hue180 | hue +180 |
| `frame_003234.png` | 003234 | 003200 | hue240 | hue +240 |
| `frame_003235.png` | 003235 | 003200 | flip-hue90 | flip + hue +90 |
| `frame_003236.png` | 003236 | 003200 | flip-hue200 | flip + hue +200 |
| `frame_003237.png` | 003237 | 003200 | swap-rb | swap R/B |
| `frame_003239.png` | 003239 | 003200 | fire | fire (hue+sat) |
| `frame_003240.png` | 003240 | 003200 | shadow | shadow |
| `frame_003241.png` | 003241 | 003205 | flip | flip H |
| `frame_003242.png` | 003242 | 003205 | hue60 | hue +60 |
| `frame_003245.png` | 003245 | 003205 | hue240 | hue +240 |
| `frame_003246.png` | 003246 | 003205 | flip-hue90 | flip + hue +90 |
| `frame_003247.png` | 003247 | 003205 | flip-hue200 | flip + hue +200 |
| `frame_003248.png` | 003248 | 003205 | swap-rb | swap R/B |
| `frame_003250.png` | 003250 | 003205 | fire | fire (hue+sat) |
| `frame_003251.png` | 003251 | 003205 | shadow | shadow |
| `frame_003252.png` | 003252 | 003210 | flip | flip H |
| `frame_003254.png` | 003254 | 003210 | hue120 | hue +120 |
| `frame_003255.png` | 003255 | 003210 | hue180 | hue +180 |
| `frame_003256.png` | 003256 | 003210 | hue240 | hue +240 |
| `frame_003257.png` | 003257 | 003210 | flip-hue90 | flip + hue +90 |
| `frame_003258.png` | 003258 | 003210 | flip-hue200 | flip + hue +200 |
| `frame_003259.png` | 003259 | 003210 | swap-rb | swap R/B |
| `frame_003260.png` | 003260 | 003210 | cold | cold (sat+ light-) |
| `frame_003262.png` | 003262 | 003210 | shadow | shadow |
| `frame_003263.png` | 003263 | 003215 | flip | flip H |
| `frame_003264.png` | 003264 | 003215 | hue60 | hue +60 |
| `frame_003265.png` | 003265 | 003215 | hue120 | hue +120 |
| `frame_003266.png` | 003266 | 003215 | hue180 | hue +180 |
| `frame_003267.png` | 003267 | 003215 | hue240 | hue +240 |
| `frame_003268.png` | 003268 | 003215 | flip-hue90 | flip + hue +90 |
| `frame_003269.png` | 003269 | 003215 | flip-hue200 | flip + hue +200 |
| `frame_003270.png` | 003270 | 003215 | swap-rb | swap R/B |
| `frame_003271.png` | 003271 | 003215 | cold | cold (sat+ light-) |
| `frame_003272.png` | 003272 | 003215 | fire | fire (hue+sat) |
| `frame_003273.png` | 003273 | 003215 | shadow | shadow |
| `frame_003274.png` | 003274 | 003220 | flip | flip H |
| `frame_003275.png` | 003275 | 003220 | hue60 | hue +60 |
| `frame_003276.png` | 003276 | 003220 | hue120 | hue +120 |
| `frame_003277.png` | 003277 | 003220 | hue180 | hue +180 |
| `frame_003278.png` | 003278 | 003220 | hue240 | hue +240 |
| `frame_003279.png` | 003279 | 003220 | flip-hue90 | flip + hue +90 |
| `frame_003280.png` | 003280 | 003220 | flip-hue200 | flip + hue +200 |
| `frame_003281.png` | 003281 | 003220 | swap-rb | swap R/B |
| `frame_003282.png` | 003282 | 003220 | cold | cold (sat+ light-) |
| `frame_003283.png` | 003283 | 003220 | fire | fire (hue+sat) |
| `frame_003284.png` | 003284 | 003220 | shadow | shadow |
| `frame_003285.png` | 003285 | 003225 | flip | flip H |
| `frame_003286.png` | 003286 | 003225 | hue60 | hue +60 |
| `frame_003287.png` | 003287 | 003225 | hue120 | hue +120 |
| `frame_003288.png` | 003288 | 003225 | hue180 | hue +180 |
| `frame_003289.png` | 003289 | 003225 | hue240 | hue +240 |
| `frame_003290.png` | 003290 | 003225 | flip-hue90 | flip + hue +90 |
| `frame_003291.png` | 003291 | 003225 | flip-hue200 | flip + hue +200 |
| `frame_003292.png` | 003292 | 003225 | swap-rb | swap R/B |
| `frame_003293.png` | 003293 | 003225 | cold | cold (sat+ light-) |
| `frame_003294.png` | 003294 | 003225 | fire | fire (hue+sat) |
| `frame_003295.png` | 003295 | 003225 | shadow | shadow |
| `frame_003296.png` | 003296 | 003226 | flip | flip H |
| `frame_003297.png` | 003297 | 003226 | hue60 | hue +60 |
| `frame_003298.png` | 003298 | 003226 | hue120 | hue +120 |
| `frame_003299.png` | 003299 | 003226 | hue180 | hue +180 |
| `frame_003300.png` | 003300 | 003226 | hue240 | hue +240 |
| `frame_003301.png` | 003301 | 003226 | flip-hue90 | flip + hue +90 |
| `frame_003302.png` | 003302 | 003226 | flip-hue200 | flip + hue +200 |
| `frame_003303.png` | 003303 | 003226 | swap-rb | swap R/B |
| `frame_003304.png` | 003304 | 003226 | cold | cold (sat+ light-) |
| `frame_003305.png` | 003305 | 003226 | fire | fire (hue+sat) |
| `frame_003306.png` | 003306 | 003226 | shadow | shadow |
| `frame_003307.png` | 003307 | 003227 | flip | flip H |
| `frame_003308.png` | 003308 | 003227 | hue60 | hue +60 |
| `frame_003309.png` | 003309 | 003227 | hue120 | hue +120 |
| `frame_003310.png` | 003310 | 003227 | hue180 | hue +180 |
| `frame_003311.png` | 003311 | 003227 | hue240 | hue +240 |
| `frame_003312.png` | 003312 | 003227 | flip-hue90 | flip + hue +90 |
| `frame_003313.png` | 003313 | 003227 | flip-hue200 | flip + hue +200 |
| `frame_003314.png` | 003314 | 003227 | swap-rb | swap R/B |
| `frame_003315.png` | 003315 | 003227 | cold | cold (sat+ light-) |
| `frame_003316.png` | 003316 | 003227 | fire | fire (hue+sat) |
| `frame_003317.png` | 003317 | 003227 | shadow | shadow |

## Quick pick list

Frames: `3230, 3231, 3232, 3233, 3234, 3235, 3236, 3237, 3238, 3239, 3240, 3241, 3242, 3243, 3245, 3246, 3247, 3248, 3249, 3250, 3251, 3252, 3254, 3255, 3256, 3257, 3258, 3259, 3260, 3262, 3263, 3264, 3265, 3266, 3267, 3268, 3269, 3270, 3271, 3272, 3273, 3274, 3275, 3276, 3277, 3278, 3279, 3280, 3281, 3282, 3283, 3284, 3285, 3286, 3287, 3288, 3289, 3290, 3291, 3292, 3293, 3294, 3295, 3296, 3297, 3298, 3299, 3300, 3301, 3302, 3303, 3304, 3305, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 3313, 3314, 3315, 3316, 3317`

## Notes

- PNGs live in `public/item-icons/items/`. The atlas only packs icons referenced from `items.json`, so unused pool frames do not bloat the shipped atlas until assigned.
- Gallery / contact sheet (not required in-game): `docs/glyph-variant-preview/`.
- Stronger looking picks tend to come from sources **3205, 3210, 3215, 3225, 3226, 3227** with `hue*`, `cold`, `fire`, `shadow`, or `flip-hue*`.
