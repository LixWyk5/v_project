// TypeScript types for the application

export interface Image {
    id: number;
    filename: string;
    originalName: string;
    filePath: string;
    thumbnailPath: string | null;
    fileSize: string;
    format: string;
    width: number | null;
    height: number | null;
    isCorrupted: boolean;
    uploadDate: string;
    lastModified: string;
    metadata: Record<string, any> | null;
    source: 'local' | 'server';
    synced?: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SyncLog {
    id: number;
    action: string;
    imageId: number | null;
    timestamp: string;
    details: Record<string, any> | null;
    status: 'success' | 'failed' | 'pending';
}

export interface UploadProgress {
    filename: string;
    progress: number;
    status: 'uploading' | 'success' | 'error';
}

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
