// main.js - Główny proces Electron
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const CONFIG_FILE = 'launcher_config.json';
let mainWindow;
let comfyuiProcess = null; // Track running process

// Domyślna konfiguracja - ENGLISH DEFAULT
const defaultConfig = {
  language: 'en', // Changed to English
  comfyui_path: '', // New field for ComfyUI path
  http_proxy: '',
  https_proxy: '',
  hf_token: '',
  pip_index_url: '',
  hf_endpoint: '',
  lowvram: false,
  fp16_vae: false,
  dont_upcast_attention: false,
  disable_smart_memory: false,
  fast_mode: false,
  use_pytorch_cross_attention: false,
  cpu_mode: false,
  directml: false,
  disable_auto_launch: false,
  port: '8188',
  listen: '127.0.0.1',
  extra_args: ''
};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'icon.ico'),
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Check if ComfyUI path is configured on first run
    checkFirstRun();
  });

  // Remove menu bar (optional)
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Stop ComfyUI process if running
  if (comfyuiProcess) {
    comfyuiProcess.kill();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Check if this is first run and prompt for ComfyUI path
async function checkFirstRun() {
  try {
    const config = loadConfigSync();
    if (!config.comfyui_path) {
      // Show info dialog about path selection
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Welcome to ComfyUI Launcher Pro',
        message: 'Welcome! Please select your ComfyUI installation folder.',
        detail: 'You need to select the folder containing "python_embeded" and "ComfyUI" directories.\n\nExample: C:\\Users\\Admin\\Desktop\\ComfyUI_windows_portable',
        buttons: ['Select Folder', 'Later'],
        defaultId: 0
      });

      if (result.response === 0) {
        // User clicked "Select Folder"
        const pathResult = await dialog.showOpenDialog(mainWindow, {
          title: 'Select ComfyUI Installation Folder',
          properties: ['openDirectory'],
          defaultPath: path.join(require('os').homedir(), 'Desktop')
        });

        if (!pathResult.canceled && pathResult.filePaths.length > 0) {
          const selectedPath = pathResult.filePaths[0];
          
          // Validate the path
          const validation = validateComfyUIPath(selectedPath);
          if (validation.valid) {
            // Save the path
            config.comfyui_path = selectedPath;
            saveConfigSync(config);
            
            // Notify renderer
            mainWindow.webContents.send('path-selected', selectedPath);
          } else {
            await dialog.showErrorBox('Invalid Path', 
              `The selected folder is not a valid ComfyUI installation.\n\nMissing: ${validation.missing.join(', ')}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('First run check error:', error);
  }
}

// Synchronous config operations for startup
function loadConfigSync() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      return { ...defaultConfig, ...config };
    }
    return defaultConfig;
  } catch (error) {
    console.error('Config loading error:', error);
    return defaultConfig;
  }
}

function saveConfigSync(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Config save error:', error);
    return false;
  }
}

// Validate ComfyUI installation path
function validateComfyUIPath(comfyuiPath) {
  const requiredPaths = [
    { path: path.join(comfyuiPath, 'python_embeded', 'python.exe'), name: 'python_embeded/python.exe' },
    { path: path.join(comfyuiPath, 'ComfyUI', 'main.py'), name: 'ComfyUI/main.py' }
  ];

  const missing = [];
  let valid = true;

  requiredPaths.forEach(item => {
    if (!fs.existsSync(item.path)) {
      missing.push(item.name);
      valid = false;
    }
  });

  return { valid, missing };
}

// IPC Handlers

// Load configuration
ipcMain.handle('load-config', () => {
  return loadConfigSync();
});

// Save configuration - SIMPLE METHOD
ipcMain.handle('save-config', (event, config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return { success: true, message: 'Configuration saved!' };
  } catch (error) {
    console.error('Config save error:', error);
    return { success: false, message: 'Save error: ' + error.message };
  }
});

// Select directory
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select ComfyUI Installation Folder',
      properties: ['openDirectory'],
      defaultPath: path.join(require('os').homedir(), 'Desktop'),
      message: 'Select the folder containing python_embeded and ComfyUI directories'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    } else {
      return { success: false, path: null };
    }
  } catch (error) {
    console.error('Directory selection error:', error);
    return { success: false, path: null, error: error.message };
  }
});

// Validate path
ipcMain.handle('validate-path', (event, comfyuiPath) => {
  return validateComfyUIPath(comfyuiPath);
});

// Start ComfyUI - UPDATED WITH PROCESS TRACKING
ipcMain.handle('start-comfyui', (event, config) => {
  return new Promise((resolve, reject) => {
    try {
      if (!config.comfyui_path) {
        reject({ success: false, error: 'ComfyUI path not configured' });
        return;
      }

      // Set environment variables
      const env = { ...process.env };
      
      if (config.http_proxy) env.HTTP_PROXY = config.http_proxy;
      if (config.https_proxy) env.HTTPS_PROXY = config.https_proxy;
      if (config.hf_token) env.HF_TOKEN = config.hf_token;
      if (config.pip_index_url) env.PIP_INDEX_URL = config.pip_index_url;
      if (config.hf_endpoint) env.HF_ENDPOINT = config.hf_endpoint;

      // Cache directories - relative to ComfyUI path
      env.HF_HUB_CACHE = path.join(config.comfyui_path, 'HuggingFaceHub');
      env.TORCH_HOME = path.join(config.comfyui_path, 'TorchHome');

      // Build command with full paths
      const pythonExe = path.join(config.comfyui_path, 'python_embeded', 'python.exe');
      const mainPy = path.join(config.comfyui_path, 'ComfyUI', 'main.py');
      
      const args = ['-s', mainPy, '--windows-standalone-build'];

      // Add flags
      const flags = {
        lowvram: '--lowvram',
        fp16_vae: '--fp16-vae',
        dont_upcast_attention: '--dont-upcast-attention',
        disable_smart_memory: '--disable-smart-memory',
        fast_mode: '--fast',
        use_pytorch_cross_attention: '--use-pytorch-cross-attention',
        cpu_mode: '--cpu',
        directml: '--directml',
        disable_auto_launch: '--disable-auto-launch'
      };

      Object.keys(flags).forEach(key => {
        if (config[key]) {
          args.push(flags[key]);
        }
      });

      // Port and listen
      if (config.port !== '8188') {
        args.push('--port', config.port);
      }
      if (config.listen !== '127.0.0.1') {
        args.push('--listen', config.listen);
      }

      // Extra args
      if (config.extra_args) {
        const extraArgs = config.extra_args.split(' ').filter(arg => arg.trim());
        args.push(...extraArgs);
      }

      console.log('Starting:', pythonExe, args.join(' '));
      console.log('Working directory:', config.comfyui_path);

      // Start process
      const child = spawn(pythonExe, args, {
        env,
        cwd: config.comfyui_path, // Set working directory to ComfyUI path
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Store the process reference
      comfyuiProcess = child;

      child.stdout.on('data', (data) => {
        console.log('ComfyUI:', data.toString());
        mainWindow.webContents.send('comfyui-output', data.toString());
      });

      child.stderr.on('data', (data) => {
        console.error('ComfyUI Error:', data.toString());
        mainWindow.webContents.send('comfyui-output', data.toString());
      });

      child.on('spawn', () => {
        // Notify renderer that process started
        mainWindow.webContents.send('comfyui-started');
        resolve({ success: true, pid: child.pid });
      });

      child.on('error', (error) => {
        comfyuiProcess = null;
        mainWindow.webContents.send('comfyui-stopped');
        reject({ success: false, error: error.message });
      });

      child.on('exit', (code) => {
        console.log('ComfyUI finished with code:', code);
        comfyuiProcess = null;
        mainWindow.webContents.send('comfyui-exit', code);
        mainWindow.webContents.send('comfyui-stopped');
      });

    } catch (error) {
      comfyuiProcess = null;
      reject({ success: false, error: error.message });
    }
  });
});

// Stop ComfyUI - NEW HANDLER
ipcMain.handle('stop-comfyui', () => {
  return new Promise((resolve) => {
    try {
      if (comfyuiProcess) {
        console.log('Stopping ComfyUI process...');
        
        // Try graceful termination first
        comfyuiProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (comfyuiProcess && !comfyuiProcess.killed) {
            console.log('Force killing ComfyUI process...');
            comfyuiProcess.kill('SIGKILL');
          }
        }, 5000);
        
        comfyuiProcess = null;
        mainWindow.webContents.send('comfyui-stopped');
        resolve({ success: true, message: 'ComfyUI stopped' });
      } else {
        resolve({ success: false, message: 'No ComfyUI process running' });
      }
    } catch (error) {
      console.error('Stop error:', error);
      comfyuiProcess = null;
      mainWindow.webContents.send('comfyui-stopped');
      resolve({ success: false, error: error.message });
    }
  });
});

// Check if ComfyUI is running - NEW HANDLER
ipcMain.handle('is-comfyui-running', () => {
  return {
    running: comfyuiProcess !== null && !comfyuiProcess.killed,
    pid: comfyuiProcess ? comfyuiProcess.pid : null
  };
});

// Install dependencies - UPDATED WITH PATH
ipcMain.handle('install-dependencies', (event, config) => {
  return new Promise((resolve, reject) => {
    if (!config.comfyui_path) {
      reject({ success: false, error: 'ComfyUI path not configured' });
      return;
    }

    const pythonExe = path.join(config.comfyui_path, 'python_embeded', 'python.exe');
    const requirementsPath = path.join(config.comfyui_path, 'ComfyUI', 'requirements.txt');
    
    if (!fs.existsSync(pythonExe)) {
      reject({ success: false, error: 'Python embedded not found at: ' + pythonExe });
      return;
    }

    if (!fs.existsSync(requirementsPath)) {
      reject({ success: false, error: 'Requirements file not found at: ' + requirementsPath });
      return;
    }

    // Install requirements
    const child = spawn(pythonExe, ['-m', 'pip', 'install', '-r', requirementsPath], {
      cwd: config.comfyui_path,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdout.on('data', (data) => {
      mainWindow.webContents.send('install-output', data.toString());
    });

    child.stderr.on('data', (data) => {
      mainWindow.webContents.send('install-output', data.toString());
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject({ success: false, error: `Installation finished with code: ${code}` });
      }
    });

    child.on('error', (error) => {
      reject({ success: false, error: error.message });
    });
  });
});

// Show error dialog
ipcMain.handle('show-error', (event, title, message) => {
  dialog.showErrorBox(title, message);
});

// Show info dialog
ipcMain.handle('show-info', (event, title, message) => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title,
    message,
    buttons: ['OK']
  });
});