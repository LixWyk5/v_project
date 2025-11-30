import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

// Types
export interface Folder {
    id: number;
    name: string;
    parentId: number | null;
    createdAt: string;
    updatedAt: string;
    _count?: {
        images: number;
        children: number;
    };
    children?: Folder[];
}

interface FoldersState {
    items: Folder[];
    loading: boolean;
    error: string | null;
    currentFolderId: number | null;
}

const initialState: FoldersState = {
    items: [],
    loading: false,
    error: null,
    currentFolderId: null,
};

// API Client (Assuming base URL is http://localhost:3000/api)
const API_URL = 'http://localhost:3000/api/folders';

// Async Thunks
export const fetchFolders = createAsyncThunk(
    'folders/fetchFolders',
    async () => {
        const response = await axios.get(API_URL);
        return response.data;
    }
);

export const createFolder = createAsyncThunk(
    'folders/createFolder',
    async ({ name, parentId }: { name: string; parentId?: number | null }) => {
        const response = await axios.post(API_URL, { name, parentId });
        return response.data;
    }
);

export const updateFolder = createAsyncThunk(
    'folders/updateFolder',
    async ({ id, name, parentId }: { id: number; name: string; parentId?: number | null }) => {
        const response = await axios.put(`${API_URL}/${id}`, { name, parentId });
        return response.data;
    }
);

export const deleteFolder = createAsyncThunk(
    'folders/deleteFolder',
    async (id: number) => {
        await axios.delete(`${API_URL}/${id}`);
        return id;
    }
);

export const moveImageToFolder = createAsyncThunk(
    'folders/moveImage',
    async ({ imageId, folderId }: { imageId: number; folderId: number | null }) => {
        const response = await axios.put(`http://localhost:3000/api/images/${imageId}/move`, { folderId });
        return response.data;
    }
);

const foldersSlice = createSlice({
    name: 'folders',
    initialState,
    reducers: {
        setCurrentFolder: (state, action: PayloadAction<number | null>) => {
            state.currentFolderId = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Fetch Folders
        builder
            .addCase(fetchFolders.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchFolders.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload;
            })
            .addCase(fetchFolders.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch folders';
            });

        // Create Folder
        builder.addCase(createFolder.fulfilled, (state, action) => {
            state.items.push(action.payload);
            // Re-sort or re-organize if needed, for now just push
            state.items.sort((a, b) => a.name.localeCompare(b.name));
        });

        // Update Folder
        builder.addCase(updateFolder.fulfilled, (state, action) => {
            const index = state.items.findIndex(f => f.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        });

        // Delete Folder
        builder.addCase(deleteFolder.fulfilled, (state, action) => {
            state.items = state.items.filter(f => f.id !== action.payload);
            if (state.currentFolderId === action.payload) {
                state.currentFolderId = null;
            }
        });
    },
});

export const { setCurrentFolder, clearError } = foldersSlice.actions;
export default foldersSlice.reducer;
