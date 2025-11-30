import React, { useState, useEffect } from "react";
import {
  Layout,
  Button,
  Space,
  Typography,
  Divider,
  Tooltip,
  theme,
  App,
  Modal,
  Input,
  Dropdown,
  Alert,
} from "antd";
import type { MenuProps } from "antd";
import {
    ZoomInOutlined,
    ZoomOutOutlined,
    RotateRightOutlined,
    RotateLeftOutlined,
    UndoOutlined,
  ClearOutlined,
    InfoCircleOutlined,
    DeleteOutlined,
    ArrowLeftOutlined,
    SaveOutlined,
    EditOutlined,
  CloudDownloadOutlined,
  ScissorOutlined,
  BorderOutlined,
  FilterOutlined,
  DownOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { setSidebarTab } from "../../store/slices/uiSlice";
import {
  deleteImage,
  renameImage,
  fetchImages,
} from "../../store/slices/imagesSlice";
import { imageAPI } from "../../api/client";
import ExifEditor from "../ExifEditor/ExifEditor";
import WatermarkModal, { WatermarkOptions } from "./WatermarkModal";
import { addTextWatermark, addImageWatermark, isWasmAvailable } from "../../utils/wasmImageProcessor";

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

const SingleImageViewer: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const { selectedImage } = useAppSelector((state) => state.images);
    const { message, modal } = App.useApp();

    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // Rename state
    const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [newName, setNewName] = useState("");

  // Selection/Crop state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selection, setSelection] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [imageNaturalSize, setImageNaturalSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null
  );
  const [isExifEditorVisible, setIsExifEditorVisible] = useState(false);
  const [hasExifData, setHasExifData] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);

  // Operation history system
  type OperationType = "crop" | "rotate" | "filter" | "watermark";
  type Operation = {
    type: OperationType;
    data: any;
    tempFilename: string;
    previewUrl: string;
  };

  const [operationHistory, setOperationHistory] = useState<Operation[]>([]);
  const [currentPreview, setCurrentPreview] = useState<{
    url: string;
    tempFilename: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Watermark state
  const [isWatermarkModalVisible, setIsWatermarkModalVisible] = useState(false);
  const [isWatermarkProcessing, setIsWatermarkProcessing] = useState(false);

    useEffect(() => {
        if (selectedImage) {
            setNewName(selectedImage.originalName);
      setSelection(null);
      setSelectionStart(null);
      setIsSelectionMode(false);
      setCurrentPreview(null);
      setOperationHistory([]);
      setHasUnsavedChanges(false);
      setIsEditMode(false);
      checkExifData();
        }
    }, [selectedImage]);

  // Check if image has EXIF data
  const checkExifData = async () => {
    if (!selectedImage) {
      setHasExifData(false);
      return;
    }

    try {
      // First check if metadata already contains EXIF data
      if (selectedImage.metadata?.exif) {
        const exif = selectedImage.metadata.exif;
        // Check if EXIF data has any meaningful content
        const hasContent = exif.make || exif.model || exif.dateTimeOriginal || 
                          exif.iso || exif.fNumber || exif.exposureTime || 
                          exif.focalLength || exif.gpsLatitude || exif.gpsLongitude || 
                          exif.software;
        setHasExifData(!!hasContent);
        return;
      }

      // If not in metadata, try to fetch from API
      const response = await imageAPI.getExif(selectedImage.id);
      if (response.data?.exif) {
        const exif = response.data.exif;
        const hasContent = exif.make || exif.model || exif.dateTimeOriginal || 
                          exif.iso || exif.fNumber || exif.exposureTime || 
                          exif.focalLength || exif.gpsLatitude || exif.gpsLongitude || 
                          exif.software;
        setHasExifData(!!hasContent);
      } else {
        setHasExifData(false);
      }
    } catch (error) {
      // If EXIF fetch fails, assume no EXIF data
      setHasExifData(false);
    }
  };

  // Check for unsaved changes before leaving
  const handleBack = () => {
    // Only check for unsaved changes in edit mode
    // In view mode, previews are temporary and should be discarded
    if (isEditMode && hasUnsavedChanges) {
      modal.confirm({
        title: "Unsaved Changes",
        content: "You have unsaved changes. How would you like to proceed?",
        okText: "Save as Copy",
        cancelText: "Discard",
        okType: "default",
        onOk: async () => {
          await handleSaveAll(true);
        },
        onCancel: () => {
          modal.confirm({
            title: "Discard Changes?",
            content: "Are you sure you want to discard all unsaved changes?",
            okText: "Discard",
            okType: "danger",
            cancelText: "Cancel",
            onOk: () => {
              setCurrentPreview(null);
              setOperationHistory([]);
              setHasUnsavedChanges(false);
              setIsEditMode(false);
              dispatch(setSidebarTab("gallery"));
            },
          });
        },
        footer: (_, { OkBtn, CancelBtn }) => (
          <>
            <Button
              type="primary"
              onClick={async () => {
                await handleSaveAll(false);
                // Modal will close automatically after save
              }}
            >
              Apply to Original
            </Button>
            <CancelBtn />
            <OkBtn />
          </>
        ),
      });
    } else {
      // In view mode or no unsaved changes, just clear preview and go back
      setCurrentPreview(null);
      setOperationHistory([]);
      setHasUnsavedChanges(false);
      dispatch(setSidebarTab("gallery"));
    }
  };

    if (!selectedImage) {
        return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: token.colorTextSecondary,
        }}
      >
        <Title level={4} style={{ color: token.colorText }}>
          No Image Selected
        </Title>
        <Text type="secondary">
          Select an image from the gallery to view it here.
        </Text>
                <Button
                    type="primary"
                    style={{ marginTop: 16 }}
          onClick={() => dispatch(setSidebarTab("gallery"))}
                >
                    Go to Gallery
                </Button>
            </div>
        );
    }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.1));
  const handleRotateRight = () => {
    handlePreviewRotate("right");
  };
  const handleRotateLeft = () => {
    handlePreviewRotate("left");
  };
    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    };

    const handleDelete = () => {
        modal.confirm({
      title: "Delete Image",
      content:
        "Are you sure you want to delete this image? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
            onOk: async () => {
                try {
                    await dispatch(deleteImage(selectedImage.id)).unwrap();
          message.success("Image deleted successfully");
          dispatch(setSidebarTab("gallery"));
                } catch (error: any) {
                    message.error(`Failed to delete image: ${error.message}`);
                }
            },
        });
    };

    const handleRename = () => {
        // Extract filename without extension
        const lastDotIndex = selectedImage.originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 
            ? selectedImage.originalName.substring(0, lastDotIndex) 
            : selectedImage.originalName;
        setNewName(nameWithoutExt);
        setIsRenameModalVisible(true);
    };

    const submitRename = async () => {
        if (!newName.trim()) return;
        
        // Get the original extension
        const lastDotIndex = selectedImage.originalName.lastIndexOf('.');
        const extension = lastDotIndex > 0 
            ? selectedImage.originalName.substring(lastDotIndex) 
            : '';
        
        // Remove any extension the user might have typed and use original extension
        let nameWithoutExt = newName.trim();
        const userLastDotIndex = nameWithoutExt.lastIndexOf('.');
        if (userLastDotIndex > 0) {
            // User typed an extension, remove it
            nameWithoutExt = nameWithoutExt.substring(0, userLastDotIndex);
        }
        
        // Combine new name with original extension
        const fullName = nameWithoutExt + extension;
        
        try {
      await dispatch(
        renameImage({ id: selectedImage.id, name: fullName })
      ).unwrap();
      message.success("Image renamed successfully");
            setIsRenameModalVisible(false);
        } catch (error: any) {
            message.error(`Failed to rename image: ${error.message}`);
        }
    };

    const handleSaveAs = async () => {
        try {
            // Ensure filename has extension
            let filename = selectedImage.originalName;
            const ext = `.${selectedImage.format.toLowerCase()}`;
            if (!filename.toLowerCase().endsWith(ext)) {
                filename += ext;
            }

            const result = await (window as any).api.saveFile({
                defaultPath: filename,
                filters: [
          { name: "Images", extensions: ["jpg", "png", "gif", "tiff"] },
        ],
            });

            if (!result.canceled && result.filePath) {
        const response = await fetch(
          `http://localhost:3000/api/images/${selectedImage.id}/file`
        );

                if (!response.ok) {
                    throw new Error(`Failed to download image: ${response.statusText}`);
                }

                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

        const writeResult = await (window as any).api.writeFile(
          result.filePath,
          buffer
        );
                if (writeResult && writeResult.success === false) {
          throw new Error(writeResult.error || "Failed to write file");
                }

        message.success("Image saved successfully");
            }
        } catch (error: any) {
            message.error(`Failed to save image: ${error.message}`);
        }
    };

    const handleSaveToDefault = async () => {
        try {
      let downloadFolder = localStorage.getItem("downloadFolder");
            if (!downloadFolder) {
                // Prompt user to select a folder
                const result = await (window as any).api.openDirectory();
                if (!result.canceled && result.filePaths.length > 0) {
                    downloadFolder = result.filePaths[0];
          localStorage.setItem("downloadFolder", downloadFolder!);
          message.success("Download folder configured");
                } else {
          message.warning("No download folder selected. Operation cancelled.");
                    return;
                }
            }

            // Ensure target directory exists
            const exists = await (window as any).api.exists(downloadFolder);
            if (!exists) {
                await (window as any).api.createDirectory(downloadFolder);
            }

      const response = await fetch(
        `http://localhost:3000/api/images/${selectedImage.id}/file`
      );

            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // Ensure filename has extension
            let filename = selectedImage.originalName;
            const ext = `.${selectedImage.format.toLowerCase()}`;
            if (!filename.toLowerCase().endsWith(ext)) {
                filename += ext;
            }

      const filePath = await (window as any).api.pathJoin(
        downloadFolder,
        filename
      );
            const writeResult = await (window as any).api.writeFile(filePath, buffer);

            if (writeResult && writeResult.success === false) {
        throw new Error(writeResult.error || "Failed to write file");
            }

            message.success(`Image saved to ${downloadFolder}`);
        } catch (error: any) {
            message.error(`Failed to save image: ${error.message}`);
        }
    };

    // Mouse interactions
    const handleWheel = (e: React.WheelEvent) => {
    // Prevent default scroll behavior when zooming
    e.preventDefault();
    e.stopPropagation();

        // Zoom with wheel
        if (e.deltaY < 0) {
      setZoom((prev) => Math.min(prev + 0.1, 5));
        } else {
      setZoom((prev) => Math.max(prev - 0.1, 0.1));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        handleSaveAs();
    };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelection(null);
    setSelectionStart(null);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const newSize = { width: img.naturalWidth, height: img.naturalHeight };

    // Get container dimensions
    const container =
      img.closest(".image-viewer-content") ||
      img.closest(".ant-layout-content") ||
      img.parentElement?.parentElement;
    const containerRect = container?.getBoundingClientRect();

    // If this is a rotated image (size changed), reset zoom and pan
    if (imageNaturalSize.width > 0 && imageNaturalSize.height > 0) {
      const wasLandscape = imageNaturalSize.width > imageNaturalSize.height;
      const isLandscape = newSize.width > newSize.height;

      // If aspect ratio changed (likely due to rotation), reset view and force proper sizing
      if (wasLandscape !== isLandscape) {
        // Force reset zoom and pan when aspect ratio changes
        setZoom(1);
        setPan({ x: 0, y: 0 });

        // The image size should have been pre-set in handlePreviewRotate
        // But if it wasn't, set it here as a fallback
        // Use the container dimensions from BEFORE the image loaded
        if (
          img &&
          containerRect &&
          containerRect.width > 0 &&
          containerRect.height > 0
        ) {
          const containerWidth = containerRect.width;
          const containerHeight = containerRect.height;
          const imageAspect = newSize.width / newSize.height;
          const containerAspect = containerWidth / containerHeight;

          let displayWidth: number;
          let displayHeight: number;

          if (imageAspect > containerAspect) {
            displayWidth = containerWidth;
            displayHeight = containerWidth / imageAspect;
          } else {
            displayHeight = containerHeight;
            displayWidth = containerHeight * imageAspect;
          }

          // Check if size was already pre-set in handlePreviewRotate
          // If not, set it now (but this should rarely happen)
          const currentWidth = img.style.width;
          const currentHeight = img.style.height;
          const currentWidthNum = currentWidth ? parseFloat(currentWidth) : 0;
          const currentHeightNum = currentHeight
            ? parseFloat(currentHeight)
            : 0;

          // Only update if significantly different (allow small rounding errors)
          const widthDiff = Math.abs(currentWidthNum - displayWidth);
          const heightDiff = Math.abs(currentHeightNum - displayHeight);

          if (widthDiff > 1 || heightDiff > 1) {
            img.style.setProperty("width", `${displayWidth}px`, "important");
            img.style.setProperty("height", `${displayHeight}px`, "important");
            img.style.setProperty("max-width", "100%", "important");
            img.style.setProperty("max-height", "100%", "important");
            img.style.setProperty("object-fit", "contain", "important");
            img.style.setProperty("display", "block", "important");
            void img.offsetWidth;
          }
        }
      }
    }

    setImageNaturalSize(newSize);
    setImageElement(img);
  };

  const handleMouseDownOnImage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectionMode || !imageElement) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = imageElement.getBoundingClientRect();
    const scaleX = imageNaturalSize.width / rect.width;
    const scaleY = imageNaturalSize.height / rect.height;

    const x = Math.max(
      0,
      Math.min(imageNaturalSize.width, (e.clientX - rect.left) * scaleX)
    );
    const y = Math.max(
      0,
      Math.min(imageNaturalSize.height, (e.clientY - rect.top) * scaleY)
    );

    setSelectionStart({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMoveOnImage = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectionMode || !selectionStart || !imageElement) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = imageElement.getBoundingClientRect();
    const scaleX = imageNaturalSize.width / rect.width;
    const scaleY = imageNaturalSize.height / rect.height;

    const currentX = Math.max(
      0,
      Math.min(imageNaturalSize.width, (e.clientX - rect.left) * scaleX)
    );
    const currentY = Math.max(
      0,
      Math.min(imageNaturalSize.height, (e.clientY - rect.top) * scaleY)
    );

    const x = Math.min(selectionStart.x, currentX);
    const y = Math.min(selectionStart.y, currentY);
    const width = Math.abs(currentX - selectionStart.x);
    const height = Math.abs(currentY - selectionStart.y);

    setSelection({ x, y, width, height });
  };

  const handleMouseUpOnImage = () => {
    if (isSelectionMode) {
      setSelectionStart(null);
    }
  };

  // Preview crop operation
  const handlePreviewCrop = async () => {
    if (!selection || !selectedImage || !imageElement) return;

    // Check if image is corrupted
    if (selectedImage.isCorrupted) {
      modal.warning({
        title: (
          <Space>
            <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 20 }} />
            <span>Cannot Crop Image</span>
          </Space>
        ),
        width: 500,
        content: (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="This image is corrupted"
              description={`Cannot crop corrupted images. The file "${selectedImage.originalName}" is damaged and cannot be processed.`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />
          </div>
        ),
        okText: "OK",
      });
      return;
    }

    try {
      const hideLoading = message.loading("Previewing crop...", 0);

      const cropData = {
        x: Math.round(selection.x),
        y: Math.round(selection.y),
        width: Math.round(selection.width),
        height: Math.round(selection.height),
      };

      const sourceTempFilename = currentPreview
        ? currentPreview.tempFilename
        : null;

      const response = await imageAPI.previewCrop(
        selectedImage.id,
        cropData,
        sourceTempFilename
      );

      hideLoading();

      // Only save to operation history if in edit mode
      if (isEditMode) {
        const newOperation: Operation = {
          type: "crop",
          data: cropData,
          tempFilename: response.data.tempFilename,
          previewUrl: response.data.previewUrl,
        };

        setOperationHistory((prev) => [...prev, newOperation]);
        setHasUnsavedChanges(true);
      }

      setCurrentPreview({
        url: `http://localhost:3000${response.data.previewUrl}`,
        tempFilename: response.data.tempFilename,
      });

      // Reset selection
      setSelection(null);
      setSelectionStart(null);
      setIsSelectionMode(false);
    } catch (error: any) {
      const errorDetails =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      message.error(`Failed to preview crop: ${errorDetails}`);
    }
  };

  // Preview image filter
  const handlePreviewFilter = async (filter: string) => {
    if (!selectedImage) return;

    // Check if image is corrupted
    if (selectedImage.isCorrupted) {
      modal.warning({
        title: (
          <Space>
            <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 20 }} />
            <span>Cannot Apply Filter</span>
          </Space>
        ),
        width: 500,
        content: (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="This image is corrupted"
              description={`Cannot apply filters to corrupted images. The file "${selectedImage.originalName}" is damaged and cannot be processed.`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />
          </div>
        ),
        okText: "OK",
      });
      return;
    }

    try {
      const hideLoading = message.loading(`Applying ${filter} filter...`, 0);

      const sourceTempFilename = currentPreview
        ? currentPreview.tempFilename
        : null;

      const response = await imageAPI.previewFilter(
        selectedImage.id,
        filter,
        sourceTempFilename
      );

      hideLoading();

      // Only save to operation history if in edit mode
      if (isEditMode) {
        const newOperation: Operation = {
          type: "filter",
          data: { filter },
          tempFilename: response.data.tempFilename,
          previewUrl: response.data.previewUrl,
        };

        setOperationHistory((prev) => [...prev, newOperation]);
        setHasUnsavedChanges(true);
      }

      setCurrentPreview({
        url: `http://localhost:3000${response.data.previewUrl}`,
        tempFilename: response.data.tempFilename,
      });
    } catch (error: any) {
      const errorDetails =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      message.error(`Failed to preview filter: ${errorDetails}`);
    }
  };

  // Handle watermark preview (WASM)
  const handleWatermarkPreview = async (options: WatermarkOptions) => {
    if (!selectedImage) return;

    // Check if image is corrupted
    if (selectedImage.isCorrupted) {
      modal.warning({
        title: (
          <Space>
            <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 20 }} />
            <span>Cannot Add Watermark</span>
          </Space>
        ),
        width: 500,
        content: (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="This image is corrupted"
              description={`Cannot add watermark to corrupted images. The file "${selectedImage.originalName}" is damaged and cannot be processed.`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />
          </div>
        ),
        okText: "OK",
      });
      return;
    }

    try {
      setIsWatermarkProcessing(true);
      const hideLoading = message.loading("Processing watermark with WASM...", 0);

      // Check WASM availability
      const wasmAvailable = await isWasmAvailable();
      if (!wasmAvailable) {
        hideLoading();
        message.warning("WASM not available, falling back to server processing");
        // TODO: Fallback to server processing if needed
        setIsWatermarkModalVisible(false);
        return;
      }

      // Get image data
      const imageUrl = currentPreview
        ? currentPreview.url
        : `http://localhost:3000/api/images/${selectedImage.id}/file`;
      
      const response = await fetch(imageUrl);
      const imageBlob = await response.blob();
      const imageData = new Uint8Array(await imageBlob.arrayBuffer());

      let processedData: Uint8Array;

      if (options.type === 'text') {
        // Add text watermark
        processedData = await addTextWatermark(imageData, {
          text: options.text,
          position: options.position,
          opacity: options.opacity,
          fontSize: options.fontSize,
          fontColor: options.fontColor,
          offsetX: options.offsetX,
          offsetY: options.offsetY,
          angle: (options as any).angle,
          spacing: (options as any).spacing,
        });
      } else {
        // Add image watermark
        if (!options.imageFile) {
          throw new Error('Watermark image file is required');
        }
        const watermarkData = new Uint8Array(await options.imageFile.arrayBuffer());
        processedData = await addImageWatermark(imageData, watermarkData, {
          position: options.position,
          opacity: options.opacity,
          offsetX: options.offsetX,
          offsetY: options.offsetY,
          angle: (options as any).angle,
          spacing: (options as any).spacing,
        });
      }

      hideLoading();

      // Upload preview to server temp directory
      const blob = new Blob([processedData], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('preview', blob, `watermark_${Date.now()}.jpg`);

      const uploadResponse = await fetch('http://localhost:3000/api/images/preview/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload preview to server');
      }

      const uploadData = await uploadResponse.json();
      const tempFilename = uploadData.tempFilename;
      const previewUrl = uploadData.previewUrl;

      // Save to operation history if in edit mode
      if (isEditMode) {
        const newOperation: Operation = {
          type: "watermark",
          data: options,
          tempFilename,
          previewUrl: previewUrl,
        };

        setOperationHistory((prev) => [...prev, newOperation]);
        setHasUnsavedChanges(true);
      }

      setCurrentPreview({
        url: `http://localhost:3000${previewUrl}`,
        tempFilename,
      });

      setIsWatermarkModalVisible(false);
      message.success("Watermark applied successfully (WASM)");
    } catch (error: any) {
      message.error(`Failed to apply watermark: ${error.message}`);
      console.error('Watermark error:', error);
    } finally {
      setIsWatermarkProcessing(false);
    }
  };

  // Preview rotate operation
  const handlePreviewRotate = async (direction: "left" | "right") => {
    if (!selectedImage) return;

    if (selectedImage.isCorrupted) {
      modal.warning({
        title: (
          <Space>
            <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 20 }} />
            <span>Cannot Rotate Image</span>
          </Space>
        ),
        width: 500,
        content: (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="This image is corrupted"
              description={`Cannot rotate corrupted images. The file "${selectedImage.originalName}" is damaged and cannot be processed.`}
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />
          </div>
        ),
        okText: "OK",
      });
      return;
    }

    try {
      const hideLoading = message.loading(
        `Rotating ${direction === "left" ? "left" : "right"}...`,
        0
      );

      const sourceTempFilename = currentPreview
        ? currentPreview.tempFilename
        : null;

      const response = await imageAPI.previewRotate(
        selectedImage.id,
        direction,
        sourceTempFilename
      );

      hideLoading();

      // Only save to operation history if in edit mode
      if (isEditMode) {
        const newOperation: Operation = {
          type: "rotate",
          data: { direction },
          tempFilename: response.data.tempFilename,
          previewUrl: response.data.previewUrl,
        };

        setOperationHistory((prev) => [...prev, newOperation]);
        setHasUnsavedChanges(true);
      }

      // Reset zoom, pan, and rotation BEFORE setting new preview
      // Rotation is reset to 0 because the image itself is rotated by the backend
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);

      // Pre-calculate expected size after rotation and set image constraints BEFORE loading new image
      if (imageElement) {
        const container =
          imageElement.closest(".image-viewer-content") ||
          imageElement.closest(".ant-layout-content") ||
          imageElement.parentElement?.parentElement;
        const containerRect = container?.getBoundingClientRect();

        if (
          containerRect &&
          containerRect.width > 0 &&
          containerRect.height > 0
        ) {
          // Calculate expected dimensions after rotation (swap width/height)
          const expectedWidth = imageNaturalSize.height;
          const expectedHeight = imageNaturalSize.width;
          const expectedAspect = expectedWidth / expectedHeight;
          const containerAspect = containerRect.width / containerRect.height;

          let displayWidth: number;
          let displayHeight: number;

          if (expectedAspect > containerAspect) {
            displayWidth = containerRect.width;
            displayHeight = containerRect.width / expectedAspect;
          } else {
            displayHeight = containerRect.height;
            displayWidth = containerRect.height * expectedAspect;
          }

          // Set image size IMMEDIATELY before changing src
          // Use !important to ensure these styles are not overridden
          imageElement.style.setProperty(
            "width",
            `${displayWidth}px`,
            "important"
          );
          imageElement.style.setProperty(
            "height",
            `${displayHeight}px`,
            "important"
          );
          imageElement.style.setProperty("max-width", "100%", "important");
          imageElement.style.setProperty("max-height", "100%", "important");
          imageElement.style.setProperty("object-fit", "contain", "important");
          imageElement.style.setProperty("display", "block", "important");

          // Also force container to maintain its size
          const containerElement = container as HTMLElement;
          if (containerElement) {
            containerElement.style.setProperty(
              "height",
              `${containerRect.height}px`,
              "important"
            );
            containerElement.style.setProperty(
              "max-height",
              `${containerRect.height}px`,
              "important"
            );
            containerElement.style.setProperty(
              "overflow",
              "hidden",
              "important"
            );
            containerElement.style.setProperty("flex-shrink", "0", "important");
          }
        }
      }

      setCurrentPreview({
        url: `http://localhost:3000${response.data.previewUrl}`,
        tempFilename: response.data.tempFilename,
      });
      // Only set hasUnsavedChanges in edit mode
      if (isEditMode) {
        setHasUnsavedChanges(true);
      }
    } catch (error: any) {
      const errorDetails =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      message.error(`Failed to preview rotate: ${errorDetails}`);
    }
  };

  // Save all operations
  const handleSaveAll = async (saveAsCopy: boolean) => {
    if (!selectedImage || !currentPreview || operationHistory.length === 0)
      return;

    try {
      const hideLoading = message.loading(
        saveAsCopy ? "Saving as new copy..." : "Applying to original...",
        0
      );

      await imageAPI.saveOperations(selectedImage.id, {
        tempFilename: currentPreview.tempFilename,
        operations: operationHistory,
        saveAsCopy,
      });

      hideLoading();
      message.success(
        saveAsCopy
          ? "All operations saved as new copy!"
          : "All operations applied to original image!"
      );

      setCurrentPreview(null);
      setOperationHistory([]);
      setHasUnsavedChanges(false);
      dispatch(fetchImages({ page: 1, limit: 50 }));
      dispatch(setSidebarTab("gallery"));
    } catch (error: any) {
      const errorDetails =
        error.response?.data?.details ||
        error.response?.data?.error ||
        error.message ||
        "Unknown error";
      message.error(`Failed to save operations: ${errorDetails}`);
    }
  };

  // Undo last operation
  const handleUndo = () => {
    if (isEditMode) {
      // In edit mode: undo from operation history
      if (operationHistory.length === 0) return;

      const newHistory = operationHistory.slice(0, -1);
      setOperationHistory(newHistory);

      if (newHistory.length === 0) {
        setCurrentPreview(null);
        setHasUnsavedChanges(false);
      } else {
        const lastOp = newHistory[newHistory.length - 1];
        setCurrentPreview({
          url: `http://localhost:3000${lastOp.previewUrl}`,
          tempFilename: lastOp.tempFilename,
        });
      }
    } else {
      // In view mode: just clear the preview
      setCurrentPreview(null);
    }
  };

  // Filter menu items
  const filterMenuItems: MenuProps["items"] = [
    {
      key: "sharpen",
      label: "Sharpen",
      onClick: () => handlePreviewFilter("sharpen"),
    },
    { key: "blur", label: "Blur", onClick: () => handlePreviewFilter("blur") },
    {
      key: "greyscale",
      label: "Greyscale",
      onClick: () => handlePreviewFilter("greyscale"),
    },
    {
      key: "negate",
      label: "Negate (Invert)",
      onClick: () => handlePreviewFilter("negate"),
    },
    {
      key: "normalize",
      label: "Normalize",
      onClick: () => handlePreviewFilter("normalize"),
    },
  ];

    // Helper to format file size
    const formatSize = (sizeStr: string) => {
        const size = parseInt(sizeStr);
    if (isNaN(size)) return "Unknown";
    return (size / 1024 / 1024).toFixed(2) + " MB";
    };

    return (
    <Layout
      style={{
        height: "100%",
        maxHeight: "100%",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
            {/* Toolbar */}
      <div
        style={{
          padding: "12px 24px",
                background: token.colorBgContainer,
                borderBottom: `1px solid ${token.colorBorder}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
                <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
                        Back
                    </Button>
                    <Divider type="vertical" />
          {isEditMode && (
            <>
                    <Tooltip title="Save As">
                <Button icon={<SaveOutlined />} onClick={handleSaveAs}>
                  Save As
                </Button>
                    </Tooltip>
                    <Tooltip title="Save to Default Path">
                <Button
                  icon={<CloudDownloadOutlined />}
                  onClick={handleSaveToDefault}
                >
                  Save
                </Button>
                    </Tooltip>
              <Divider type="vertical" />
            </>
          )}
                    <Tooltip title="Rename">
            <Button icon={<EditOutlined />} onClick={handleRename}>
              Rename
            </Button>
                    </Tooltip>
                    <Divider type="vertical" />
                    <Tooltip title="Zoom In">
                        <Button icon={<ZoomInOutlined />} onClick={handleZoomIn} />
                    </Tooltip>
                    <Tooltip title="Zoom Out">
                        <Button icon={<ZoomOutOutlined />} onClick={handleZoomOut} />
                    </Tooltip>
          <Text style={{ minWidth: 60, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </Text>
                    <Divider type="vertical" />
                    <Tooltip title="Rotate Left">
            <Button
              icon={<RotateLeftOutlined />}
              onClick={handleRotateLeft}
              disabled={selectedImage.isCorrupted}
            />
                    </Tooltip>
                    <Tooltip title="Rotate Right">
            <Button
              icon={<RotateRightOutlined />}
              onClick={handleRotateRight}
              disabled={selectedImage.isCorrupted}
            />
                    </Tooltip>
          {isEditMode && (
            <>
                    <Divider type="vertical" />
                    <Tooltip title="Reset View">
                <Button icon={<ClearOutlined />} onClick={handleReset} />
                    </Tooltip>
              <Divider type="vertical" />
              <Tooltip
                title={
                  isSelectionMode ? "Exit Selection Mode" : "Area Selection"
                }
              >
                <Button
                  type={isSelectionMode ? "primary" : "default"}
                  icon={<BorderOutlined />}
                  onClick={toggleSelectionMode}
                  disabled={selectedImage.isCorrupted}
                />
              </Tooltip>
              {isSelectionMode &&
                selection &&
                selection.width > 0 &&
                selection.height > 0 && (
                  <>
                    <Divider type="vertical" />
                    <Tooltip title="Crop">
                      <Button
                        type="primary"
                        icon={<ScissorOutlined />}
                        onClick={handlePreviewCrop}
                      >
                        Crop
                      </Button>
                    </Tooltip>
                  </>
                )}
              <Divider type="vertical" />
              <Dropdown menu={{ items: filterMenuItems }} trigger={["click"]}>
                <Button
                  icon={<FilterOutlined />}
                  disabled={selectedImage.isCorrupted}
                >
                  Filters <DownOutlined />
                </Button>
              </Dropdown>
              <Divider type="vertical" />
              <Tooltip title="Add Watermark (WASM)">
                <Button
                  icon={<FileTextOutlined />}
                  onClick={() => setIsWatermarkModalVisible(true)}
                  disabled={selectedImage.isCorrupted}
                >
                  Watermark
                </Button>
              </Tooltip>
              {operationHistory.length > 0 && (
                <>
                  <Divider type="vertical" />
                  <Tooltip title="Undo Last Operation">
                    <Button
                      icon={<UndoOutlined />}
                      onClick={handleUndo}
                      disabled={operationHistory.length === 0}
                    />
                  </Tooltip>
                </>
              )}
              {hasUnsavedChanges && (
                <>
                  <Divider type="vertical" />
                  <Button
                    type="primary"
                    onClick={() => handleSaveAll(true)}
                    style={{ background: token.colorSuccess }}
                  >
                    Save as Copy
                  </Button>
                  <Button type="primary" onClick={() => handleSaveAll(false)}>
                    Apply to Original
                  </Button>
                </>
              )}
            </>
          )}
                </Space>
                <Space>
          <Tooltip title={isEditMode ? "Exit Edit Mode" : "Enter Edit Mode"}>
            <Button
              type={isEditMode ? "primary" : "default"}
              icon={<EditOutlined />}
              onClick={() => {
                setIsEditMode(!isEditMode);
                if (!isEditMode) {
                  // Entering edit mode - clear any preview from view mode
                  setCurrentPreview(null);
                  setOperationHistory([]);
                  setHasUnsavedChanges(false);
                }
              }}
            >
              {isEditMode ? "Exit Edit" : "Edit"}
            </Button>
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title={hasExifData ? "Edit EXIF" : "This image has no EXIF data"}>
            <Button
              icon={<EditOutlined />}
              onClick={() => setIsExifEditorVisible(true)}
              disabled={!hasExifData}
            >
              EXIF
            </Button>
          </Tooltip>
                    <Tooltip title="Delete Image">
                        <Button danger icon={<DeleteOutlined />} onClick={handleDelete} />
                    </Tooltip>
                    <Divider type="vertical" />
                    <Button
            type={showInfo ? "primary" : "default"}
                        icon={<InfoCircleOutlined />}
                        onClick={() => setShowInfo(!showInfo)}
                    />
                </Space>
            </div>

      {/* Corrupted Image Warning */}
      {selectedImage.isCorrupted && (
        <div style={{ padding: "12px 24px", background: token.colorWarningBg }}>
          <Alert
            message="Corrupted Image"
            description={`The image "${selectedImage.originalName}" is corrupted and cannot be fully displayed or processed. Some features (filters, cropping) are disabled.`}
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            closable
          />
        </div>
      )}

      <Layout
        style={{
          background: "transparent",
          overflow: "hidden",
          flex: 1,
          minHeight: 0,
          height: 0, // Force flex to work properly
        }}
      >
        <Content
          className="image-viewer-content"
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            cursor: isDragging ? "grabbing" : "grab",
            background: "#1f1f1f",
            userSelect: "none", // Prevent text/image selection
            WebkitUserSelect: "none", // Safari
            MozUserSelect: "none", // Firefox
            msUserSelect: "none", // IE/Edge
            width: "100%",
            height: "100%",
            maxWidth: "100%",
            maxHeight: "100%",
            minHeight: 0,
            minWidth: 0,
            flex: 1,
                }}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={handleContextMenu}
                    onDoubleClick={(e) => e.preventDefault()} // Disable double-click
                >
          <div
            style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transition: isDragging ? "none" : "transform 0.3s ease-out",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transformOrigin: "center",
            }}
            onMouseDown={isSelectionMode ? handleMouseDownOnImage : undefined}
            onMouseMove={isSelectionMode ? handleMouseMoveOnImage : undefined}
            onMouseUp={isSelectionMode ? handleMouseUpOnImage : undefined}
          >
                        <img
              ref={(img) => img && setImageElement(img)}
              src={
                currentPreview
                  ? currentPreview.url
                  : `http://localhost:3000/api/images/${selectedImage.id}/file`
              }
                            alt={selectedImage.filename}
              onLoad={handleImageLoad}
                            style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                boxShadow: "0 0 20px rgba(0,0,0,0.5)",
                pointerEvents: isSelectionMode ? "auto" : "none",
                cursor: isSelectionMode ? "crosshair" : "default",
                            }}
                        />
            {isSelectionMode &&
              selection &&
              selection.width > 0 &&
              selection.height > 0 &&
              imageElement && (
                <div
                  style={{
                    position: "absolute",
                    border: "2px dashed #1890ff",
                    background: "rgba(24, 144, 255, 0.1)",
                    pointerEvents: "none",
                    left: `${
                      (selection.x / imageNaturalSize.width) *
                      imageElement.offsetWidth
                    }px`,
                    top: `${
                      (selection.y / imageNaturalSize.height) *
                      imageElement.offsetHeight
                    }px`,
                    width: `${
                      (selection.width / imageNaturalSize.width) *
                      imageElement.offsetWidth
                    }px`,
                    height: `${
                      (selection.height / imageNaturalSize.height) *
                      imageElement.offsetHeight
                    }px`,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: -20,
                      left: 0,
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      padding: "2px 6px",
                      fontSize: 12,
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {Math.round(selection.width)} ×{" "}
                    {Math.round(selection.height)}
                  </div>
                </div>
              )}
                    </div>
                </Content>

                {showInfo && (
                    <Sider
                        width={300}
                        style={{
                            background: token.colorBgContainer,
                            borderLeft: `1px solid ${token.colorBorder}`,
                            padding: 24,
              overflowY: "auto",
              overflowX: "hidden",
              zIndex: 10,
              height: "100%",
              maxHeight: "100%",
              flexShrink: 0,
                        }}
                    >
                        <Title level={5}>Image Details</Title>
            <Space direction="vertical" style={{ width: "100%" }} size="large">
                            <div>
                                <Text type="secondary">Original Name</Text>
                <div style={{ wordBreak: "break-all", fontWeight: 500 }}>
                  {selectedImage.originalName}
                </div>
                            </div>
                            <div>
                                <Text type="secondary">Filename</Text>
                <div style={{ wordBreak: "break-all" }}>
                  {selectedImage.filename}
                </div>
                            </div>
                            <div>
                                <Text type="secondary">Format</Text>
                                <div>{selectedImage.format.toUpperCase()}</div>
                            </div>
                            <div>
                                <Text type="secondary">Size</Text>
                                <div>{formatSize(selectedImage.fileSize)}</div>
                            </div>
                            <div>
                                <Text type="secondary">Dimensions</Text>
                <div>
                  {selectedImage.width} x {selectedImage.height}
                </div>
                            </div>
                            <div>
                                <Text type="secondary">Created At</Text>
                                <div>{new Date(selectedImage.createdAt).toLocaleString()}</div>
                            </div>
                            <div>
                                <Text type="secondary">Sync Status</Text>
                                <div>
                                    {selectedImage.synced ? (
                                        <Text type="success">Synced</Text>
                                    ) : (
                                        <Text type="warning">Not Synced</Text>
                                    )}
                                </div>
                            </div>
                        </Space>
                    </Sider>
                )}
            </Layout>

            <Modal
                title="Rename Image"
                open={isRenameModalVisible}
                onOk={submitRename}
                onCancel={() => setIsRenameModalVisible(false)}
            >
                <div>
                <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter new name (without extension)"
                    autoFocus
                />
                    <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                        Extension ({selectedImage.originalName.split('.').pop()}) will be preserved automatically
                    </div>
                </div>
            </Modal>

      <ExifEditor
        image={selectedImage}
        visible={isExifEditorVisible}
        onClose={() => setIsExifEditorVisible(false)}
        onUpdate={() => {
          dispatch(fetchImages({ page: 1, limit: 50 }));
        }}
      />

      <WatermarkModal
        visible={isWatermarkModalVisible}
        onCancel={() => setIsWatermarkModalVisible(false)}
        onOk={handleWatermarkPreview}
        loading={isWatermarkProcessing}
      />
    </Layout>
    );
};

export default SingleImageViewer;
