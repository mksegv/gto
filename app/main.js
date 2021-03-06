import path from 'path';
import fs from 'fs';
import os from 'os';
import electron from 'electron';
import Promise from 'bluebird';
import { menu as appMenu } from './menu';
import {app, shell, BrowserWindow} from 'electron';
import windowStateKeeper from 'electron-window-state'

require('electron-debug')()

let mainWindow = null;

const gmailURL = 'http://www.gmail.com';
const gmailLogoutRe = 'https://mail.google.com/mail/logout';
const gmailAddAccountRe = 'https://accounts.google.com/AddSession';
const oktaRe = 'https://.*.okta.com/';
const gmailDomainRe = 'https://mail.google.com/';
const editInNewTabRe = 'https://mail.google.com/mail/.*#cmid%253D[0-9]+';

var last_badge = 0

// Set os specific stuff
electron.ipcMain.on('update-dock', function(event, arg) {
  if (os.platform() === 'darwin') {
    if (arg != last_badge) {
      app.dock.bounce('informational')
      last_badge = arg
    }
    if (arg > 0) {
      // Hide dock badge when unread mail count is 0
      app.dock.setBadge(arg.toString());
    } else {
      app.dock.setBadge('');
    }
  }
});


function createWindow() {
  if (mainWindow) return mainWindow;
  // Load the previous state with fallback to defaults
  let mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });

  // Create the window using the state information

  mainWindow = new BrowserWindow({
    title: 'Gto',
    icon: path.join(__dirname, 'media/icon.icns'),
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 400,
    minHeight: 200,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      plugins: true
    }
  });

  mainWindow.webContents.on('new-window', function(e, url) {
    console.log(e, url)
    //mainWindow.loadURL(url)
    //e.preventDefault()
    //const win = new BrowserWindow({ show: false })
		// win.once('ready-to-show', () => win.show())
		// win.loadURL(url)
		//e.newGuest = win
  });

  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  mainWindow.loadURL(gmailURL);
  // mainWindow.maximize();

  // https://stackoverflow.com/questions/35008347/electron-close-w-x-vs-right-click-dock-and-quit/35782702#35782702
  if (process.platform === 'darwin') {
    var forceQuit = false;
    app.on('before-quit', function() {
      forceQuit = true;
    });
    mainWindow.on('close', function(event) {
      if (!forceQuit) {
        event.preventDefault();
        mainWindow.hide()
      }
    });
    app.on('activate', (e) => {
      mainWindow.show()
    })
  } else
    mainWindow.on('close', app.quit);

  return mainWindow;
}

function gotoURL(url) {
  return new Promise((resolve) => {
    mainWindow.webContents.on('did-finish-load', resolve);
    mainWindow.webContents.loadURL(url);
  });
}


app.on('ready', () => {
  electron.Menu.setApplicationMenu(appMenu);

  createWindow();
  let page = mainWindow.webContents;

  page.on('dom-ready', () => {
    page.insertCSS(fs.readFileSync(path.join(__dirname, 'ui', 'gmail.css'), 'utf8'));
  });

  // Open links in default browser
  page.on('new-window', function(e, url) {
    if (url.match(gmailLogoutRe)) {
      e.preventDefault();
      gotoURL(url).then(() => { gotoURL(gmailURL) });
    } else if (url.match(editInNewTabRe)) {
      e.preventDefault();
      page.send('start-compose');
    } else if (url.match(gmailDomainRe) ||
               url.match(gmailAddAccountRe) ||
               url.match(oktaRe)) {
      e.preventDefault();
      page.loadURL(url);
    } else {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // mainWindow.webContents.openDevTools();
});
