# Sfumato

Living oil painting studio for [Orbit](https://www.anchorturtle.com/). Wet-on-wet pigment, a glass mix board, artist palettes, and local-only saves.

JestR / [anchorturtle.com](https://www.anchorturtle.com/)

Live page: `/sfumato` (same studio as `/`). Navbar: Orbit · Gallery · Sfumato.

## Paint

- Oil physics: smear, pickup, viscosity, impasto, sheen
- Mix board: drop, knife, pick — drag a swatch onto the linen to fill
- Palettes: JestR, tubes, themes, artists, plus a personal Mine set
- Travellers: offer a local save (nothing is stored on the server until JestR publishes)
- Enlarge: dedicated paint HUD (tools, color, undo, zoom, Exit). No blank-canvas control in enlarge.

Paint stays in your browser (IndexedDB). Offers are share/download only.

Studio canvas is 1920×1440.

## Run

```bash
npm install
npm run dev
```

Studio at `http://localhost:8080` and `http://localhost:8080/sfumato`.

```bash
npm run build
npm run typecheck
```

To put it on Orbit, add a dock button pointing at `/sfumato` and deploy this app at that path (or a `sfumato.` subdomain).

## Stack

TanStack Start, React 19, Tailwind v4, Vite. Canvas oil engine in `src/lib/oil/`.

## License

Source is published for collaboration with JestR / Orbit. Free to paint on. Ask before shipping a fork as your own product.
