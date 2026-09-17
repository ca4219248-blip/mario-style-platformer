# Super Pixel Bros — Mario-style Platformer

A tiny, open source, Mario-style 2D platformer built with **vanilla JavaScript** and **HTML5 Canvas**. No frameworks, no game engines, no external assets — every sprite is drawn with code, and every sound is generated with the Web Audio API.

> **Note:** This is an original homage to classic platformers. It contains no Nintendo assets, code, or trademarks — all art is drawn programmatically and all content is original.

## How to Play

Just open `index.html` in any modern browser — or run a local server:

```bash
# Option 1: simply double-click index.html

# Option 2: local server (recommended)
python3 -m http.server 8000
# then open http://localhost:8000
```

**Play it online:** [GitHub Pages link — enable Pages in repo settings, then update this line]

## Controls

| Key | Action |
| --- | --- |
| ← → / A D | Move left / right |
| Space / ↑ / W | Jump |
| Enter | Start / Restart |

## Features

- Classic run-and-jump platforming with gravity, friction, and variable jumps
- Tile-based level: bricks, `?` blocks (hit from below for coins), pipes, platforms
- Coins, goombas (stomp them!), a flag-pole finish, score + lives + timer
- Scrolling camera with parallax hills and clouds
- Retro sound effects generated via Web Audio (no audio files)
- Everything in a single `game.js` (~500 lines, commented) — easy to read and mod

## Customizing the Level

The level is a plain array of strings in `game.js`. Each character is a tile:

```
#  solid ground      B  brick block      ?  question block (gives a coin)
=  green platform    P  pipe              o  coin
g  goomba spawn      F  flag pole         M  player start
```

Edit the `LEVEL` array to design your own stage — no other changes needed.

## Tech

- Vanilla JavaScript (ES6), HTML5 Canvas, Web Audio API
- Zero dependencies, zero build steps

## License

[MIT](LICENSE) — free to use, copy, modify, and redistribute.
