<h1 align="center">🚀 RoboCopy Pro</h1>

<p align="center">
  A modern, glassmorphism GUI for Windows Robocopy  
  <br/>
  <b>Fast. Safe. Beautiful.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB"/>
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white"/>
  <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge"/>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/Download-Coming Soon-blue?style=for-the-badge"/></a>
  <a href="#"><img src="https://img.shields.io/github/stars/your-username/your-repo?style=for-the-badge"/></a>
  <a href="#"><img src="https://img.shields.io/github/issues/your-username/your-repo?style=for-the-badge"/></a>
</p>

---

## 🎬 Demo

<div align="center">
  <img src="docs/demo.gif" alt="RoboCopy Pro Demo" width="800"/>
</div>

---

## 🖼 Screenshots

<div align="center">

### 🧩 Setup Interface
<img src="docs/screenshot-main.png" width="800"/>

---

### ⚡ Running Transfer (Live)
<img src="docs/screenshot-running.png" width="800"/>

---

### ✅ Completed Transfer
<img src="docs/screenshot-completed.png" width="800"/>

</div>

---

## ✨ Features

### ⚡ Performance
- Non-blocking architecture (no UI freezes during heavy transfers)
- Multi-threaded copying (`/MT:n`) for maximum speed
- Efficient handling of large-scale file operations

### 🎯 User Experience
- Massive drag-and-drop zones for Source & Destination
- Clean glassmorphism UI with modern design principles
- One-click presets for recurring workflows

### 📊 Monitoring & Feedback
- Real-time Robocopy output parsing
- Live progress bars with ETA calculation
- Syntax-highlighted logs for better readability

### 🖥 Native Integration
- Windows taskbar progress indicators
- Native toast notifications on completion
- Context menu integration (Explorer right-click)

### 🧠 Advanced Controls
- Restartable mode (`/Z`) for unstable transfers
- Mirror mode (`/MIR`) for full directory sync
- Custom retry logic (`/R:n /W:n`)
- File & directory exclusions (`/XD /XF`)

---

## 💡 Why RoboCopy Pro?

Robocopy is incredibly powerful — but not user-friendly.

RoboCopy Pro was built to:
- Eliminate command-line complexity
- Reduce risk of destructive mistakes
- Provide a visual, intuitive workflow
- Bring a modern UI to a legacy tool

---

## 🏗 Architecture

```
React UI (Renderer)
        ↓
Electron (Main Process)
        ↓
Node.js Child Process
        ↓
Windows Robocopy Engine
```

- UI runs independently from heavy file operations  
- Ensures zero freezing even during multi-GB transfers  

---

## 🛠 Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | React + Vite |
| Styling | Tailwind CSS (Glassmorphism UI) |
| Desktop Shell | Electron |
| Backend | Node.js (child_process) |

---

## 🚀 Getting Started

### 📋 Prerequisites
- Windows 10 / 11  
- Node.js 18+ (20+ recommended)  

---

### 💻 Local Development

```bash
npm install
npm run dev
```

---

## 📦 Build & Package

To create a standalone executable:

```bash
npm run build
npm run dist
```

### ⚙️ Build Outputs

| Command | Output |
|--------|--------|
| `npm run dist:portable` | Portable `.exe` (no installation required) |
| `npm run dist:installer` | Installer `.exe` (NSIS setup) |

---

## 🖱 Windows Context Menu Integration

The installer automatically adds a context menu option.

👉 Right-click any folder → **"Transfer with RoboCopy Pro"**

- Instantly opens the app  
- Auto-fills the selected folder as Source  

---

## 📖 Quick Usage Guide

1. Drag & drop folders into **Source** and **Destination**  
2. Choose transfer mode (Copy / Move)  
3. Configure options:  
   - **Mirror (`/MIR`)** – Sync directories *(⚠️ deletes extra files)*  
   - **Resume (`/Z`)** – Restartable transfers  
   - **Threads (`/MT:n`)** – Speed optimization  
   - **Retries (`/R:n /W:n`)** – Error handling  
4. Click **Run Robocopy**  
5. Monitor progress in real-time  

---

## 🗺 Roadmap

- [ ] Recent paths history dropdown  
- [ ] SHA-256 file verification after transfer  
- [ ] Advanced preset management system  
- [ ] Dark mode enhancements  
- [ ] Transfer analytics dashboard  

---

## ⚠️ Disclaimer

Robocopy is a powerful system utility.

⚠️ Features like **Mirror Mode (`/MIR`) are destructive**  
They will delete files in the destination to match the source.

👉 Always double-check before running critical operations.

---

## 🤝 Contributing

Contributions are welcome!

If you have ideas, improvements, or bug fixes:
- Open an issue  
- Submit a pull request  

---

## ⭐ Support

If you find this project useful, consider giving it a **star ⭐**  
It helps the project grow and reach more developers!

---

## 👨‍💻 Author

**Aryan Patel**

---

## 📄 License

This project is licensed under the **MIT License**