// main.js - Główny proces Electron z integracją przeglądarki ComfyUI
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const CONFIG_FILE = 'launcher_config.json';
let mainWindow;
let comfyuiProcess = null; // Track running process
let comfyuiBrowserWindow = null; // NEW - Track browser window

// Domyślna konfiguracja z nowymi opcjami przeglądarki
const defaultConfig = {
  language: 'en',
  comfyui_path: '',
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
  extra_args: '',
  // NEW - Browser settings
  browser_settings: {
    auto_open: true,
    window_width: 1400,
    window_height: 900,
    remember_position: true,
    minimize_to_tray: false,
    always_on_top: false
  }
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
    checkFirstRun();
  });

  mainWindow.setMenuBarVisibility(false);
}

// NEW - Create ComfyUI browser window
function createComfyUIBrowser(config = {}) {
  if (comfyuiBrowserWindow && !comfyuiBrowserWindow.isDestroyed()) {
    comfyuiBrowserWindow.focus();
    return comfyuiBrowserWindow;
  }

  const browserSettings = { ...defaultConfig.browser_settings, ...config.browser_settings };
  const comfyuiUrl = `http://${config.listen || '127.0.0.1'}:${config.port || '8188'}`;

  comfyuiBrowserWindow = new BrowserWindow({
    width: browserSettings.window_width,
    height: browserSettings.window_height,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    icon: path.join(__dirname, 'icon.ico'),
    title: 'ComfyUI Interface',
    show: false,
    autoHideMenuBar: true,
    alwaysOnTop: browserSettings.always_on_top
  });

  // Load ComfyUI URL
  comfyuiBrowserWindow.loadURL(comfyuiUrl).catch(err => {
    console.error('Failed to load ComfyUI URL:', err);
    // Retry after 2 seconds
    setTimeout(() => {
      if (comfyuiBrowserWindow && !comfyuiBrowserWindow.isDestroyed()) {
        comfyuiBrowserWindow.loadURL(comfyuiUrl);
      }
    }, 2000);
  });

  comfyuiBrowserWindow.once('ready-to-show', () => {
    comfyuiBrowserWindow.show();
    console.log('ComfyUI browser window opened');
  });

  // Handle window closed
  comfyuiBrowserWindow.on('closed', () => {
    comfyuiBrowserWindow = null;
    console.log('ComfyUI browser window closed');
    // Notify renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('comfyui-browser-closed');
    }
  });

  // Handle page load errors
  comfyuiBrowserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('ComfyUI browser failed to load:', errorDescription);
    // Try to reload after a delay
    setTimeout(() => {
      if (comfyuiBrowserWindow && !comfyuiBrowserWindow.isDestroyed()) {
        comfyuiBrowserWindow.reload();
      }
    }, 3000);
  });

  return comfyuiBrowserWindow;
}

