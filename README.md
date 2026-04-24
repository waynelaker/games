# Games

A collection of simple games hosted on GitHub Pages at `games.laker.nz`.

## Project Structure

```
games/
├── index.html                 (Hub entry point)
├── styles.css                 (Hub styles)
├── CNAME                      (Custom domain)
├── trivi/                     (Link to trivi game)
└── README.md
```

## Setup

No build process needed! This is pure static HTML/CSS/JS. Just clone and push to GitHub.

## Adding a New Game

1. Create a new folder for your game:
   ```
   /my-game/
   ```

2. Add the required files:
   - `index.html` - Your game's HTML
   - `styles.css` - Your game's styles (optional, can be inline)

3. Update the hub (`index.html`) to add a link to your new game.

4. Commit and push - that's it!

## Deployment

GitHub Pages automatically serves this from `games.laker.nz` using:
- Custom domain: `games.laker.nz` (configured in CNAME file)
- Source: Deploy from `main` branch
- Everything is static - no build needed

## Game URLs

- Hub: `https://games.laker.nz/`
- Trivi: `https://games.laker.nz/trivi/`

## License

MIT
