# RoboCopy Pro

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)

A modern, glassmorphism GUI wrapper for Windows Robocopy. Built for speed, safety, and a frictionless user experience, it transforms complex command-line file operations into a seamless visual workflow.

<div align="center">
  <img src="docs/screenshot-main.png" alt="RoboCopy Pro Main Interface" width="800"/>
</div>

## ✨ Highlights
* **Frictionless UX:** Massive drag-and-drop zones for Source and Destination routing.
* **Non-Blocking Architecture:** The React UI thread is completely isolated from the heavy I/O Robocopy child processes, ensuring the app never freezes during massive multi-gigabyte transfers.
* **Live Telemetry:** Real-time Robocopy output parsing with syntax highlighting, visual progress bars, and ETA calculations.
* **Native Integration:** Windows Taskbar progress indicators and native Toast notifications upon completion.
* **Advanced Controls:** Granular control over thread counts (`/MT:n`), restartable modes (`/Z`), and directory exclusions (`/XD /XF`).
* **One-Click Presets:** Save and load complex configurations for recurring backup tasks.

## 🛠 Tech Stack
* **Frontend:** React + Vite
* **Styling:** Tailwind CSS (Custom Squircle & Glassmorphism UI)
* **Desktop Shell:** Electron
* **System APIs:** Native Node.js child-process execution

## 🚀 Getting Started

### Prerequisites
* Windows 10/11
* Node.js 18+ (20+ recommended)

### Local Development
Clone the repository and run the development server:
```bash
npm install
npm run dev
```
Build & Package
To compile the application into a standalone executable:

Bash
npm run build
npm run dist
Renderer assets are generated in dist/app/.

Executables are generated in the release/ folder:

npm run dist:portable -> Portable .exe (No installation required)

npm run dist:installer -> Installer .exe (NSIS)

🖱 Windows Context Menu Integration
The NSIS installer automatically adds a Windows Explorer context-menu action. Simply right-click any folder in Windows and select "Transfer with RoboCopy Pro". The app will launch with your selected folder instantly locked in as the Source.

📖 Quick Usage Guide
Drag and drop a folder into Source and Destination.

Select your Transfer Mode (Copy or Move).

Adjust essential options:

Mirror (/MIR): Mirrors source to destination (Warning: Deletes extra files in destination).

Resume (/Z): Restartable mode for unstable network transfers.

Threads (/MT:n): Enables multi-threaded copying for high-speed I/O.

Retries (/R:n /W:n): Configures retry attempts and wait times for locked files.

Click Run Robocopy and monitor the live terminal.

🗺 Roadmap
[ ] Implement Recent Paths history dropdown

[ ] Post-transfer cryptographic hash verification (SHA-256)

[ ] Expanded rich-preset management

⚠️ Disclaimer
Robocopy is a highly powerful system utility. Features like Mirror Mode (/MIR) are destructive and will delete files in the destination directory to match the source. Use with caution.

👨‍💻 Author
Aryan Patel * If you find this tool helpful or use it in your daily workflow, consider giving the repo a ⭐!

📄 License
This project is licensed under the MIT License.
