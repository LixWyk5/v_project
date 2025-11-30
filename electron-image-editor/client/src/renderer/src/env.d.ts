/// <reference types="vite/client" />

interface Window {
    api: {
        openDirectory: () => Promise<Electron.OpenDialogReturnValue>
        saveFile: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
        readDirectory: (path: string) => Promise<{ success: boolean; files?: string[]; error?: string }>
        writeFile: (path: string, data: any) => Promise<{ success: boolean; error?: string }>
        readFile: (path: string) => Promise<{ success: boolean; data?: any; error?: string }>
        getFileStats: (path: string) => Promise<{ success: boolean; stats?: { mtime: number; ctime: number; size: number }; error?: string }>
        setFileMtime: (path: string, mtime: number) => Promise<{ success: boolean; error?: string }>
        createDirectory: (path: string) => Promise<{ success: boolean; error?: string }>
        exists: (path: string) => Promise<boolean>
        deleteFile: (path: string) => Promise<{ success: boolean; error?: string }>
        pathJoin: (...paths: string[]) => Promise<string>
        getPath: (name: string) => Promise<string>
        openPath: (path: string) => Promise<{ success: boolean; error?: string }>
    }
}
