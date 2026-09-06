const electron = require("electron");
const fs = require("fs");
const path = require("path");

const isElectron = typeof electron === "object" && electron !== null && "ipcMain" in electron;
const app = isElectron ? electron.app : null;
const BrowserWindow = isElectron ? electron.BrowserWindow : null;
const dialog = isElectron ? electron.dialog : null;
const ipcMain = isElectron ? electron.ipcMain : null;

const APP_NAME = "Explorer Templates";
const APP_VERSION = "v0.1";
const RUNTIME_NAME = "Electron";

const ERROR_MESSAGES = {
  ROOT_ESCAPE: "The requested path is outside the selected root.",
  NOT_FOUND: "The requested path does not exist.",
  PERMISSION_DENIED: "Permission was denied.",
  READ_FAILED: "The directory could not be read.",
  USER_CANCELLED: "Folder selection was cancelled.",
  UNSUPPORTED_TARGET: "The requested target is not supported."
};

function result(value) {
  if (value !== undefined) {
    return { ok: true, value };
  }
  return { ok: true };
}

function fail(code, message) {
  return {
    ok: false,
    error: {
      code,
      message: message || ERROR_MESSAGES[code] || "Unknown error"
    }
  };
}

let windowRef = null;
let rootPath = "";
let settingsPath = path.join(__dirname, "..", "settings.json");
const defaults = {
  version: 1,
  shell: {
    theme: "gray",
    icon_theme: "simple",
    sidebar_width: 280,
    sidebar_collapsed: false,
    root_path: "",
    recent_folders: []
  }
};

const themeBackground = {
  white: "#ffffff",
  gray: "#353b44",
  dark: "#090c10"
};

function normalizeShellSettings(supplied, base) {
  const s = supplied || {};
  const b = base || defaults.shell;
  const theme = ["white", "gray", "dark"].includes(s.theme) ? s.theme : b.theme;
  const iconTheme = ["simple", "builtin", "vsicons"].includes(s.icon_theme) ? s.icon_theme : b.icon_theme;
  const sidebarWidth = (typeof s.sidebar_width === "number" && s.sidebar_width >= 140) ? s.sidebar_width : b.sidebar_width;
  const sidebarCollapsed = typeof s.sidebar_collapsed === "boolean" ? s.sidebar_collapsed : b.sidebar_collapsed;
  const root_path = typeof s.root_path === "string" ? s.root_path : b.root_path;
  const recent = Array.isArray(s.recent_folders) ? s.recent_folders : b.recent_folders;
  const recent_folders = (recent || []).filter((p) => typeof p === "string").slice(0, 5);

  return {
    theme,
    icon_theme: iconTheme,
    sidebar_width: sidebarWidth,
    sidebar_collapsed: sidebarCollapsed,
    root_path,
    recent_folders
  };
}

function readSettings() {
  try {
    if (!fs.existsSync(settingsPath)) {
      fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2));
      return { settings: defaults, notice: null };
    }
    const loaded = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    const shell = normalizeShellSettings(loaded.shell, defaults.shell);
    return {
      settings: {
        version: 1,
        shell
      },
      notice: null
    };
  } catch {
    return {
      settings: defaults,
      notice: "Settings could not be read; defaults were used."
    };
  }
}

let settingsState = readSettings();

function pushRecent(folderPath) {
  const recent = (settingsState.settings.shell.recent_folders || []).filter((p) => p !== folderPath);
  recent.unshift(folderPath);
  settingsState.settings.shell.recent_folders = recent.slice(0, 5);
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settingsState.settings, null, 2));
  } catch (err) {
    console.error("Failed to write settings:", err);
  }
}

