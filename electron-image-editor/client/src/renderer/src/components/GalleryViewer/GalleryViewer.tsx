import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Input, Select, Space, Button, Pagination, theme, App, Modal, Divider, Grid, List, Tag, Tabs, Empty, Collapse, Typography, Checkbox } from 'antd';
import {
    ReloadOutlined,
    FilterOutlined,
    FolderOpenOutlined,
    WarningOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    UploadOutlined,
    DownloadOutlined,
    DeleteOutlined,
    EditOutlined,
    ScissorOutlined,
    FileImageOutlined,
    SyncOutlined,
    FileTextOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchImages, setSelectedImage, deleteImage, toggleSelection, selectAll, clearSelection, fetchImageById } from '../../store/slices/imagesSlice';
import { moveImageToFolder, createFolder } from '../../store/slices/foldersSlice';
import { setSidebarTab } from '../../store/slices/uiSlice';
import { fetchSyncLogs } from '../../store/slices/syncSlice';
import { uploadAPI } from '../../api/client';
import ImageGrid from './ImageGrid';

const { Search } = Input;
const { Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const GalleryViewer: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const { items, loading, pagination, selectedIds } = useAppSelector((state) => state.images);
    const { currentFolderId, items: folders } = useAppSelector((state) => state.folders);
    const { logs } = useAppSelector((state) => state.sync);
    const { message } = App.useApp();
    const screens = useBreakpoint();

    const [batches, setBatches] = useState<any[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [formatFilter, setFormatFilter] = useState<string | undefined>(undefined);
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined); // 'all', 'normal', 'corrupted'
    const [exifFilter, setExifFilter] = useState<boolean>(false); // Filter images with EXIF data
    const [isMoveModalVisible, setIsMoveModalVisible] = useState(false);
    const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [singleImageToMove, setSingleImageToMove] = useState<number | null>(null); // For single image move from context menu
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate images per row based on current breakpoint
    // Col settings: xs={24} sm={12} md={8} lg={6} xl={4}
    const imagesPerRow = useMemo(() => {
        if (screens.xl) return 6; // xl={4} -> 24/4 = 6
        if (screens.lg) return 4; // lg={6} -> 24/6 = 4
        if (screens.md) return 3; // md={8} -> 24/8 = 3
        if (screens.sm) return 2; // sm={12} -> 24/12 = 2
        return 1; // xs={24} -> 24/24 = 1
    }, [screens]);

    // Calculate optimal limit that ensures full rows
    // Round up to nearest multiple of imagesPerRow
    const optimalLimit = useMemo(() => {
        const desiredRows = 2; // Target 2 rows
        const baseLimit = imagesPerRow * desiredRows;
        // Ensure it's a multiple of imagesPerRow
        return Math.ceil(baseLimit / imagesPerRow) * imagesPerRow;
    }, [imagesPerRow]);

    // Reload when folder changes or when optimal limit changes
    useEffect(() => {
        loadImages(1, optimalLimit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentFolderId, optimalLimit]);

    // Fetch logs and batches
    useEffect(() => {
        dispatch(fetchSyncLogs(50));
        fetchBatches();
        const interval = setInterval(() => {
            dispatch(fetchSyncLogs(50));
            fetchBatches();
        }, 5000);
        return () => clearInterval(interval);
    }, [dispatch]);

    const fetchBatches = async () => {
        try {
            setLogsLoading(true);
            const response = await uploadAPI.getBatches({ page: 1, limit: 10 });
            setBatches(response.data.batches || []);
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        } finally {
            setLogsLoading(false);
        }
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // ... (existing functions)

    const handleCreateAndSelectFolder = async () => {
        if (!newFolderName.trim()) return;
        try {



            const resultAction = await dispatch(createFolder({ name: newFolderName }));
            if (createFolder.fulfilled.match(resultAction)) {
                message.success('Folder created');
                setTargetFolderId(resultAction.payload.id);
                setNewFolderName('');


            } else {
                message.error('Failed to create folder');
            }
        } catch (error: any) {
            message.error(error.message || 'Failed to create folder');
        }
    };

    const loadImages = (page: number, customLimit?: number) => {
        // Always use optimal limit (2 rows) - force 2 rows per page
        const limit = optimalLimit || imagesPerRow * 2;
        const params: any = {
            page,
            limit,
            search: searchText,
            format: formatFilter,
            folderId: currentFolderId,
            status: statusFilter,
            hasExif: exifFilter || undefined
        };

        dispatch(fetchImages(params));
    };

    const handleSearch = (value: string) => {
        setSearchText(value);
        dispatch(fetchImages({
            page: 1,
            limit: optimalLimit || imagesPerRow * 2,
            search: value,
            format: formatFilter,
            folderId: currentFolderId,
            status: statusFilter,
            hasExif: exifFilter || undefined
        }));
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setSearchText(value);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout for debounced search
        searchTimeoutRef.current = setTimeout(() => {
            dispatch(fetchImages({
                page: 1,
                limit: optimalLimit || imagesPerRow * 2,
                search: value,
                format: formatFilter,
                folderId: currentFolderId,
                status: statusFilter,
                hasExif: exifFilter || undefined
            }));
        }, 300); // 300ms debounce delay
    };

    const handleFormatChange = (value: string) => {
        console.log('[GalleryViewer] Format filter changed:', value);
        console.log('[GalleryViewer] Current statusFilter:', statusFilter);
        setFormatFilter(value);
        dispatch(fetchImages({
            page: 1,
            limit: optimalLimit || imagesPerRow * 2,
            search: searchText,
            format: value,
            folderId: currentFolderId,
            status: statusFilter,
            hasExif: exifFilter || undefined
        }));
    };

    const handleStatusChange = (value: string | undefined) => {
        setStatusFilter(value);
        dispatch(fetchImages({
            page: 1,
            limit: optimalLimit || imagesPerRow * 2,
            search: searchText,
            format: formatFilter,
            folderId: currentFolderId,
            status: value,
            hasExif: exifFilter || undefined
        }));
    };

    const handleClearAllFilters = () => {
        setSearchText('');
        setFormatFilter(undefined);
        setStatusFilter(undefined);
        setExifFilter(false);
        dispatch(fetchImages({
            page: 1,
            limit: optimalLimit || imagesPerRow * 2,
            search: '',
            format: undefined,
            folderId: currentFolderId,
            status: undefined,
            hasExif: undefined
        }));
    };


    const handleRefresh = () => {
        loadImages(pagination.page);
    };

    const handleSelect = (id: number) => {
        dispatch(toggleSelection(id));
    };

    const handleSelectAll = () => {
        dispatch(selectAll());
    };

    const handleClearSelection = () => {
        dispatch(clearSelection());
    };

    const handleView = (id: number) => {
        const image = items.find(i => i.id === id);
        if (image) {
            dispatch(setSelectedImage(image));
            dispatch(setSidebarTab('single'));
        }
    };

    const handleDelete = (id: number) => {
        dispatch(deleteImage(id));
    };

    const handleMoveToFolder = (id: number) => {
        // Store the single image to move without affecting current selection
        setSingleImageToMove(id);
        setIsMoveModalVisible(true);
    };


    const handleDownloadSelected = async () => {
        if (selectedIds.length === 0) return;

        try {
            const result = await (window as any).api.openDirectory();
            if (result.canceled || !result.filePaths || result.filePaths.length === 0) return;

            const destinationFolder = result.filePaths[0];
            let successCount = 0;
            let failCount = 0;

            const hideLoading = message.loading('Downloading images...', 0);

            for (const id of selectedIds) {
                const image = items.find(i => i.id === id);
                if (!image) continue;

                try {
                    const response = await fetch(`http://localhost:3000/api/images/${image.id}/file`);
                    if (!response.ok) throw new Error('Network response was not ok');

                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const buffer = new Uint8Array(arrayBuffer);

                    // Use original name or filename, ensure extension
                    const fileName = image.originalName || image.filename;
                    const filePath = `${destinationFolder}\\${fileName}`;

                    const writeResult = await (window as any).api.writeFile(filePath, buffer);
                    if (writeResult && writeResult.success === false) {
                        throw new Error(writeResult.error);
                    }
                    successCount++;
                } catch (error) {

                    failCount++;
                }
            }

            hideLoading();
            if (successCount > 0) {
                message.success(`Successfully downloaded ${successCount} images`);
            }
            if (failCount > 0) {
                message.error(`Failed to download ${failCount} images`);
            }
        } catch (error: any) {
            message.error(`Download failed: ${error.message}`);
        }
    };

    const getActionIcon = (action: string) => {
        switch (action.toLowerCase()) {
            case 'upload':
                return <UploadOutlined style={{ color: token.colorSuccess }} />;
            case 'download':
            case 'sync':
                return <DownloadOutlined style={{ color: token.colorInfo }} />;
            case 'delete':
                return <DeleteOutlined style={{ color: token.colorError }} />;
            case 'update':
            case 'rename':
                return <EditOutlined style={{ color: token.colorWarning }} />;
            case 'crop':
                return <ScissorOutlined style={{ color: token.colorPrimary }} />;
            default:
                return <SyncOutlined style={{ color: token.colorTextSecondary }} />;
        }
    };

    const getStatusTag = (status: string) => {
        const isSuccess = status === 'success';
        return (
            <Tag
                icon={isSuccess ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                color={isSuccess ? 'success' : 'error'}
                style={{ fontSize: 10 }}
            >
                {status.toUpperCase()}
            </Tag>
        );
    };

    const formatLogDetails = (details: any) => {
        if (!details) return '';
        if (typeof details === 'string') return details;

        const parts: string[] = [];
        if (details.filename) parts.push(`File: ${details.filename}`);
        if (details.type) parts.push(`Type: ${details.type}`);
        if (details.imagesCount !== undefined) parts.push(`Images: ${details.imagesCount}`);
        if (details.folder) parts.push(`Folder: ${details.folder}`);
        if (details.error) parts.push(`Error: ${details.error}`);

        return parts.length > 0 ? parts.join(', ') : JSON.stringify(details);
    };

    const filteredLogs = logs.filter(log => {
        if (log.action === 'sync' && log.details) {
            const details = typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
            if (details.includes('Database initialized') || details.includes('initialized successfully')) {
                return false;
            }
        }
        return true;
    });

    const handleFileClick = async (imageId: number) => {
        try {
            const fullImage = await dispatch(fetchImageById(imageId)).unwrap();
            dispatch(setSelectedImage(fullImage));
            dispatch(setSidebarTab('single'));
        } catch (error) {
            console.error('Failed to fetch image:', error);
        }
    };

    const handleMoveSelected = async () => {
        // Determine which images to move
        const imagesToMove = singleImageToMove !== null ? [singleImageToMove] : selectedIds;




        if (imagesToMove.length === 0) return;

        const hideLoading = message.loading('Moving images...', 0);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const id of imagesToMove) {
                try {
                    await dispatch(moveImageToFolder({ imageId: id, folderId: targetFolderId })).unwrap();
                    successCount++;
                } catch (error) {

                    failCount++;
                }
            }

            hideLoading();
            if (successCount > 0) {
                message.success(`Successfully moved ${successCount} image${successCount > 1 ? 's' : ''}`);
                loadImages(pagination.page);
                dispatch(clearSelection());
                setIsMoveModalVisible(false);
                setTargetFolderId(null);
                setSingleImageToMove(null); // Reset single image state
            }
            if (failCount > 0) {
                message.error(`Failed to move ${failCount} image${failCount > 1 ? 's' : ''}`);
            }
        } catch (error: any) {
            hideLoading();
            message.error(`Move failed: ${error.message}`);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <div style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
                flexShrink: 0
            }}>
                <Space size="middle">
                    <Search
                        placeholder="Search images..."
                        value={searchText}
                        onChange={handleSearchChange}
                        onSearch={handleSearch}
                        style={{ width: 240 }}
                        allowClear
                    />
                    <Select
                        placeholder="Format"
                        style={{ width: 120 }}
                        allowClear
                        value={formatFilter}
                        onChange={handleFormatChange}
                        options={[
                            { value: 'jpg', label: 'JPG/JPEG' },
                            { value: 'png', label: 'PNG' },
                            { value: 'tif', label: 'TIF/TIFF' },
                        ]}
                        suffixIcon={<FilterOutlined />}
                    />
                    <Select
                        placeholder="Status"
                        style={{ width: 140 }}
                        allowClear
                        value={statusFilter}
                        onChange={handleStatusChange}
                        options={[
                            { value: 'normal', label: 'Normal' },
                            { value: 'corrupted', label: 'Corrupted' },
                        ]}
                        suffixIcon={<WarningOutlined />}
                    />
                    <Checkbox
                        checked={exifFilter}
                        onChange={(e) => {
                            const newExifFilter = e.target.checked;
                            console.log('[GalleryViewer] EXIF filter changed:', newExifFilter);
                            setExifFilter(newExifFilter);
                            dispatch(fetchImages({
                                page: 1,
                                limit: optimalLimit || imagesPerRow * 2,
                                search: searchText,
                                format: formatFilter,
                                folderId: currentFolderId,
                                status: statusFilter,
                                hasExif: newExifFilter ? true : undefined
                            }));
                        }}
                    >
                        Only show EXIF images
                    </Checkbox>
                    <Button
                        onClick={handleClearAllFilters}
                        disabled={!formatFilter && !statusFilter && !searchText && !exifFilter}
                    >
                        Clear All Filters
                    </Button>
                </Space>

                <Space>
                    {selectedIds.length > 0 && (
                        <>
                            <Button type="primary" onClick={handleDownloadSelected}>
                                Download Selected ({selectedIds.length})
                            </Button>
                            <Button icon={<FolderOpenOutlined />} onClick={() => {
                                setSingleImageToMove(null); // Clear single image mode
                                setIsMoveModalVisible(true);
                            }}>
                                Move to Folder
                            </Button>
                            <Button onClick={handleClearSelection}>
                                Clear Selection
                            </Button>
                        </>
                    )}
                    <Button onClick={handleSelectAll}>
                        Select All
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            </div>

            {/* Grid Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, minHeight: 0 }}>
                <ImageGrid
                    images={items}
                    loading={loading}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    onView={handleView}
                    onDelete={handleDelete}
                    onMoveToFolder={handleMoveToFolder}
                    isLastPage={pagination.page >= pagination.totalPages}
                />
            </div>

            {/* Pagination */}
            <div style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                paddingTop: 12,
                flexShrink: 0
            }}>
                <Pagination
                    current={pagination.page}
                    total={pagination.total}
                    pageSize={optimalLimit || imagesPerRow * 2}
                    onChange={(page) => loadImages(page)}
                    onShowSizeChange={(current, size) => {
                        // Force 2 rows: round to nearest multiple of imagesPerRow, then ensure it's exactly 2 rows
                        const roundedSize = Math.ceil(size / imagesPerRow) * imagesPerRow;
                        const twoRowsSize = imagesPerRow * 2;
                        // Always use 2 rows regardless of user selection
                        loadImages(1, twoRowsSize);
                    }}
                    showSizeChanger={false}
                    showTotal={(total) => `Total ${total} items`}
                    size="small"
                />
            </div>

            {/* Log Panel */}
            <div style={{
                marginTop: 16,
                maxHeight: 250,
                minHeight: 200,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                paddingTop: 12,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                <Tabs
                    size="small"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
                    items={[
                        {
                            key: 'upload',
                            label: 'Upload Log',
                            children: (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    {batches.length === 0 && !logsLoading ? (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description="No upload batches"
                                            style={{ margin: '10px 0' }}
                                            imageStyle={{ height: 40 }}
                                        />
                                    ) : (
                                        <Collapse
                                            size="small"
                                            ghost
                                            items={batches.slice(0, 5).map((batch) => {
                                                const totalSize = typeof batch.totalSize === 'string' ? parseInt(batch.totalSize) : Number(batch.totalSize);
                                                return {
                                                    key: batch.batchId,
                                                    label: (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                            <UploadOutlined style={{ color: token.colorSuccess, fontSize: 12 }} />
                                                            <Text strong style={{ fontSize: 11 }}>
                                                                Upload
                                                            </Text>
                                                            <Tag color="success" style={{ fontSize: 9 }}>
                                                                {batch.totalFiles} file{batch.totalFiles !== 1 ? 's' : ''}
                                                            </Tag>
                                                            <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>
                                                                {new Date(batch.timestamp).toLocaleString()}
                                                            </Text>
                                                        </div>
                                                    ),
                                                    children: (
                                                        <div style={{ padding: '4px 0', paddingLeft: 16 }}>
                                                            {batch.files && batch.files.slice(0, 3).map((file: any) => (
                                                                <div
                                                                    key={file.id}
                                                                    style={{
                                                                        padding: '4px 8px',
                                                                        fontSize: 10,
                                                                        cursor: file.status === 'success' && file.image && !file.isCorrupted ? 'pointer' : 'default',
                                                                        color: file.status === 'success' ? token.colorTextBase : token.colorError
                                                                    }}
                                                                    onClick={() => {
                                                                        if (file.status === 'success' && file.image && !file.isCorrupted) {
                                                                            handleFileClick(file.image.id);
                                                                        }
                                                                    }}
                                                                >
                                                                    {file.originalName}
                                                                    {file.isCorrupted && (
                                                                        <Tag color="warning" style={{ fontSize: 8, marginLeft: 4 }}>
                                                                            Corrupted
                                                                        </Tag>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            {batch.files && batch.files.length > 3 && (
                                                                <Text type="secondary" style={{ fontSize: 9, paddingLeft: 8 }}>
                                                                    +{batch.files.length - 3} more
                                                                </Text>
                                                            )}
                                                        </div>
                                                    ),
                                                };
                                            })}
                                            style={{ background: 'transparent' }}
                                        />
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'system',
                            label: 'System Activity',
                            children: (
                                <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                                    {filteredLogs.length === 0 ? (
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description="No system activity logs"
                                            style={{ margin: '10px 0' }}
                                            imageStyle={{ height: 40 }}
                                        />
                                    ) : (
                                        <List
                                            size="small"
                                            dataSource={filteredLogs.slice(0, 10)}
                                            renderItem={(log) => (
                                                <List.Item
                                                    style={{
                                                        padding: '4px 8px',
                                                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                    }}
                                                >
                                                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <div style={{ fontSize: 12 }}>
                                                            {getActionIcon(log.action)}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                                <Text strong style={{ fontSize: 10, textTransform: 'capitalize' }}>
                                                                    {log.action}
                                                                </Text>
                                                                {getStatusTag(log.status)}
                                                                {log.image && (
                                                                    <Text type="secondary" ellipsis style={{ maxWidth: 150, fontSize: 9 }}>
                                                                        {log.image.originalName}
                                                                    </Text>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <Text type="secondary" style={{ fontSize: 9 }}>
                                                                    {new Date(log.timestamp).toLocaleString()}
                                                                </Text>
                                                                {log.details && (
                                                                    <Text type="secondary" style={{ fontSize: 9 }} ellipsis>
                                                                        {formatLogDetails(log.details)}
                                                                    </Text>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </div>
                            ),
                        },
                    ]}
                />
            </div>

            {/* Move Modal */}
            <Modal
                title="Move Images to Folder"
                open={isMoveModalVisible}
                onOk={handleMoveSelected}
                onCancel={() => {
                    setIsMoveModalVisible(false);
                    setTargetFolderId(null);
                    setNewFolderName('');
                    setSingleImageToMove(null); // Reset single image state
                }}
                okText="Move"
            >
                <div style={{ marginBottom: 16 }}>
                    Select destination folder for {singleImageToMove !== null ? '1 image' : `${selectedIds.length} images`}:
                </div>
                <Select
                    style={{ width: '100%', marginBottom: 16 }}
                    placeholder="Select destination folder"
                    onChange={(val) => setTargetFolderId(val)}
                    value={targetFolderId}
                    options={folders.map(f => ({ value: f.id, label: f.name }))}
                />

                <Divider plain>Or Create New Folder</Divider>

                <Space.Compact style={{ width: '100%' }}>
                    <Input
                        placeholder="New Folder Name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                    />
                    <Button type="primary" onClick={handleCreateAndSelectFolder}>Create</Button>
                </Space.Compact>
            </Modal>
        </div>
    );
};

export default GalleryViewer;
