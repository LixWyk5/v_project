import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SyncLog } from '../../types';
import { syncAPI, imageAPI } from '../../api/client';

interface SyncState {
    status: 'idle' | 'syncing' | 'success' | 'error';
    lastSyncTime: string | null;
    localImages: number;
    serverImages: number;
    totalImages: number;
    logs: SyncLog[];
    error: string | null;
}

const initialState: SyncState = {
    status: 'idle',
    lastSyncTime: null,
    localImages: 0,
    serverImages: 0,
    totalImages: 0,
    logs: [],
    error: null,
};

// Async thunks
export const fetchSyncStatus = createAsyncThunk(
    'sync/fetchStatus',
    async () => {
        const response = await syncAPI.getStatus();
        return response.data;
    }
);

export const pullFromServer = createAsyncThunk(
    'sync/pull',
    async (strategy?: string) => {
        const syncFolder = localStorage.getItem('syncFolder');
        if (!syncFolder) {
            throw new Error('Please configure a sync folder first.');
        }

        // Get strategy from localStorage if not provided
        const syncStrategy = strategy || localStorage.getItem('syncStrategy') || 'last_write_wins';

        // 1. Get all images from server
        const serverResponse = await imageAPI.getImages({ limit: 1000 });
        const serverImages = serverResponse.data.images;
        
        // 2. Get all files from local sync folder
        const localDirResult = await (window as any).api.readDirectory(syncFolder);
        if (!localDirResult.success) {
            throw new Error('Failed to read local sync folder: ' + localDirResult.error);
        }
        const localFiles = localDirResult.files.filter((f: string) => !f.startsWith('.'));

        // 3. Create maps for easier lookup
        const serverImageMap = new Map(serverImages.map((img: any) => [img.originalName, img]));
        const localFileSet = new Set(localFiles);

        let downloadedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const downloadedImages: string[] = [];
        const updatedImages: string[] = [];
        const deletedImages: string[] = [];

        // 4. Download/Update images from server
        for (const serverImage of serverImages) {
            const localExists = localFileSet.has(serverImage.originalName);
            
            try {
                const fileResponse = await fetch(`http://localhost:3000/api/images/${serverImage.id}/file`);
                if (!fileResponse.ok) continue;

                const blob = await fileResponse.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

                const filePath = `${syncFolder}\\${serverImage.originalName}`;
                
                if (localExists) {
                    // File exists locally - check if we should update based on strategy
                    if (syncStrategy === 'server_always_wins') {
                        // Always update with server version
                        const writeResult = await (window as any).api.writeFile(filePath, buffer);
                        if (writeResult && writeResult.success !== false) {
                            updatedCount++;
                            updatedImages.push(serverImage.originalName);
                        }
                    } else if (syncStrategy === 'last_write_wins') {
                        // Compare modification times to determine which version is newer
                        const localStats = await (window as any).api.getFileStats(filePath);
                        if (localStats && localStats.success && localStats.stats) {
                            const localMtime = localStats.stats.mtime;
                            const serverMtime = new Date(serverImage.lastModified).getTime();
                            
                            console.log(`[SYNC PULL] Comparing ${serverImage.originalName}:`, {
                                localMtime: new Date(localMtime).toISOString(),
                                serverMtime: new Date(serverMtime).toISOString(),
                                localMs: localMtime,
                                serverMs: serverMtime,
                                serverIsNewer: serverMtime > localMtime
                            });
                            
                            // Only update if server version is newer
                            if (serverMtime > localMtime) {
                                const writeResult = await (window as any).api.writeFile(filePath, buffer);
                                if (writeResult && writeResult.success !== false) {
                                    // Set file modification time to match server's lastModified
                                    await (window as any).api.setFileMtime(filePath, serverMtime);
                                    updatedCount++;
                                    updatedImages.push(serverImage.originalName);
                                }
                            }
                            // If local is newer or equal, keep local version
                        } else {
                            // If we can't get local stats, download server version
                        const writeResult = await (window as any).api.writeFile(filePath, buffer);
                        if (writeResult && writeResult.success !== false) {
                                // Set file modification time to match server's lastModified
                                const serverMtime = new Date(serverImage.lastModified).getTime();
                                await (window as any).api.setFileMtime(filePath, serverMtime);
                            updatedCount++;
                            updatedImages.push(serverImage.originalName);
                            }
                        }
                    }
                    // If 'local_always_wins', don't update (local version is always preferred)
                } else {
                    // File doesn't exist locally
                    if (syncStrategy === 'server_always_wins' || syncStrategy === 'last_write_wins') {
                        // Download it (server or newer version wins)
                        const writeResult = await (window as any).api.writeFile(filePath, buffer);
                        if (writeResult && writeResult.success !== false) {
                            // Set file modification time to match server's lastModified
                            const serverMtime = new Date(serverImage.lastModified).getTime();
                            await (window as any).api.setFileMtime(filePath, serverMtime);
                            downloadedCount++;
                            downloadedImages.push(serverImage.originalName);
                        }
                    }
                    // If 'local_always_wins', don't download (local is empty, so server should be empty too)
                }
            } catch (err) {
                console.error(`Failed to download ${serverImage.originalName}:`, err);
            }
        }

        // 5. Delete local files that don't exist on server (based on strategy)
        // For 'server_always_wins' and 'last_write_wins': delete local files that don't exist on server
        if (syncStrategy === 'server_always_wins' || syncStrategy === 'last_write_wins') {
            for (const localFile of localFiles) {
                if (!serverImageMap.has(localFile)) {
                    try {
                        const filePath = `${syncFolder}\\${localFile}`;
                        const exists = await (window as any).api.exists(filePath);
                        if (exists) {
                            // Delete local file (server doesn't have it, so remove from local)
                            const deleteResult = await (window as any).api.deleteFile(filePath);
                            if (deleteResult.success) {
                                deletedCount++;
                                deletedImages.push(localFile);
                            }
                        }
                    } catch (err) {
                        console.error(`Failed to delete ${localFile}:`, err);
                    }
                }
            }
        }
        // If 'local_always_wins', keep local files that don't exist on server (local is truth source)

        // 6. Log sync on server with strategy and details
        const syncResponse = await syncAPI.pull(syncStrategy, {
            downloadedImages,
            updatedImages,
            deletedImages,
        });
        return { 
            pulledImages: downloadedCount,
            updatedImages: updatedCount,
            deletedImages: deletedCount,
            conflictsResolved: syncResponse.data.conflictsResolved || 0,
            strategy: syncResponse.data.strategy,
            downloadedImageList: downloadedImages,
            updatedImageList: updatedImages,
            deletedImageList: deletedImages,
        };
    }
);

