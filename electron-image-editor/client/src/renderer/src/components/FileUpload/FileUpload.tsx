import React, { useState, useRef, useEffect } from "react";
import { App, theme, Button, Space, Upload } from "antd";
import { UploadOutlined, FileTextOutlined } from "@ant-design/icons";
import { useAppDispatch } from "../../store/hooks";
import { uploadImage, fetchImages } from "../../store/slices/imagesSlice";
import { fetchFolders } from "../../store/slices/foldersSlice";
import {
  setUploadStats,
  addUploadFileRecord,
} from "../../store/slices/uiSlice";
import { imageAPI } from "../../api/client";
import UploadZone from "./UploadZone";
import { UploadFileItem } from "./UploadProgress";

interface FileUploadProps {
  compact?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ compact = false }) => {
  const dispatch = useAppDispatch();
  const { message } = App.useApp();
  const [uploadQueue, setUploadQueue] = useState<UploadFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingBatch, setPendingBatch] = useState<UploadFileItem[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUploadingRef = useRef<boolean>(false); // Use ref for synchronous check

  const handleDrop = async (files: File[]) => {
    // Add files to queue
    const newItems: UploadFileItem[] = files.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: "pending",
      progress: 0,
    }));

    // If multiple files dropped at once, treat as batch upload immediately
    if (files.length > 1) {
      // Clear any pending timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = null;
      }
      setPendingBatch([]);
      // Add to queue and process immediately as batch
      setUploadQueue((prev) => {
        const updated = [...newItems, ...prev];
        // Use setTimeout to defer processQueue call to avoid setState during render
        setTimeout(() => processQueue(updated, true), 0);
        return updated;
      });
    } else {
      // Single file - add to pending batch and wait for more files
      const updatedPending = [...pendingBatch, ...newItems];
      setPendingBatch(updatedPending);

      // Add to queue - check for duplicates by filename and size
      setUploadQueue((prev) => {
        const existingFiles = new Set(
          prev.map((item) => `${item.file.name}-${item.file.size}`)
        );
        const uniqueNewItems = newItems.filter(
          (item) => !existingFiles.has(`${item.file.name}-${item.file.size}`)
        );
        return uniqueNewItems.length > 0 ? [...uniqueNewItems, ...prev] : prev;
      });

      // Clear existing timeout
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      // Wait 500ms to see if more files are coming
      batchTimeoutRef.current = setTimeout(() => {
        // Get current queue state
        setUploadQueue((currentQueue) => {
          // Only process items that are still pending and not already being processed
          const allPending = currentQueue.filter(
            (item) => item.status === "pending"
          );

          // Use setTimeout to defer processQueue call to avoid setState during render
          setTimeout(() => {
            if (allPending.length > 1) {
              // Multiple files accumulated - process as batch
              processQueue(allPending, true);
            } else if (allPending.length === 1) {
              // Only one file - process as single upload
              processQueue(allPending, false);
            }
          }, 0);

          setPendingBatch([]);
          batchTimeoutRef.current = null;
          return currentQueue;
        });
      }, 500);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  const handleBatchUpload = async () => {
    const pendingItems = uploadQueue.filter(
      (item) => item.status === "pending"
    );
    if (pendingItems.length === 0) {
      message.warning("No files to upload");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    pendingItems.forEach((item) => {
      formData.append("images", item.file);
    });

    try {
      const response = await imageAPI.uploadImages(formData);
      const result = response.data;

      // Add file records for batch upload
      pendingItems.forEach((item) => {
        const fileRecordId = item.id;
        const successItem = result.results.success.find(
          (s: any) => s.originalName === item.file.name
        );

        dispatch(
          addUploadFileRecord({
            id: fileRecordId,
            filename: item.file.name,
            size: item.file.size,
            status: successItem ? "success" : "error",
            progress: successItem ? 100 : 0,
            timestamp: Date.now(),
            isCorrupted: successItem?.isCorrupted || false,
            error: successItem ? undefined : "Upload failed",
          })
        );

        if (successItem) {
          updateItemStatus(item.id, "success", 100);
        } else {
          updateItemStatus(item.id, "error", 0, "Upload failed");
        }
      });

      // Update final stats (files array is maintained by addUploadFileRecord)
      dispatch(
        setUploadStats({
          totalFiles: result.totalFiles,
          totalSize: parseInt(result.totalSize) || 0,
          successCount: result.successCount,
          failedCount: result.failedCount,
          corruptedCount: result.corruptedCount,
          files: [], // Preserve existing files
        })
      );

      // Calculate total successful (including corrupted ones)
      const totalSuccessful = result.successCount + result.corruptedCount;

      let successMessage = "";
      if (result.corruptedCount > 0) {
        successMessage = `Upload successful ${totalSuccessful} images, ${result.corruptedCount} of which are corrupted`;
      } else {
        successMessage = `Upload successful ${totalSuccessful} images`;
      }

      if (result.failedCount > 0) {
        successMessage += `, ${result.failedCount} failed`;
      }

      message.success(successMessage);

      // Refresh gallery and folders
      dispatch(fetchImages({ page: 1, limit: 50 }));
      dispatch(fetchFolders());
    } catch (error: any) {
      message.error(`Batch upload failed: ${error.message}`);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
  };

  const handleConfigUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("config", file);

    try {
      const response = await imageAPI.uploadFromConfig(formData);
      const result = response.data;

      // Add file records for config upload
      // Note: Config upload processes multiple files, but we don't have individual file info here
      // So we'll just update the stats
      dispatch(
        setUploadStats({
          totalFiles: result.totalFiles,
          totalSize: parseInt(result.totalSize) || 0,
          successCount: result.successCount,
          failedCount: result.failedCount,
          corruptedCount: result.corruptedCount,
          files: [], // Preserve existing files
        })
      );

      // Calculate total successful (including corrupted ones)
      const totalSuccessful = result.successCount + result.corruptedCount;

      let successMessage = "";
      if (result.corruptedCount > 0) {
        successMessage = `Upload successful ${totalSuccessful} images, ${result.corruptedCount} of which are corrupted`;
      } else {
        successMessage = `Upload successful ${totalSuccessful} images`;
      }

      if (result.failedCount > 0) {
        successMessage += `, ${result.failedCount} failed`;
      }

      message.success(successMessage);

      // Refresh gallery and folders
      dispatch(fetchImages({ page: 1, limit: 50 }));
      dispatch(fetchFolders());
    } catch (error: any) {
      message.error(`Config upload failed: ${error.message}`);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
    return false; // Prevent default upload
  };

  const processQueue = async (
    queue: UploadFileItem[],
    forceBatch: boolean = false
  ) => {
    // Use ref for synchronous check to prevent race conditions
    if (isUploadingRef.current) {
      console.log("Already uploading, skipping...");
      return;
    }

    // Set both state and ref immediately
    isUploadingRef.current = true;
    setIsUploading(true);

    const pendingItems = queue.filter((item) => item.status === "pending");

    if (pendingItems.length === 0) {
      isUploadingRef.current = false;
      setIsUploading(false);
      return;
    }

    // Mark items as uploading immediately to prevent duplicate processing
    pendingItems.forEach((item) => {
      updateItemStatus(item.id, "uploading", 0);
    });

    // If multiple files or forced batch, use batch upload; otherwise use single upload
    if (pendingItems.length > 1 || forceBatch) {
      // Batch upload - all files in one batch
      const formData = new FormData();
      pendingItems.forEach((item) => {
        formData.append("images", item.file);
      });

      try {
        const response = await imageAPI.uploadImages(formData);
        const result = response.data;

        // Update all items based on result
        pendingItems.forEach((item) => {
          const successItem = result.results.success.find(
            (s: any) => s.originalName === item.file.name
          );
          const failedItem = result.results.failed.find(
            (f: any) => f.filename === item.file.name
          );
          const corruptedItem = result.results.corrupted.includes(
            item.file.name
          );

          if (successItem) {
            updateItemStatus(item.id, "success", 100);
          } else if (failedItem) {
            updateItemStatus(item.id, "error", 0, failedItem.error);
          } else if (corruptedItem) {
            updateItemStatus(item.id, "success", 100);
          } else {
            updateItemStatus(item.id, "error", 0, "Upload failed");
          }
        });

        // Calculate total successful (including corrupted ones)
        const totalSuccessful = result.successCount + result.corruptedCount;

        let successMessage = "";
        if (result.corruptedCount > 0) {
          successMessage = `Upload successful ${totalSuccessful} images, ${result.corruptedCount} of which are corrupted`;
        } else {
          successMessage = `Upload successful ${totalSuccessful} images`;
        }

        if (result.failedCount > 0) {
          successMessage += `, ${result.failedCount} failed`;
        }

        message.success(successMessage);

        // Refresh gallery and folders
        dispatch(fetchImages({ page: 1, limit: 50 }));
        dispatch(fetchFolders());
      } catch (error: any) {
        message.error(`Batch upload failed: ${error.message}`);
        pendingItems.forEach((item) => {
          updateItemStatus(item.id, "error", 0, error.message);
        });
      } finally {
        isUploadingRef.current = false;
        setIsUploading(false);
      }
    } else {
      // Single file upload
      const item = pendingItems[0];
      // Status already set to uploading above, no need to set again

      try {
        const result = await dispatch(uploadImage(item.file)).unwrap();

        updateItemStatus(item.id, "success", 100);
        const folderName = result.folder?.name || "Default";

        // Check if image is corrupted and show appropriate message
        if (result.isCorrupted) {
          message.warning(
            `${item.file.name} uploaded but is corrupted (1 corrupted). Saved to "${folderName}" folder.`
          );
        } else {
          message.success(
            `${item.file.name} uploaded successfully. Saved to "${folderName}" folder.`
          );
        }

        // Refresh gallery and folders
        dispatch(fetchImages({ page: 1, limit: 50 }));
        dispatch(fetchFolders());
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.details ||
          error.response?.data?.error ||
          error.message ||
          "Upload failed";
        updateItemStatus(item.id, "error", 0, errorMsg);
        message.error(`Failed to upload ${item.file.name}: ${errorMsg}`);
      } finally {
        isUploadingRef.current = false;
        setIsUploading(false);
      }
    }
  };

  const updateItemStatus = (
    id: string,
    status: UploadFileItem["status"],
    progress: number,
    error?: string
  ) => {
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status, progress, error } : item
      )
    );
  };

  const { token } = theme.useToken();

  return (
    <div
      style={{
        maxWidth: compact ? "100%" : 800,
        margin: compact ? 0 : "0 auto",
        width: "100%",
      }}
    >
      {!compact && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ marginBottom: 8, color: token.colorTextBase }}>
            Upload Images
          </h2>
          <p style={{ color: token.colorTextSecondary }}>
            Add images to your library. They will be automatically synced.
          </p>
        </div>
      )}
      <Space
        direction="vertical"
        style={{ width: "100%" }}
        size={compact ? "small" : "large"}
      >
        <UploadZone
          onDrop={handleDrop}
          disabled={isUploading}
          compact={compact}
        />

        <Space size={compact ? "small" : "middle"} style={{ width: "100%" }}>
          <Button
            type="primary"
            size={compact ? "small" : "default"}
            onClick={handleBatchUpload}
            disabled={
              isUploading ||
              uploadQueue.filter((item) => item.status === "pending").length ===
                0
            }
            loading={isUploading}
            style={compact ? { flex: 1 } : undefined}
          >
            <UploadOutlined /> Upload All Pending
          </Button>
          <Upload
            accept=".json"
            beforeUpload={handleConfigUpload}
            showUploadList={false}
          >
            <Button
              icon={<FileTextOutlined />}
              size={compact ? "small" : "default"}
              disabled={isUploading}
              style={compact ? { flex: 1 } : undefined}
            >
              {compact ? "Upload JSON" : "Upload JSON Config"}
            </Button>
          </Upload>
        </Space>
      </Space>
    </div>
  );
};

export default FileUpload;
