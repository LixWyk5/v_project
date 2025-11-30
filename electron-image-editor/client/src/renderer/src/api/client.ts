import axios from "axios";

const API_BASE_URL = "http://localhost:3000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Remove Content-Type header for FormData to let axios set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;

// API endpoints
export const imageAPI = {
  // Get all images
  getImages: (params?: {
    page?: number;
    limit?: number;
    format?: string;
    search?: string;
    folderId?: number | null;
    status?: string;
    hasExif?: boolean;
  }) => {
    // Clean up parameters: remove undefined and null values
    const cleanParams: any = {};

    if (params) {
      // Only add defined parameters (not undefined and not string 'undefined')
      if (params.page !== undefined) cleanParams.page = params.page;
      if (params.limit !== undefined) cleanParams.limit = params.limit;
      if (params.format !== undefined && params.format !== 'undefined' && params.format !== null) cleanParams.format = params.format;
      if (params.search !== undefined && params.search !== 'undefined' && params.search !== null) cleanParams.search = params.search;
      if (params.status !== undefined && params.status !== 'undefined' && params.status !== null) cleanParams.status = params.status;

      // Handle folderId: null means show all, undefined means don't filter
      if (params.folderId !== undefined && params.folderId !== null) {
        cleanParams.folderId = params.folderId;
      }

      // Convert hasExif boolean to string for query parameter
      if (params.hasExif !== undefined && params.hasExif !== null) {
        cleanParams.hasExif = params.hasExif ? "true" : undefined;
        console.log('[API] hasExif parameter:', params.hasExif, '->', cleanParams.hasExif);
      }
    }

    console.log('[API] getImages cleanParams:', cleanParams);
    return apiClient.get("/images", { params: cleanParams });
  },

  // Get single image
  getImage: (id: number, includeExif?: boolean) =>
    apiClient.get(`/images/${id}`, {
      params: { includeExif: includeExif ? "true" : undefined },
    }),

  // Get EXIF data
  getExif: (id: number) => apiClient.get(`/images/${id}/exif`),

  // Upload single image
  uploadImage: (formData: FormData) =>
    apiClient.post("/upload/single", formData, {
      // Don't set Content-Type header - let axios set it with boundary
    }),

  // Upload multiple images
  uploadImages: (formData: FormData) =>
    apiClient.post("/upload/multiple", formData),

  // Upload from JSON config
  uploadFromConfig: (formData: FormData) =>
    apiClient.post("/upload/batch-config", formData, {
      // Don't set Content-Type header - let axios set it with boundary
    }),

  // Crop image
  cropImage: (
    id: number,
    cropData: { x: number; y: number; width: number; height: number }
  ) => apiClient.post(`/images/${id}/crop`, cropData),

  // Preview image filter (temporary)
  previewFilter: (
    id: number,
    filter: string,
    sourceTempFilename?: string | null
  ) =>
    apiClient.post(`/images/${id}/filter/preview`, {
      filter,
      sourceTempFilename,
    }),

  // Preview crop operation
  previewCrop: (
    id: number,
    cropData: { x: number; y: number; width: number; height: number },
    sourceTempFilename?: string | null
  ) =>
    apiClient.post(`/images/${id}/crop/preview`, {
      ...cropData,
      sourceTempFilename,
    }),

  // Preview rotate operation
  previewRotate: (
    id: number,
    direction: "left" | "right",
    sourceTempFilename?: string | null
  ) =>
    apiClient.post(`/images/${id}/rotate/preview`, {
      direction,
      sourceTempFilename,
    }),

  // Save all operations
  saveOperations: (
    id: number,
    data: {
      tempFilename: string;
      operations: any[];
      saveAsCopy: boolean;
    }
  ) => apiClient.post(`/images/${id}/operations/save`, data),

  // Save filter preview (legacy)
  saveFilter: (
    id: number,
    data: { tempFilename: string; filter: string; saveAsCopy: boolean }
  ) => apiClient.post(`/images/${id}/filter/save`, data),

  // Apply image filter (legacy - kept for backward compatibility)
  applyFilter: (id: number, filter: string) =>
    apiClient.post(`/images/${id}/filter`, { filter }),

  // Update image details
  updateImage: (id: number, data: { originalName?: string }) =>
    apiClient.put(`/images/${id}`, data),

  // Delete image
  deleteImage: (id: number, isSyncOperation?: boolean) => {
    if (isSyncOperation) {
      // For DELETE requests with body, we need to use a workaround
      // Some servers don't support body in DELETE, so we'll use a query parameter instead
      console.log('[API] deleteImage called with isSyncOperation=true for id:', id);
      return apiClient.delete(`/images/${id}?isSyncOperation=true`);
    }
    console.log('[API] deleteImage called without isSyncOperation for id:', id);
    return apiClient.delete(`/images/${id}`);
  },

  // Update metadata
  updateMetadata: (id: number, metadata: Record<string, any>) =>
    apiClient.put(`/images/${id}/metadata`, { metadata }),

  // Get statistics
  getStats: () => apiClient.get("/images/stats/summary"),

  // Get image file URL
  getImageUrl: (id: number) => `${API_BASE_URL}/images/${id}/file`,

  // Get thumbnail URL
  getThumbnailUrl: (id: number) => `${API_BASE_URL}/images/${id}/thumbnail`,
};

export const uploadAPI = {
  // Get upload batches
  getBatches: (params?: { page?: number; limit?: number }) =>
    apiClient.get("/upload/batches", { params }),

  // Get single batch
  getBatch: (batchId: string) => apiClient.get(`/upload/batches/${batchId}`),
};

export const syncAPI = {
  // Get sync status
  getStatus: () => apiClient.get("/sync/status"),

  // Pull from server
  pull: (strategy?: string, details?: { downloadedImages?: string[], updatedImages?: string[], deletedImages?: string[] }) =>
    apiClient.post("/sync/pull", { strategy, details }),

  // Push to server
  push: (strategy?: string, details?: { uploadedImages?: string[], updatedImages?: string[], deletedImages?: string[] }) =>
    apiClient.post("/sync/push", { strategy, details }),

  // Get sync logs
  getLogs: (limit?: number) =>
    apiClient.get("/sync/logs", { params: { limit } }),
};
