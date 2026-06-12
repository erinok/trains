# Bugs first — fix the core systems before building on them

- [x] [BUG] sometimes trains pass through the raised bridge -- especially if going in reverse
- [x] [BUG] if a train is waiting at a closed switch and another train passes by, they collide -- but they should not! they are on separate tracks
- [x] [BUG] jumping over the brdige -- sometimes the jump does not follow the arc of the bridge
- [x] [BUG] choo choo going over the bridge -- the anims are choppy, first choo choo anim, then tinder fall anim; should all happen at same time
- [x] [BUG] the monkey jumps onto the train upside down and you can only see the feet
- [x] [BUG] 'x' to remove train does not work

# Small features & polish — mostly build on the systems we just fixed

- [x] when removing a train with x, have it crash, rather than just disappear
- [x] for bridge, lights should be red when up, green when down
- [x] when the bridge is lowered and the train derrick comes to rescue the tinder, temporarily override the camera to follow the train derrick, until the tinder is back on the track again
- [x] give the tunnel an inside (looks like a wall currently, platform 9 and 3/4 style)
- [x] make reverse train a *little* bit more physical / inertial -- slow down, then stop, then regain speed
- [x] when in train follow mode, make space key an alias for toggling state of upcoming switch or bridge (rebind horn to something else) (don't change UI or signage, just a silent alias) (keep in mind upcoming is reversed if train is going backwards)

# Animal system — generalize once, then add species

- [x] let multiple animals jump onto a train, as long as there is a free car
- [x] let cows jump onto the train too
- [x] pigs should be able to jump onto the train
- [x] let cows sometimes wander onto the track and get pushed aside  OR jump on the train (if room, half the time) (don't crash the train)

# Big structural changes — last, so they don't invalidate earlier work

- [x] add a top-down world overview camera
- [x] no intro screen for game, start w/o any trains initially, in overview camera
- [x] expand the world -- right now it feels like one big circular track all in the same world; make 4 roughly circular worlds w/ different themes, that are part of the same broader rail network, you can move between adjacent worlds
