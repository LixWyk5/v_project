import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type ViewMode = 'grid' | 'list';
type SidebarTab = 'upload' | 'gallery' | 'single' | 'sync' | 'systemActivity' | 'settings';

export interface UploadFileRecord {
    id: string;
    filename: string;
    size: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
    isCorrupted?: boolean;
    folderName?: string;
    timestamp: number;
}

export interface UploadStats {
    totalFiles: number;
    totalSize: number;
    successCount: number;
    failedCount: number;
    corruptedCount: number;
    timestamp?: number;
    files: UploadFileRecord[]; // Individual file records
}

interface UIState {
    viewMode: ViewMode;
    sidebarCollapsed: boolean;
    sidebarTab: SidebarTab;
    showImageViewer: boolean;
    theme: 'light' | 'dark';
    notifications: Array<{
        id: string;
        type: 'success' | 'error' | 'info' | 'warning';
        message: string;
        timestamp: number;
    }>;
    uploadStats: (UploadStats & { files?: UploadFileRecord[] }) | null;
}

const initialState: UIState = {
    viewMode: 'grid',
    sidebarCollapsed: false,
    sidebarTab: 'upload',
    showImageViewer: false,
    theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'dark', // Load from localStorage, default to dark
    notifications: [],
    uploadStats: null,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setViewMode: (state, action: PayloadAction<ViewMode>) => {
            state.viewMode = action.payload;
        },
        toggleSidebar: (state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
        },
        setSidebarTab: (state, action: PayloadAction<SidebarTab>) => {
            state.sidebarTab = action.payload;
        },
        setShowImageViewer: (state, action: PayloadAction<boolean>) => {
            state.showImageViewer = action.payload;
        },
        setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
            state.theme = action.payload;
            // Save to localStorage
            localStorage.setItem('theme', action.payload);
        },
        addNotification: (state, action: PayloadAction<Omit<UIState['notifications'][0], 'id' | 'timestamp'>>) => {
            state.notifications.push({
                ...action.payload,
                id: Date.now().toString(),
                timestamp: Date.now(),
            });
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            state.notifications = state.notifications.filter((n) => n.id !== action.payload);
        },
        clearNotifications: (state) => {
            state.notifications = [];
        },
        setUploadStats: (state, action: PayloadAction<UploadStats | null>) => {
            if (action.payload === null) {
                state.uploadStats = null;
            } else {
                // Preserve existing files array if it exists and new payload doesn't provide files
                const existingFiles = state.uploadStats?.files || [];
                state.uploadStats = {
                    ...action.payload,
                    files: (action.payload.files && action.payload.files.length > 0) ? action.payload.files : existingFiles,
                    timestamp: Date.now(),
                };
            }
        },
        addUploadFileRecord: (state, action: PayloadAction<UploadFileRecord>) => {
            if (!state.uploadStats) {
                state.uploadStats = {
                    totalFiles: 0,
                    totalSize: 0,
                    successCount: 0,
                    failedCount: 0,
                    corruptedCount: 0,
                    files: [],
                };
            }
            // Ensure files array exists
            if (!state.uploadStats.files) {
                state.uploadStats.files = [];
            }
            
            // Check if file already exists (avoid duplicates)
            const existingIndex = state.uploadStats.files.findIndex(f => f.id === action.payload.id);
            if (existingIndex !== -1) {
                // Update existing record instead of adding duplicate
                state.uploadStats.files[existingIndex] = action.payload;
            } else {
                // Add new record
                state.uploadStats.files.push(action.payload);
                state.uploadStats.totalFiles = state.uploadStats.files.length;
                state.uploadStats.totalSize += action.payload.size;
            }
            
            // Recalculate counts based on all files
            state.uploadStats.successCount = state.uploadStats.files.filter(f => f.status === 'success').length;
            state.uploadStats.failedCount = state.uploadStats.files.filter(f => f.status === 'error').length;
            state.uploadStats.corruptedCount = state.uploadStats.files.filter(f => f.status === 'success' && f.isCorrupted).length;
        },
        updateUploadFileRecord: (state, action: PayloadAction<{ id: string; updates: Partial<UploadFileRecord> }>) => {
            if (!state.uploadStats || !state.uploadStats.files) return;
            
            const fileIndex = state.uploadStats.files.findIndex(f => f.id === action.payload.id);
            if (fileIndex === -1) return;
            
            const oldFile = state.uploadStats.files[fileIndex];
            const newFile = { ...oldFile, ...action.payload.updates };
            
            state.uploadStats.files[fileIndex] = newFile;
            
            // Recalculate all counts based on current files
            state.uploadStats.totalFiles = state.uploadStats.files.length;
            state.uploadStats.totalSize = state.uploadStats.files.reduce((sum, f) => sum + f.size, 0);
            state.uploadStats.successCount = state.uploadStats.files.filter(f => f.status === 'success').length;
            state.uploadStats.failedCount = state.uploadStats.files.filter(f => f.status === 'error').length;
            state.uploadStats.corruptedCount = state.uploadStats.files.filter(f => f.status === 'success' && f.isCorrupted).length;
        },
        clearUploadStats: (state) => {
            state.uploadStats = null;
        },
    },
});

export const {
    setViewMode,
    toggleSidebar,
    setSidebarTab,
    setShowImageViewer,
    setTheme,
    addNotification,
    removeNotification,
    clearNotifications,
    setUploadStats,
    addUploadFileRecord,
    updateUploadFileRecord,
    clearUploadStats,
} = uiSlice.actions;

export default uiSlice.reducer;