function cliRootArg() {
  if (!app) return null;
  const args = app.isPackaged ? process.argv.slice(1) : process.argv.slice(2);
  const first = args.find((a) => !a.startsWith("--"));
  return first ? path.resolve(first) : null;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function resolveInitialRoot() {
  const cliRoot = cliRootArg();
  const effectiveRoot = cliRoot !== null ? cliRoot : settingsState.settings.shell.root_path;
  if (effectiveRoot && fs.existsSync(effectiveRoot) && isDirectory(effectiveRoot)) {
    try {
      rootPath = fs.realpathSync.native ? fs.realpathSync.native(effectiveRoot) : fs.realpathSync(effectiveRoot);
      if (cliRoot !== null) {
        settingsState.settings.shell.root_path = rootPath;
        fs.writeFileSync(settingsPath, JSON.stringify(settingsState.settings, null, 2));
      }
      pushRecent(rootPath);
    } catch {
      settingsState.notice = `Saved root is unavailable: ${effectiveRoot}`;
    }
  } else if (effectiveRoot) {
    settingsState.notice = `Saved root is unavailable: ${effectiveRoot}`;
  }
}

function isInsideRoot(candidate) {
  if (!rootPath) return false;
  try {
    const rootNorm = path.normalize(rootPath).toLowerCase();
    const candidateNorm = path.normalize(candidate).toLowerCase();
    return candidateNorm === rootNorm || candidateNorm.startsWith(rootNorm.endsWith(path.sep) ? rootNorm : rootNorm + path.sep);
  } catch {
    return false;
  }
}

function resolveInsideRoot(relativePath) {
  if (typeof relativePath !== "string") {
    return fail("ROOT_ESCAPE", ERROR_MESSAGES.ROOT_ESCAPE);
  }

  const normalized = relativePath.trim();
  if (
    path.isAbsolute(normalized) ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.startsWith("\\") ||
    normalized.startsWith("/")
  ) {
    return fail("ROOT_ESCAPE", ERROR_MESSAGES.ROOT_ESCAPE);
  }

  const parts = normalized.split(/[\\/]/);
  if (parts.includes("..")) {
    return fail("ROOT_ESCAPE", ERROR_MESSAGES.ROOT_ESCAPE);
  }

  if (normalized === "" || normalized === ".") {
    return result(rootPath);
  }

  const candidate = path.resolve(rootPath, normalized);
  if (!fs.existsSync(candidate)) {
    return fail("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);
  }

  let realTarget;
  try {
    realTarget = fs.realpathSync.native ? fs.realpathSync.native(candidate) : fs.realpathSync(candidate);
  } catch {
    return fail("READ_FAILED", ERROR_MESSAGES.READ_FAILED);
  }

  if (!isInsideRoot(realTarget)) {
    return fail("ROOT_ESCAPE", ERROR_MESSAGES.ROOT_ESCAPE);
  }

  return result(realTarget);
}

async function handleBridge(method, ...args) {
  if (method === "choose_root") {
    if (!dialog || !windowRef) return fail("READ_FAILED", ERROR_MESSAGES.READ_FAILED);
    const choice = await dialog.showOpenDialog(windowRef, { properties: ["openDirectory"] });
    if (choice.canceled || !choice.filePaths || choice.filePaths.length === 0) {
      return fail("USER_CANCELLED", ERROR_MESSAGES.USER_CANCELLED);
    }
    try {
      rootPath = fs.realpathSync.native ? fs.realpathSync.native(choice.filePaths[0]) : fs.realpathSync(choice.filePaths[0]);
    } catch {
      return fail("READ_FAILED", ERROR_MESSAGES.READ_FAILED);
    }
    pushRecent(rootPath);
    return result(rootPath);
  }

  if (method === "set_root") {
    const target = args[0];
    if (!target || !fs.existsSync(target) || !isDirectory(target)) {
      return fail("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);
    }
    try {
      rootPath = fs.realpathSync.native ? fs.realpathSync.native(target) : fs.realpathSync(target);
    } catch {
      return fail("READ_FAILED", ERROR_MESSAGES.READ_FAILED);
    }
    pushRecent(rootPath);
    return result(rootPath);
  }

  if (method === "get_recent_folders") {
    const recent = settingsState.settings.shell.recent_folders || [];
    const valid = recent.filter((p) => fs.existsSync(p) && isDirectory(p));
    if (valid.length !== recent.length) {
      settingsState.settings.shell.recent_folders = valid;
      fs.writeFileSync(settingsPath, JSON.stringify(settingsState.settings, null, 2));
    }
    return result(valid);
  }

  if (method === "clear_recent_folders") {
    settingsState.settings.shell.recent_folders = [];
    fs.writeFileSync(settingsPath, JSON.stringify(settingsState.settings, null, 2));
    return result();
  }

  if (method === "list_children") {
    if (!rootPath) return fail("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);
    const targetResult = resolveInsideRoot(args[0] === undefined ? "" : args[0]);
    if (!targetResult.ok) return targetResult;
    const target = targetResult.value;
    if (!isDirectory(target)) {
      return fail("UNSUPPORTED_TARGET", ERROR_MESSAGES.UNSUPPORTED_TARGET);
    }

    try {
      const dirEntries = fs.readdirSync(target, { withFileTypes: true });
      const entries = dirEntries.map((entry) => {
        const entryPath = path.join(target, entry.name);
        let resolved = entryPath;
        let blocked = false;
        try {
          resolved = fs.realpathSync.native ? fs.realpathSync.native(entryPath) : fs.realpathSync(entryPath);
          blocked = !isInsideRoot(resolved);
        } catch {
          blocked = true;
        }

        const isDir = entry.isDirectory();
        let size = null;
        let createdAtMs = null;
        if (!isDir && !blocked) {
          try {
            const stat = fs.statSync(resolved);
            size = stat.size;
            createdAtMs = Math.round(stat.birthtimeMs || stat.ctimeMs);
          } catch {}
        }

        return {
          name: entry.name,
          path: blocked ? "" : path.relative(rootPath, resolved),
          is_dir: isDir,
          size,
          created_at_ms: createdAtMs,
          blocked
        };
      });

      entries.sort((a, b) => (
        Number(b.is_dir) - Number(a.is_dir) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ));

      return result(entries);
    } catch (error) {
      const code = error.code === "EACCES" ? "PERMISSION_DENIED" : "READ_FAILED";
      return fail(code, ERROR_MESSAGES[code]);
    }
  }

  if (method === "minimize") {
    if (windowRef) windowRef.minimize();
    return result();
  }

  if (method === "toggle_maximize") {
    if (!windowRef) return fail("NOT_FOUND", ERROR_MESSAGES.NOT_FOUND);
    if (windowRef.isMaximized()) {
      windowRef.unmaximize();
    } else {
      windowRef.maximize();
    }
    return result(windowRef.isMaximized());
  }

  if (method === "close") {
    if (windowRef) windowRef.close();
    return result();
  }

  if (method === "get_settings") {
    return result({
      shell: settingsState.settings.shell,
      notice: settingsState.notice,
      runtime: {
        app_name: APP_NAME,
        app_version: APP_VERSION,
        build_date: new Date().toISOString().slice(0, 10),
        runtime_name: RUNTIME_NAME
      }
    });
  }

  if (method === "save_settings") {
    const current = settingsState.settings.shell;
    const supplied = (args[0] && typeof args[0] === "object") ? args[0] : {};
    settingsState.settings.shell = normalizeShellSettings(supplied, current);
    fs.writeFileSync(settingsPath, JSON.stringify(settingsState.settings, null, 2));
    return result();
  }

  if (method === "call_domain") {
    return fail("UNSUPPORTED_TARGET", ERROR_MESSAGES.UNSUPPORTED_TARGET);
  }

  return fail("UNSUPPORTED_TARGET", ERROR_MESSAGES.UNSUPPORTED_TARGET);
}

function createWindow() {
  const currentTheme = settingsState.settings.shell.theme || "gray";
  const backgroundColor = themeBackground[currentTheme] || themeBackground.gray;

  windowRef = new BrowserWindow({
    width: 1280,
    height: 800,
    frame: false,
    backgroundColor: backgroundColor,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  const entryHtml = path.join(__dirname, "..", "..", "shell", "index.html");
  windowRef.loadFile(entryHtml);

  windowRef.webContents.on("did-finish-load", () => {
    windowRef.webContents.insertCSS(
      ".drag-region { -webkit-app-region: drag; } " +
      ".menu-button, .window-btn, .rail-btn, .icon-btn, .splitter { -webkit-app-region: no-drag; }"
    );
  });

  windowRef.on("maximize", () => windowRef.webContents.send("window-state", true));
  windowRef.on("unmaximize", () => windowRef.webContents.send("window-state", false));
}

if (ipcMain) {
  ipcMain.handle("bridge", async (_event, method, ...args) => handleBridge(method, ...args));
}

if (app) {
  app.whenReady().then(() => {
    resolveInitialRoot();
    createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

module.exports = {
  APP_NAME,
  APP_VERSION,
  RUNTIME_NAME,
  ERROR_MESSAGES,
  handleBridge,
  resolveInsideRoot,
  isInsideRoot,
  normalizeShellSettings,
  readSettings,
  pushRecent,
  setRootPath: (p) => { rootPath = p; },
  getRootPath: () => rootPath,
  setSettingsPath: (p) => { settingsPath = p; },
  setWindowRef: (w) => { windowRef = w; },
  setSettingsState: (s) => { settingsState = s; }
};