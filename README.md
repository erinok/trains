# 🚂 Choo Choo World

A three.js train set for a small engineer. Six famous trains run laps around a
looping track with a tunnel, a bridge over a duck pond, a station, swinging
monkeys, and paddling ducks. All sounds are synthesized in the browser — no
audio files, no build step, no install.

## How to run

Double-click `index.html` (it needs internet once, to fetch three.js from a CDN),
or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Works on a touchscreen — an iPad is ideal.

## The trains

| Button | Train | Why it's here |
|---|---|---|
| CHOO CHOO | The little engine who ran away | from the Virginia Lee Burton book |
| ROCKET | Stephenson's Rocket, 1829 | winner of the Rainhill Trials |
| CATCH ME | Trevithick's Catch Me Who Can, 1808 | ran on a circle, just like this one |
| MALLARD | LNER A4 4468 | fastest steam engine ever, 126 mph |
| DIESEL | a diesel-electric streamliner | pulls boxcar, tanker, logs, caboose |
| BULLET | an electric bullet train | pantograph and all |

## Things to do

- **Tap the engine** — it whistles (every train has its own voice)
- **Tap a duck** — quack! wing flapping
- **Tap a monkey** — ooh-ooh-aah! it does a flip (one is hiding on the tunnel hill)
- **WHISTLE!** button, **GO/STOP**, speed: 🐢 🚂 🚀
- **📷** cycles camera: chase → driver's view → bird view
- Every lap earns a ⭐ with a fanfare
- 🔊 top-right mutes everything (parents' favorite button)

Keyboard: `space` whistle · `1`–`6` choose train · `g` go/stop · `c` camera.

## Testing params (grown-ups only)

`?nosplash=1` skip the start screen · `&warp=20` fast-forward 20 s ·
`&train=mallard` start with a given train · `&cam=2` camera mode ·
`&view=x,z[,dist,height]` fixed inspection camera · `&snap=1` no camera easing ·
`&debug=1` HUD shows speed/position.
