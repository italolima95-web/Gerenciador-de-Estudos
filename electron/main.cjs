const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('node:path');
let backend;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app
    .whenReady()
    .then(async () => {
      const { startServer } = await import('../dist-server/server/index.js');
      backend = await startServer({
        dataDir: path.join(app.getPath('userData'), 'data'),
        port: 0,
        frontendDir: path.join(__dirname, '../dist'),
      });
      const address = backend.server.address();
      const origin = `http://127.0.0.1:${address.port}`;
      const createWindow = () => {
        const win = new BrowserWindow({
          width: 1440,
          height: 940,
          minWidth: 960,
          minHeight: 680,
          title: 'Cronograma de Estudos',
          backgroundColor: '#f4f6f3',
          autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
          if (/^https?:/.test(url)) shell.openExternal(url);
          return { action: 'deny' };
        });
        win.webContents.on('will-navigate', (event, url) => {
          if (!url.startsWith(origin + '/')) event.preventDefault();
        });
        win.loadURL(origin);
      };
      createWindow();
      app.on('activate', () => {
        if (!BrowserWindow.getAllWindows().length) createWindow();
      });
    })
    .catch((e) => {
      dialog.showErrorBox('Não foi possível iniciar', String(e));
      app.quit();
    });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('before-quit', () => {
    if (backend) {
      backend.store.persist();
      backend.server.close();
    }
  });
}