export const pushToServer = createAsyncThunk(
    'sync/push',
    async (strategy?: string) => {
        const syncFolder = localStorage.getItem('syncFolder');
        if (!syncFolder) {
            throw new Error('Please configure a sync folder first.');
        }

        // Get strategy from localStorage if not provided
        const syncStrategy = strategy || localStorage.getItem('syncStrategy') || 'last_write_wins';

        // 1. Get all images from server
        const serverResponse = await imageAPI.getImages({ limit: 1000 });
        const serverImages = serverResponse.data.images;

        // 2. Read local directory
        const localDirResult = await (window as any).api.readDirectory(syncFolder);
        if (!localDirResult.success) {
            throw new Error('Failed to read local sync folder: ' + localDirResult.error);
        }

        const localFiles = localDirResult.files.filter((f: string) => !f.startsWith('.'));
        
        // 3. Create maps for easier lookup
        const serverImageMap = new Map(serverImages.map((img: any) => [img.originalName, img]));
        const localFileSet = new Set(localFiles);

        let uploadedCount = 0;
        let updatedCount = 0;
        let deletedCount = 0;
        const uploadedImages: string[] = [];
        const updatedImages: string[] = [];
        const deletedImages: string[] = [];

        // 4. Upload/Update images to server
        for (const filename of localFiles) {
            try {
                const filePath = `${syncFolder}\\${filename}`;
                const fileResult = await (window as any).api.readFile(filePath);

                if (!fileResult.success) continue;

                const serverImage = serverImageMap.get(filename);
                
                if (serverImage) {
                    // Image exists on server - check if we should update based on strategy
                    if (syncStrategy === 'local_always_wins') {
                        // Delete old image and upload new one (update)
                        await imageAPI.deleteImage(serverImage.id, true); // Mark as sync operation
                        const blob = new Blob([fileResult.data]);
                        const file = new File([blob], filename, { type: 'image/jpeg' });
                        const formData = new FormData();
                        formData.append('images', file);
                        await imageAPI.uploadImages(formData);
                        updatedCount++;
                        updatedImages.push(filename);
                    } else if (syncStrategy === 'last_write_wins') {
                        // Compare modification times to determine which version is newer
                        const localStats = await (window as any).api.getFileStats(filePath);
                        if (localStats && localStats.success && localStats.stats) {
                            const localMtime = localStats.stats.mtime;
                            const serverMtime = new Date(serverImage.lastModified).getTime();
                            
                            console.log(`[SYNC PUSH] Comparing ${filename}:`, {
                                localMtime: new Date(localMtime).toISOString(),
                                serverMtime: new Date(serverMtime).toISOString(),
                                localMs: localMtime,
                                serverMs: serverMtime,
                                localIsNewer: localMtime > serverMtime
                            });
                            
                            // Only update if local version is newer
                            if (localMtime > serverMtime) {
                                await imageAPI.deleteImage(serverImage.id, true); // Mark as sync operation
                                const blob = new Blob([fileResult.data]);
                                const file = new File([blob], filename, { type: 'image/jpeg' });
                                const formData = new FormData();
                                formData.append('images', file);
                                await imageAPI.uploadImages(formData);
                                updatedCount++;
                                updatedImages.push(filename);
                            }
                            // If server is newer or equal, keep server version
                        } else {
                            // If we can't get local stats, upload local version
                        await imageAPI.deleteImage(serverImage.id, true); // Mark as sync operation
                        const blob = new Blob([fileResult.data]);
                        const file = new File([blob], filename, { type: 'image/jpeg' });
                        const formData = new FormData();
                        formData.append('images', file);
                        await imageAPI.uploadImages(formData);
                        updatedCount++;
                        updatedImages.push(filename);
                        }
                    }
                    // If 'server_always_wins', don't update
                } else {
                    // Image doesn't exist on server - upload it
                    const blob = new Blob([fileResult.data]);
                    const file = new File([blob], filename, { type: 'image/jpeg' });
                    const formData = new FormData();
                    formData.append('images', file);
                    await imageAPI.uploadImages(formData);
                    uploadedCount++;
                    uploadedImages.push(filename);
                }
            } catch (err) {
                console.error(`Failed to upload ${filename}:`, err);
            }
        }

        // 5. Delete server images that don't exist locally (based on strategy)
        // For 'local_always_wins' and 'last_write_wins': delete server images that don't exist locally
        if (syncStrategy === 'local_always_wins' || syncStrategy === 'last_write_wins') {
            for (const serverImage of serverImages) {
                if (!localFileSet.has(serverImage.originalName)) {
                    try {
                        await imageAPI.deleteImage(serverImage.id, true); // Mark as sync operation
                        deletedCount++;
                        deletedImages.push(serverImage.originalName);
                    } catch (err) {
                        console.error(`Failed to delete ${serverImage.originalName}:`, err);
                    }
                }
            }
        }
        // If 'server_always_wins', keep server images that don't exist locally (server is truth source)

        // 6. Log sync on server with strategy and details
        console.log('[Sync Push] Sending details:', {
            uploadedImages,
            updatedImages,
            deletedImages,
        });
        const syncResponse = await syncAPI.push(syncStrategy, {
            uploadedImages,
            updatedImages,
            deletedImages,
        });
        return { 
            pushedImages: uploadedCount,
            updatedImages: updatedCount,
            deletedImages: deletedCount,
            conflictsResolved: syncResponse.data.conflictsResolved || 0,
            strategy: syncResponse.data.strategy,
            uploadedImageList: uploadedImages,
            updatedImageList: updatedImages,
            deletedImageList: deletedImages,
        };
    }
);

