import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises'

// Force rebuild of main process
function createWindow(): void {
    // Create the browser window
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        icon: icon,
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            nodeIntegration: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
        // Maximize window to full screen
        mainWindow.maximize()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // IPC Handlers
    ipcMain.handle('dialog:openDirectory', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        })
        return result
    })

    ipcMain.handle('dialog:saveFile', async (_, options) => {
        const result = await dialog.showSaveDialog(mainWindow, options)
        return result
    })

    ipcMain.handle('fs:readDirectory', async (_, path) => {
        try {
            const files = await fs.readdir(path)
            return { success: true, files }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:writeFile', async (_, { path, data }) => {
        try {
            await fs.writeFile(path, data)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:readFile', async (_, path) => {
        try {
            const data = await fs.readFile(path)
            return { success: true, data }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:getFileStats', async (_, path) => {
        try {
            const stats = await fs.stat(path)
            return { 
                success: true, 
                stats: {
                    mtime: stats.mtime.getTime(), // Modification time as timestamp
                    ctime: stats.ctime.getTime(), // Creation time as timestamp
                    size: stats.size
                }
            }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:setFileMtime', async (_, path: string, mtime: number) => {
        try {
            const fsSync = require('fs')
            const mtimeDate = new Date(mtime)
            // utimes is used to set both atime (access time) and mtime (modification time)
            // We set atime to current time and mtime to the desired time
            await fsSync.promises.utimes(path, new Date(), mtimeDate)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:createDirectory', async (_, path) => {
        try {
            await fs.mkdir(path, { recursive: true })
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('fs:exists', async (_, path) => {
        try {
            await fs.access(path)
            return true
        } catch {
            return false
        }
    })

    ipcMain.handle('fs:deleteFile', async (_, path) => {
        try {
            await fs.unlink(path)
            return { success: true }
        } catch (error: any) {
            return { success: false, error: error.message }
        }
    })

    ipcMain.handle('path:join', async (_, ...paths) => {
        return join(...paths)
    })

    ipcMain.handle('app:getPath', async (_, name) => {
        return app.getPath(name)
    })

    ipcMain.handle('shell:openPath', async (_, path) => {
        const error = await shell.openPath(path)
        // shell.openPath returns empty string on success, error message on failure
        if (error) {
            return { success: false, error }
        }
        return { success: true }
    })

    // Load the remote URL for development or the local html file for production
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron.image-editor')

    // Default open or close DevTools by F12 in development
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// Force rebuild comment: 2025-11-24
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
