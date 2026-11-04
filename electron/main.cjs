// Processo principal do aplicativo de computador da Plataforma Confidence.
// O aplicativo abre o sistema oficial em uma janela própria, sem barra de navegador,
// e guarda a sessão de login entre as aberturas.
const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");

const APP_URL = process.env.CONFIDENCE_APP_URL || "https://plataformaconfidence.com.br";
const APP_ORIGIN = new URL(APP_URL).origin;
const OFFLINE_PAGE = path.join(__dirname, "..", "build", "offline.html");
const APP_ICON = path.join(__dirname, "..", "build", "app-icon.png");

let janela = null;
let tentativas = 0;

function createWindow() {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#12294a",
    icon: APP_ICON,
    title: "Confidence",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  janela.once("ready-to-show", () => janela.show());
  janela.setTitle("Confidence — Gestão Operacional");

  // Links que saem do sistema abrem no navegador padrão do computador.
  janela.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  janela.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) shell.openExternal(url);
    } catch {
      /* link inválido: ignora */
    }
    return { action: "deny" };
  });

  // Sem conexão: tenta de novo e, se não conseguir, mostra a tela de aviso.
  janela.webContents.on("did-fail-load", (_e, code, _desc, failedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = cancelado pelo próprio app
    if (tentativas < 4) {
      tentativas += 1;
      setTimeout(() => {
        if (janela && !janela.isDestroyed()) janela.loadURL(APP_URL);
      }, 3000);
    } else {
      tentativas = 0;
      if (janela && !janela.isDestroyed()) janela.loadFile(OFFLINE_PAGE);
    }
  });

  janela.webContents.on("did-navigate", (_e, url) => {
    if (new URL(url).origin === APP_ORIGIN) tentativas = 0;
  });

  janela.on("closed", () => {
    janela = null;
  });

  janela.loadURL(APP_URL);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "Arquivo",
      submenu: [{ role: "close", label: "Fechar janela" }, { role: "quit", label: "Sair" }],
    },
    {
      label: "Ver",
      submenu: [
        { label: "Atualizar o sistema", role: "reload" },
        { label: "Forçar atualização", role: "forceReload" },
        { type: "separator" },
        { label: "Aumentar", role: "zoomIn" },
        { label: "Diminuir", role: "zoomOut" },
        { label: "Tamanho real", role: "resetZoom" },
        { type: "separator" },
        { label: "Tela inteira", role: "togglefullscreen" },
      ],
    },
    {
      label: "Janela",
      submenu: [
        { label: "Minimizar", role: "minimize" },
        { label: "Fechar", role: "close" },
        ...(isMac ? [{ label: "Sempre em frente", role: "alwaysOnTop" }] : []),
      ],
    },
    {
      label: "Ajuda",
      submenu: [
        {
          label: "Abrir a plataforma no navegador",
          click: () => shell.openExternal(APP_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Uma única instância: abrir de novo traz a janela existente para a frente.
const single = app.requestSingleInstanceLock();
if (!single) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === "win32") {
      app.setAppUserModelId("com.confidence.plataforma");
    }
    buildMenu();

    // Sessão persistente: o login continua salvo quando o aplicativo é fechado.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
      // O sistema não precisa de câmera, microfone nem localização pelo computador.
      callback(permission === "notifications");
    });

    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
