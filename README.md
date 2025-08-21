# Advanced Launcher for ComfyUI

**Advanced Launcher for ComfyUI** is a desktop application (Electron) that simplifies launching and managing ComfyUI.  
The project allows you to quickly start, configure, and control your ComfyUI workspace.

## Features
- Simple interface for launching ComfyUI
- Start-up parameter configuration
- Local environment integration
- Easy installation and usage

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/advanced-launcher-comfyui.git
   cd advanced-launcher-comfyui
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app:
   ```bash
   npm start
   ```

## Project Structure
```
index.html   - app interface
main.js      - Electron main process
preload.js   - preload script for renderer
package.json - project configuration and dependencies
```

## Build
To build the application for your target OS:
```bash
npm run build
```

## License
MIT License
