import { configureStore } from '@reduxjs/toolkit';
import imagesReducer from './slices/imagesSlice';
import uiReducer from './slices/uiSlice';
import syncReducer from './slices/syncSlice';
import foldersReducer from './slices/foldersSlice';

export const store = configureStore({
    reducer: {
        images: imagesReducer,
        ui: uiReducer,
        sync: syncReducer,
        folders: foldersReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['images/uploadImage/fulfilled'],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
