# 🚂 Choo Choo World

A three.js train set for a small engineer. A four-region world with a
bidirectional track network, six animated switches, trains at their real top
speeds running either direction (head-on crashes!), and a double-leaf
drawbridge with a famous jump.

## How to run

Double-click `index.html` (needs internet once, for the three.js CDN), or:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Touchscreen friendly — an iPad is ideal. Press **H** (or ❓) for the key card.

## The world

Two big loops share a middle crossover, giving six switches (**Q W E R T Y**,
each labeled in the world). The points physically move — you can see which way
the rails connect. A train coming up the wrong way at a switch stops, toots,
and waits for you to flip it. Flip a switch while a train is halfway across and
the cars that haven't made it yet derail! Regions: pond country 🦆, the
mountains ⛰️ (two tunnels), windmill meadow 🌼, and the harbor ⚓ (canal,
drawbridge, barge, lighthouse), plus a farm with mooing cows and an apple
orchard. Pass close by the ducks, monkeys, or cows and one may leap aboard for
a ride. Each train brings its own era-matched background tune.

## The trains

In order of the year the real engine (or book) appeared:
CATCH ME 1808 · ROCKET 1829 · CHOO CHOO 1937 · MALLARD 1938 · DIESEL 1939 · BULLET 1964
(each starts at its real top speed; the slider sets exact mph, up to 400).

The **➡️/⬅️ button (or `D`)** sets which direction the next train spawns —
spawn two trains facing each other and watch the head-on 💥. **V** throws a
running train into reverse. Crashed cars tumble, bounce, and pop one by one
into dust. Spawning never fails: if the station is busy, the new train lines
up behind.

The drawbridge (`B`) splits in the middle and both halves lift. When it's up,
every train charges the near leaf and jumps — but only **Choo Choo** makes it
whole: her tender drops onto the coal barge, just like in the book, while
other trains' cars fly off the tip into the canal. Lower the bridge with a
tender stranded on the barge and a derrick car hurries out to set it back on
the rails — back into it gently to couple it on (run into it and... 💥).

## Keys

| | | | |
|---|---|---|---|
| `1`–`6` trains | `7`–`0` stations | `Q`–`Y` switches | `B` bridge |
| `D` spawn direction | `V` reverse train | `SPACE` whistle | `G` go/stop |
| `↑` `↓` speed | `←` `→` next train | `C` camera angle | `O` tour |
| `P` next spot | `M` mute | `H` help (`ESC` closes) | |

Tapping works for everything too: trains, stations (flies the camera there),
switches, the bridge, ducks, monkeys, cows.

## Testing params (grown-ups only)

`?nosplash=1` skip splash · `&empty=1` no default train · `&warp=20` fast-forward ·
`&spawn=mallard@2,catchme@0r:80` spawn at stations (`r` = reverse, `:80` = mph) ·
`&follow=mallard&angle=1` · `&tour=1` · `&bridge=up` · `&sw=1,0,0,0,0,0` ·
`&view=x,z[,dist,height]` fixed camera · `&snap=1` no easing · `&help=1` show keys ·
`&keys=5:v,8:b` scripted key presses at sim-seconds · `&dbg=1` per-second train
log to console · `&hide=tints,patches,water,shadows` scene-layer bisection.
