# Games

A collection of simple games hosted on GitHub Pages.

## Project Structure

```
games/
├── src/
│   ├── index.html                 (Hub entry point)
│   ├── hub/
│   │   ├── main.js                (Hub scripts)
│   │   └── styles.css             (Hub styles)
│   └── games/
│       ├── game1/
│       │   ├── index.html
│       │   ├── main.js
│       │   └── styles.css
│       ├── game2/
│       │   ├── index.html
│       │   ├── main.js
│       │   └── styles.css
│       └── ... (add more games here)
├── dist/                          (Built output)
├── package.json
├── vite.config.js
└── README.md
```

## Getting Started

### Prerequisites
- Node.js and npm installed

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`

### Build

```bash
npm run build
```

The built files will be in the `dist/` directory and ready to be deployed to GitHub Pages.

## Adding a New Game

1. Create a new folder in `src/games/` with your game name:
   ```
   src/games/my-game/
   ```

2. Add the required files:
   - `index.html` - Your game's HTML
   - `main.js` - Your game's JavaScript
   - `styles.css` - Your game's styles

3. The build system will automatically detect and build it!

4. Update the hub (`src/index.html`) to add a link to your new game.

## Deployment

This project is configured to be deployed on GitHub Pages using the `games.laker.nz` domain.

The games will be accessible at:
- Hub: `https://games.laker.nz/`
- Game 1: `https://games.laker.nz/games/game1/`
- Game 2: `https://games.laker.nz/games/game2/`
- Trivi: `https://games.laker.nz/trivi/`

## License

MIT