export const fetchSyncLogs = createAsyncThunk(
    'sync/fetchLogs',
    async (limit: number = 50) => {
        const response = await syncAPI.getLogs(limit);
        return response.data;
    }
);

const syncSlice = createSlice({
    name: 'sync',
    initialState,
    reducers: {
        clearSyncError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Fetch sync status
        builder
            .addCase(fetchSyncStatus.fulfilled, (state, action) => {
                state.localImages = action.payload.localImages;
                state.serverImages = action.payload.serverImages;
                state.totalImages = action.payload.totalImages;
                state.lastSyncTime = action.payload.lastSyncTime;
            });

        // Pull from server
        builder
            .addCase(pullFromServer.pending, (state) => {
                state.status = 'syncing';
                state.error = null;
            })
            .addCase(pullFromServer.fulfilled, (state) => {
                state.status = 'success';
                state.lastSyncTime = new Date().toISOString();
            })
            .addCase(pullFromServer.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.error.message || 'Failed to pull from server';
            });

        // Push to server
        builder
            .addCase(pushToServer.pending, (state) => {
                state.status = 'syncing';
                state.error = null;
            })
            .addCase(pushToServer.fulfilled, (state) => {
                state.status = 'success';
                state.lastSyncTime = new Date().toISOString();
            })
            .addCase(pushToServer.rejected, (state, action) => {
                state.status = 'error';
                state.error = action.error.message || 'Failed to push to server';
            });

        // Fetch logs
        builder
            .addCase(fetchSyncLogs.fulfilled, (state, action) => {
                state.logs = action.payload.logs;
            });
    },
});

export const { clearSyncError } = syncSlice.actions;
export default syncSlice.reducer;
