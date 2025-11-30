import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Force rebuild of preload script
// Custom APIs for renderer
const api = {
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
    readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
    writeFile: (path: string, data: any) => ipcRenderer.invoke('fs:writeFile', { path, data }),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    getFileStats: (path: string) => ipcRenderer.invoke('fs:getFileStats', path),
    setFileMtime: (path: string, mtime: number) => ipcRenderer.invoke('fs:setFileMtime', path, mtime),
    createDirectory: (path: string) => ipcRenderer.invoke('fs:createDirectory', path),
    exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
    deleteFile: (path: string) => ipcRenderer.invoke('fs:deleteFile', path),
    pathJoin: (...paths: string[]) => ipcRenderer.invoke('path:join', ...paths),
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
}

// Use `contextBridge` APIs to expose Electron APIs to renderer only if context isolation is enabled
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {

    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}
