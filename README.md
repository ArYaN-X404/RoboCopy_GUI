# RoboCopy Pro

A modern, glassmorphism Robocopy GUI for Windows with drag‑drop folders, live logs, presets, and high‑speed transfer options.

## Highlights
- Drag & drop source and destination folders
- Clean copy/move modes with safe defaults
- Live Robocopy output with syntax highlighting
- Progress, ETA, and taskbar progress
- Presets for quick reuse
- Advanced options (threads, retries, wait, excludes)
- High‑speed toggle for maximum throughput
- Windows notifications on completion

## Tech Stack
- React + Vite
- Tailwind CSS
- Electron (desktop shell)

## Screenshots
Add your screenshots here:
- `docs/screenshot-main.png`
- `docs/screenshot-terminal.png`

## Requirements
- Windows 10/11
- Node.js 18+ (recommended 20+)

## Getting Started
```bash
npm install
npm run dev
```

## Build (Portable EXE)
```bash
npm run build
npm run dist
```
The portable executable will be generated in `dist/`.

## Usage
1. Drop a folder into **Source** and **Destination**.
2. Choose **Copy** or **Move**.
3. Adjust options (Mirror, Resume, Logging, etc.).
4. Click **Run Robocopy**.

## Options (Quick Guide)
- **Mirror**: `/MIR` mirrors source to destination (deletes extras)
- **Resume**: `/Z` restartable mode (safer but slower)
- **High‑Speed**: minimizes output and disables slow options
- **Threads**: `/MT:n` parallel copy for faster I/O
- **Retries/Wait**: `/R:n /W:n` for locked files
- **Exclude**: `/XD /XF` (comma‑separated patterns)

## Troubleshooting
**Blank window after build**
- Ensure `vite.config.js` uses `base: './'`
- In Electron, `loadFile` should point to built `dist/index.html`

**Robocopy exit codes**
- Some non‑zero codes are warnings (not always failures)
- Check the live console output for details

## Roadmap Ideas
- Recent paths
- Context‑menu integration
- Hash verification
- Richer presets

## Disclaimer
Robocopy is powerful. **/MIR can delete files** in the destination. Use carefully.

## License
MIT
