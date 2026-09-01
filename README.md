# 🚂 Choo Choo World

A three.js train set for a small engineer. **Four themed worlds** — the
countryside, a snow world, a desert, and a jungle — joined into one big rail
network, with a bidirectional track graph, twelve animated switches, trains at
their real top speeds running either direction (head-on crashes!), and a
double-leaf drawbridge with a famous jump.

## How to run

Double-click `index.html` (needs internet once, for the three.js CDN), or:

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```

Touchscreen friendly — an iPad is ideal. Press **H** (or ❓) for the key card.
The game opens on the **world map** with no trains — tap a train to begin.

## The worlds

The classic countryside has two big loops sharing a middle crossover (switches
**Q W E R T Y**): pond country 🦆, the mountains ⛰️ (two tunnels you can see
all the way through), windmill meadow 🌼 with a pig wallow, the harbor ⚓
(canal, drawbridge, barge, lighthouse), a farm with mooing cows, and an apple
orchard.

In the mountains, switch **U** opens the line to the wider world: north to the
**snow world** ⛄ (snowman, igloo, icy peaks — switches **I**/**K**), east
across the long straight to the **desert** 🏜️ (pyramid, cacti, red-rock arch —
**J**/**L**), and south to the **jungle** 🌋 (smoking volcano, monkeys,
switch **N**). Both jungle routes end at the volcano buffers; press **V** to
reverse and head home. A train coming up the wrong way at any switch stops,
toots, and waits for you to flip it. Flip a switch while a train is halfway across and the cars
that haven't made it yet derail!

Pass close by the ducks, monkeys, cows, or pigs and they leap aboard — one
animal per free car, as many as the train has room for. Cows sometimes wander
onto the track near the farm: a passing train either tempts one aboard or
shoos her aside in a puff of dust (never a crash). Each train brings its own
era-matched background tune.

## The trains

In order of the year the real engine (or book) appeared:
CATCH ME 1808 · ROCKET 1829 · CHOO CHOO 1937 · MALLARD 1938 · DIESEL 1939 · BULLET 1964
(each starts at its real top speed; the slider sets exact mph, up to 400).

The **➡️/⬅️ button (or `D`)** sets which direction the next train spawns —
spawn two trains facing each other and watch the head-on 💥. **V** throws a
running train into reverse: it brakes, pauses a beat, then pulls away the
other way. **✕** (or `X`) crashes a train on the spot. Crashed cars tumble,
bounce, and pop one by one into dust. Spawning never fails: if the station is
busy, the new train lines up behind.

The drawbridge (`B`) splits in the middle and both halves lift — red lights
when it's up, green when it's down. When it's up, every train charges the near
leaf and leaps off it in a clean arc — but only **Choo Choo** makes it whole:
her tender drops onto the coal barge mid-flight, just like in the book, while
other trains' cars fly off the tip into the canal. Lower the bridge with a
tender stranded on the barge and the camera rides along as a derrick car
hurries out to set it back on the rails — back into it gently to couple it on
(run into it and... 💥).

## Keys

| | | | |
|---|---|---|---|
| `1`–`6` trains | `7`–`0` stations | `Q`–`Y` switches | `U I K J L N` far switches |
| `B` bridge | `D` spawn direction | `V` reverse train | `X` remove (crash!) |
| `S` whistle | `SPACE` flip what's ahead (in follow mode) | `G` go/stop | |
| `↑` `↓` speed | `←` `→` next train | `C` camera angle | `O` map / tour |
| `P` next spot | `M` mute | `H` help (`ESC` closes) | |

The 🗺️ button (or `O`) alternates between the top-down **world map** and the
flying tour. Tapping works for everything too: trains, stations, switches,
the bridge, ducks, monkeys, cows, pigs.

## Testing params (grown-ups only)

`?empty=1` no default train (now the default) · `&warp=20` fast-forward ·
`&spawn=mallard@2,catchme@0r:80` spawn at stations (`r` = reverse, `:80` = mph) ·
`&follow=mallard&angle=1` · `&tour=1` · `&bridge=up` · `&sw=1,0,0,0,0,0,1` (12 switches:
Q W E R T Y U I K J L N) · `&view=x,z[,dist,height]` fixed camera · `&snap=1` no easing ·
`&help=1` show keys · `&keys=5:v,8:b` scripted key presses at sim-seconds ·
`&dbg=1` per-second train/rider log to console · `&hide=tints,patches,water,shadows`
scene-layer bisection.
