import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Image } from '../../types';
import { imageAPI } from '../../api/client';

interface ImagesState {
    items: Image[];
    selectedImage: Image | null;
    selectedIds: number[];
    loading: boolean;
    error: string | null;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    filters: {
        format: string | null;
        search: string;
    };
}

const initialState: ImagesState = {
    items: [],
    selectedImage: null,
    selectedIds: [],
    loading: false,
    error: null,
    pagination: {
        page: 1,
        limit: 100,
        total: 0,
        totalPages: 0,
    },
    filters: {
        format: null,
        search: '',
    },
};

// Async thunks
export const fetchImages = createAsyncThunk(
    'images/fetchImages',
    async (params: { page?: number; limit?: number; format?: string; search?: string; folderId?: number | null; status?: string; hasExif?: boolean } = {}) => {
        const response = await imageAPI.getImages(params);
        return response.data;
    }
);

export const fetchImageById = createAsyncThunk(
    'images/fetchImageById',
    async (id: number) => {
        const response = await imageAPI.getImage(id);
        return response.data;
    }
);

export const uploadImage = createAsyncThunk(
    'images/uploadImage',
    async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        const response = await imageAPI.uploadImage(formData);
        return response.data;
    }
);

export const uploadMultipleImages = createAsyncThunk(
    'images/uploadMultipleImages',
    async (files: File[]) => {
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));
        const response = await imageAPI.uploadImages(formData);
        return response.data;
    }
);

export const deleteImage = createAsyncThunk(
    'images/deleteImage',
    async (id: number) => {
        await imageAPI.deleteImage(id);
        return id;
    }
);

export const renameImage = createAsyncThunk(
    'images/renameImage',
    async ({ id, name }: { id: number; name: string }) => {
        const response = await imageAPI.updateImage(id, { originalName: name });
        return response.data;
    }
);

const imagesSlice = createSlice({
    name: 'images',
    initialState,
    reducers: {
        setSelectedImage: (state, action: PayloadAction<Image | null>) => {
            state.selectedImage = action.payload;
        },
        toggleSelection: (state, action: PayloadAction<number>) => {
            const id = action.payload;
            const index = state.selectedIds.indexOf(id);
            if (index === -1) {
                state.selectedIds.push(id);
            } else {
                state.selectedIds.splice(index, 1);
            }
        },
        selectAll: (state) => {
            state.selectedIds = state.items.map(item => item.id);
        },
        clearSelection: (state) => {
            state.selectedIds = [];
        },
        setFilters: (state, action: PayloadAction<Partial<ImagesState['filters']>>) => {
            state.filters = { ...state.filters, ...action.payload };
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        // Fetch images
        builder
            .addCase(fetchImages.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchImages.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.images;
                if (action.payload.pagination) {
                    state.pagination = action.payload.pagination;
                }
            })
            .addCase(fetchImages.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch images';
            });

        // Fetch single image
        builder
            .addCase(fetchImageById.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchImageById.fulfilled, (state, action) => {
                state.loading = false;
                state.selectedImage = action.payload;
            })
            .addCase(fetchImageById.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch image';
            });

        // Upload image
        builder
            .addCase(uploadImage.pending, (state) => {
                state.loading = true;
            })
            .addCase(uploadImage.fulfilled, (state, action) => {
                state.loading = false;
                state.items.unshift(action.payload.image);
            })
            .addCase(uploadImage.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to upload image';
            });

        // Delete image
        builder
            .addCase(deleteImage.fulfilled, (state, action) => {
                state.items = state.items.filter((img) => img.id !== action.payload);
                if (state.selectedImage?.id === action.payload) {
                    state.selectedImage = null;
                }
            });

        // Rename image
        builder
            .addCase(renameImage.fulfilled, (state, action) => {
                const index = state.items.findIndex((img) => img.id === action.payload.image.id);
                if (index !== -1) {
                    state.items[index] = action.payload.image;
                }
                if (state.selectedImage?.id === action.payload.image.id) {
                    state.selectedImage = action.payload.image;
                }
            });
    },
});

export const { setSelectedImage, toggleSelection, selectAll, clearSelection, setFilters, clearError } = imagesSlice.actions;
export default imagesSlice.reducer;