// NEW - Close ComfyUI browser window
function closeComfyUIBrowser() {
  if (comfyuiBrowserWindow && !comfyuiBrowserWindow.isDestroyed()) {
    comfyuiBrowserWindow.close();
    comfyuiBrowserWindow = null;
    return true;
  }
  return false;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  // Stop ComfyUI process if running
  if (comfyuiProcess) {
    comfyuiProcess.kill();
  }
  
  // Close browser window
  closeComfyUIBrowser();
  
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
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Welcome to ComfyUI Launcher Pro',
        message: 'Welcome! Please select your ComfyUI installation folder.',
        detail: 'You need to select the folder containing "python_embeded" (or "python_standalone") and "ComfyUI" directories.\n\nExample: C:\\Users\\Admin\\Desktop\\ComfyUI_windows_portable',
        buttons: ['Select Folder', 'Later'],
        defaultId: 0
      });

      if (result.response === 0) {
        const pathResult = await dialog.showOpenDialog(mainWindow, {
          title: 'Select ComfyUI Installation Folder',
          properties: ['openDirectory'],
          defaultPath: path.join(require('os').homedir(), 'Desktop')
        });

        if (!pathResult.canceled && pathResult.filePaths.length > 0) {
          const selectedPath = pathResult.filePaths[0];
          const validation = validateComfyUIPath(selectedPath);
          if (validation.valid) {
            config.comfyui_path = selectedPath;
            saveConfigSync(config);
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

// Synchronous config operations
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
// Zaktualizowana funkcja validateComfyUIPath - obsługuje python_embeded i python_standalone
function validateComfyUIPath(comfyuiPath) {
  const pythonVariants = [
    { 
      path: path.join(comfyuiPath, 'python_embeded', 'python.exe'), 
      name: 'python_embeded/python.exe',
      type: 'embeded'
    },
    { 
      path: path.join(comfyuiPath, 'python_standalone', 'python.exe'), 
      name: 'python_standalone/python.exe',
      type: 'standalone'
    }
  ];

  const comfyuiMain = {
    path: path.join(comfyuiPath, 'ComfyUI', 'main.py'),
    name: 'ComfyUI/main.py'
  };

  // Sprawdź który wariant Python istnieje
  let foundPython = null;
  for (const variant of pythonVariants) {
    if (fs.existsSync(variant.path)) {
      foundPython = variant;
      break;
    }
  }

  const missing = [];
  let valid = true;

  // Sprawdź Python
  if (!foundPython) {
    missing.push('python_embeded/python.exe OR python_standalone/python.exe');
    valid = false;
  }

  // Sprawdź ComfyUI main.py
  if (!fs.existsSync(comfyuiMain.path)) {
    missing.push(comfyuiMain.name);
    valid = false;
  }

  return { 
    valid, 
    missing, 
    pythonType: foundPython?.type || null,
    pythonPath: foundPython?.path || null
  };
}

// IPC Handlers

// Load configuration
ipcMain.handle('load-config', () => {
  return loadConfigSync();
});

// Save configuration
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

// Zaktualizowana funkcja getPythonPath - pomocnicza funkcja
function getPythonPath(comfyuiPath) {
  const pythonVariants = [
    path.join(comfyuiPath, 'python_embeded', 'python.exe'),
    path.join(comfyuiPath, 'python_standalone', 'python.exe')
  ];

  for (const pythonPath of pythonVariants) {
    if (fs.existsSync(pythonPath)) {
      return pythonPath;
    }
  }

  return null;
}

// Start ComfyUI with browser integration
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

      env.HF_HUB_CACHE = path.join(config.comfyui_path, 'HuggingFaceHub');
      env.TORCH_HOME = path.join(config.comfyui_path, 'TorchHome');

      const pythonExe = getPythonPath(config.comfyui_path);
      if (!pythonExe) {
        reject({ success: false, error: 'Python executable not found (looked for python_embeded and python_standalone)' });
        return;
      }
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

      if (config.port !== '8188') {
        args.push('--port', config.port);
      }
      if (config.listen !== '127.0.0.1') {
        args.push('--listen', config.listen);
      }

      if (config.extra_args) {
        const extraArgs = config.extra_args.split(' ').filter(arg => arg.trim());
        args.push(...extraArgs);
      }

      console.log('Starting:', pythonExe, args.join(' '));

      // Start process
      const child = spawn(pythonExe, args, {
        env,
        cwd: config.comfyui_path,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      comfyuiProcess = child;

      child.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('ComfyUI:', output);
        mainWindow.webContents.send('comfyui-output', output);
        
        // Check if ComfyUI server is ready and auto-open browser if configured
        if (output.includes('To see the GUI go to:') || output.includes('Starting server') || output.includes('server running on')) {
          if (config.browser_settings && config.browser_settings.auto_open) {
            setTimeout(() => {
              createComfyUIBrowser(config);
              mainWindow.webContents.send('comfyui-browser-auto-opened');
            }, 3000); // Wait 3 seconds for server to be fully ready
          }
        }
      });

      child.stderr.on('data', (data) => {
        console.error('ComfyUI Error:', data.toString());
        mainWindow.webContents.send('comfyui-output', data.toString());
      });

      child.on('spawn', () => {
        mainWindow.webContents.send('comfyui-started');
        resolve({ success: true, pid: child.pid });
      });

      child.on('error', (error) => {
        comfyuiProcess = null;
        closeComfyUIBrowser();
        mainWindow.webContents.send('comfyui-stopped');
        reject({ success: false, error: error.message });
      });

      child.on('exit', (code) => {
        console.log('ComfyUI finished with code:', code);
        comfyuiProcess = null;
        closeComfyUIBrowser(); // NEW - Close browser when ComfyUI stops
        mainWindow.webContents.send('comfyui-exit', code);
        mainWindow.webContents.send('comfyui-stopped');
      });

    } catch (error) {
      comfyuiProcess = null;
      reject({ success: false, error: error.message });
    }
  });
});

// Stop ComfyUI
ipcMain.handle('stop-comfyui', () => {
  return new Promise((resolve) => {
    try {
      if (comfyuiProcess) {
        console.log('Stopping ComfyUI process...');
        
        // Close browser first
        closeComfyUIBrowser();
        
        comfyuiProcess.kill('SIGTERM');
        
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
      closeComfyUIBrowser();
      mainWindow.webContents.send('comfyui-stopped');
      resolve({ success: false, error: error.message });
    }
  });
});

// Check if ComfyUI is running
ipcMain.handle('is-comfyui-running', () => {
  return {
    running: comfyuiProcess !== null && !comfyuiProcess.killed,
    pid: comfyuiProcess ? comfyuiProcess.pid : null,
    browser_open: comfyuiBrowserWindow !== null && !comfyuiBrowserWindow.isDestroyed()
  };
});

// NEW - Open ComfyUI browser manually
ipcMain.handle('open-comfyui-browser', (event, config) => {
  try {
    if (!comfyuiProcess || comfyuiProcess.killed) {
      return { success: false, message: 'ComfyUI is not running' };
    }
    
    createComfyUIBrowser(config);
    return { success: true, message: 'Browser opened' };
  } catch (error) {
    console.error('Browser open error:', error);
    return { success: false, error: error.message };
  }
});

// NEW - Close ComfyUI browser manually
ipcMain.handle('close-comfyui-browser', () => {
  try {
    const closed = closeComfyUIBrowser();
    return { 
      success: true, 
      message: closed ? 'Browser closed' : 'No browser window to close' 
    };
  } catch (error) {
    console.error('Browser close error:', error);
    return { success: false, error: error.message };
  }
});

// NEW - Check if browser is open
ipcMain.handle('is-browser-open', () => {
  return {
    open: comfyuiBrowserWindow !== null && !comfyuiBrowserWindow.isDestroyed()
  };
});

// Install dependencies
ipcMain.handle('install-dependencies', (event, config) => {
  return new Promise((resolve, reject) => {
    if (!config.comfyui_path) {
      reject({ success: false, error: 'ComfyUI path not configured' });
      return;
    }

    const pythonExe = getPythonPath(config.comfyui_path);
    if (!pythonExe) {
      reject({ success: false, error: 'Python executable not found (looked for python_embeded and python_standalone)' });
      return;
    }
    
    const requirementsPath = path.join(config.comfyui_path, 'ComfyUI', 'requirements.txt');

    if (!fs.existsSync(requirementsPath)) {
      reject({ success: false, error: 'Requirements file not found at: ' + requirementsPath });
      return;
    }

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
