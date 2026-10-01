# tendril

An L-system garden. Write a handful of rewriting rules, apply them a few
times, and hand the resulting string to a turtle with a pen: ferns, bushes,
weeds and space-filling curves grow out of a few characters of grammar.

**Live demo:** https://fushanbobfan.github.io/tendril/

No build step and no dependencies. The rewriting, the turtle, the presets,
the settings, the colour ramps and the stroke batching are plain ES modules
covered by a Node test suite; only `src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## Things to try

**Watch a weed vary.** The page opens on *Stochastic weed*, whose single
letter `F` has three possible rewrites. Press *New seed* (or <kbd>N</kbd>)
a few times: every seed is a different specimen of the same species.

**Step through generations.** Pick *Reed* or *Fern* and press
<kbd>[</kbd> and <kbd>]</kbd>. Generation 0 is just the axiom; each step
rewrites every letter at once. The status line shows how fast the word
grows.

**Bend the angle.** On *Dragon curve* or *Hexagonal Gosper curve*, drag
the turn angle a little away from 90° or 60°. The curve stops tiling the
plane and curls into spirals and lace.

**Write your own.** Edit the axiom or the rules; the drawing follows as
you type, and a malformed line is reported with its line number. Try
`F -> F[+F]F[-F][F]` and then add a second line `F (0.5) -> F[-F]F` to
make it random.

**Breed a new species.** Press *Breed six offspring* (or <kbd>B</kbd>).
Each thumbnail changes one thing in the grammar, and its caption says
what: a branch grafted on or pruned off, a turn flipped or added, a stem
doubled, or the turn angle nudged. Click the one you like; it becomes the
current plant and a new litter appears. *Back to parent* (<kbd>Z</kbd>)
walks back up the line. A few picks from *Fern* or *Herb* are enough to
reach plants no preset contains.

**Take it with you.** *Copy share link* stores the grammar and every
setting in the URL; *Save PNG* renders a 2048 px image and *Save SVG*
writes the strokes as vector paths.

## Grammar

One production per line:

```
X -> F[+X]F[-X]+X
F -> FF
```

- `->`, `→` or `=` separate the letter from its replacement.
- Several lines for the same letter make a random choice each time that
  letter is rewritten. An optional weight in parentheses biases it:
  `F (2) -> F[-F]F`. Weights default to 1.
- Letters without a production are copied unchanged.
- `#` starts a comment. Spaces inside a replacement are ignored.
- Random choices come from a seeded generator, so the same seed always
  grows the same plant.

To stay responsive, growth stops at the last generation that keeps the
word under 1.5 million symbols, and the status line says so.

## Breeding

Breeding follows the spirit of Richard Dawkins's biomorphs: you are the
selection, and the grammar is the genome. One mutation per offspring:

| Edit | What changes |
| --- | --- |
| graft | inserts `[+X]` or `[-X]` (a growing letter on a side branch) somewhere in one rule |
| prune | removes one bracketed branch, nested branches included |
| flip | turns one `+` into `-` or back |
| bend | inserts a `+` or `-` |
| stretch | doubles one drawing letter |
| angle | moves the turn angle by 2 to 8 degrees |

Edits always keep brackets balanced and rules at most 64 symbols long, and
a litter never shows the same offspring twice. When a letter has several
random choices, one choice is edited and the weights are kept. Thumbnails
are grown with a lower symbol limit so a litter appears at once; the
chosen plant is regrown at full size.

## Turtle commands

| Symbol | Meaning |
| --- | --- |
| drawing letters | step forward with the pen down (set per grammar, `F` by default) |
| `f` | step forward with the pen up |
| `+` / `-` | turn left / right by the turn angle |
| `\|` | turn around |
| `[` / `]` | save / restore position, heading, pen width and step |
| `!` | narrow the pen |
| `"` | shorten the step |

Any other letter is ignored by the turtle, so helper letters such as `X`
can steer the rewriting without drawing anything. *Angle jitter* adds a
random wobble to every turn, again from the seed.

Branching drawings are coloured by bracket depth, trunk to twig, and their
strokes taper with depth; unbranched curves are coloured from start to end
so the order in which the path visits the plane is visible.

## Presets

The plants (*Herb*, *Sprig*, *Shrub*, *Reed*, *Sapling*, *Fern*), the
stochastic weed, the quadratic Koch island, the dragon curve, the
Sierpinski gasket and the hexagonal Gosper curve use the L-systems printed
in chapter 1 of Prusinkiewicz and Lindenmayer,
[*The Algorithmic Beauty of Plants*](https://algorithmicbotany.org/papers/#abop)
(1990), with the book's edge letters F<sub>l</sub> and F<sub>r</sub>
written as `A` and `B`. The Koch snowflake, Hilbert and Lévy curves are
standard textbook forms.

The tests check the presets geometrically: the Koch island closes on
itself, the Hilbert curve visits every cell of its grid exactly once, the
dragon curve never retraces an edge, and the gasket and Gosper curves
multiply their segment counts by 3 and 7 per generation.

## Accessibility

- Every control is a labelled native input; keyboard shortcuts are ignored
  while typing in a field.
- The canvas carries a text description of what is drawn (name,
  generation, stroke count, branch depth), and the status line is a polite
  live region.
- Growth animation is off by default when the system asks for reduced
  motion; the drawing then appears at once.
- Every palette keeps all of its stroke colours at 3:1 contrast or better
  against its background, checked by the tests.

## Layout

```
index.html         page shell
style.css          styles
src/lsystem.js     rule parsing, rewriting, symbol cap
src/rng.js         seeded generator
src/turtle.js      turtle interpretation and fit-to-box transform
src/presets.js     preset grammars
src/params.js      settings, clamping, share links
src/palette.js     colour ramps and contrast check
src/render.js      stroke batching and SVG export
src/mutate.js      grammar mutations and litters for breeding
src/main.js        DOM wiring, animation, breeding, exports
test/              node:test suites
```

## License

MIT
