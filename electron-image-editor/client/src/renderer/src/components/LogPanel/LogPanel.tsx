import React, { useEffect, useState } from 'react';
import { Card, List, Tag, Typography, theme, Empty, Row, Col, Statistic, Button, Space, Collapse } from 'antd';
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
    UploadOutlined,
    DownloadOutlined,
    DeleteOutlined,
    EditOutlined,
    ScissorOutlined,
    FileImageOutlined,
    DatabaseOutlined,
    WarningOutlined,
    CloseOutlined,
    LoadingOutlined,
    FolderOutlined
} from '@ant-design/icons';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { fetchImageById, setSelectedImage } from '../../store/slices/imagesSlice';
import { setSidebarTab } from '../../store/slices/uiSlice';
import { uploadAPI } from '../../api/client';

const { Text } = Typography;
const { useToken } = theme;

interface UploadBatch {
    id: number;
    batchId: string;
    totalFiles: number;
    totalSize: bigint | string;
    successCount: number;
    failedCount: number;
    corruptedCount: number;
    folderId: number | null;
    folder: { id: number; name: string } | null;
    timestamp: string;
    uploadMethod?: string; // "single", "batch", "json"
    files: Array<{
        id: number;
        filename: string;
        originalName: string;
        fileSize: bigint | string;
        status: string;
        isCorrupted: boolean;
        error: string | null;
        image: { id: number; originalName: string; filename: string } | null;
    }>;
}

const LogPanel: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const [batches, setBatches] = useState<UploadBatch[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBatches();
        // Auto-refresh every 5 seconds
        const interval = setInterval(() => {
            fetchBatches();
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchBatches = async () => {
        try {
            setLoading(true);
            const response = await uploadAPI.getBatches({ page: 1, limit: 20 });
            setBatches(response.data.batches || []);
        } catch (error) {
            console.error('Failed to fetch batches:', error);
        } finally {
            setLoading(false);
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
        if (details.strategy) parts.push(`Strategy: ${details.strategy}`);
        if (details.conflictsResolved !== undefined) parts.push(`Conflicts: ${details.conflictsResolved}`);
        if (details.cropArea) {
            const { x, y, width, height } = details.cropArea;
            parts.push(`Crop: ${width}x${height} @ (${x},${y})`);
        }
        
        return parts.join(' | ') || JSON.stringify(details);
    };

    const formatSize = (bytes: number | bigint | string) => {
        const numBytes = typeof bytes === 'string' ? parseInt(bytes) : Number(bytes);
        if (numBytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(numBytes) / Math.log(k));
        return Math.round((numBytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getUploadMethodTag = (method?: string) => {
        switch (method) {
            case 'single':
                return <Tag color="blue" style={{ fontSize: 10 }}>Single</Tag>;
            case 'batch':
                return <Tag color="green" style={{ fontSize: 10 }}>Batch</Tag>;
            case 'json':
                return <Tag color="purple" style={{ fontSize: 10 }}>JSON</Tag>;
            default:
                return <Tag color="default" style={{ fontSize: 10 }}>Batch</Tag>;
        }
    };

    const handleFileClick = async (imageId: number) => {
        try {
            const fullImage = await dispatch(fetchImageById(imageId)).unwrap();
            dispatch(setSelectedImage(fullImage));
            dispatch(setSidebarTab('single'));
        } catch (error) {
            console.error('Failed to fetch image:', error);
        }
    };

    return (
        <Card
            title="Activity Log"
            size="small"
            style={{
                height: '100%',
                background: token.colorBgContainer,
                borderTop: `1px solid ${token.colorBorder}`,
            }}
            bodyStyle={{ padding: 12, height: 'calc(100% - 57px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
            {/* Upload Batches - scrollable, displayed at top */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginBottom: 12 }}>
                {batches.length === 0 && !loading ? (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No upload batches"
                        style={{ margin: '20px 0' }}
                    />
                ) : (
                    <Collapse
                        size="small"
                        ghost
                        items={batches.map((batch) => {
                            const totalSize = typeof batch.totalSize === 'string' ? parseInt(batch.totalSize) : Number(batch.totalSize);

                            return {
                                key: batch.batchId,
                                label: (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '4px 0' }}>
                                        <UploadOutlined style={{ color: token.colorSuccess }} />
                                        <Text strong style={{ fontSize: 13 }}>
                                            Upload
                                        </Text>
                                        {getUploadMethodTag(batch.uploadMethod)}
                                        <Tag color="success" style={{ fontSize: 10 }}>
                                            SUCCESS
                                        </Tag>
                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                            {batch.totalFiles} file{batch.totalFiles !== 1 ? 's' : ''}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 10, marginLeft: 'auto' }}>
                                            {new Date(batch.timestamp).toLocaleString()}
                                        </Text>
                                    </div>
                                ),
                                children: (
                                    <div style={{ padding: '8px 0', paddingLeft: 24 }}>
                                        {batch.files && batch.files.length > 0 && (
                                            <List
                                                size="small"
                                                dataSource={batch.files}
                                                renderItem={(file) => {
                                                    const getFileStatusIcon = () => {
                                                        switch (file.status) {
                                                            case 'success':
                                                                return file.isCorrupted ? (
                                                                    <WarningOutlined style={{ color: token.colorWarning }} />
                                                                ) : (
                                                                    <UploadOutlined style={{ color: token.colorSuccess }} />
                                                                );
                                                            case 'error':
                                                                return <CloseCircleOutlined style={{ color: token.colorError }} />;
                                                            default:
                                                                return <FileImageOutlined style={{ color: token.colorTextSecondary }} />;
                                                        }
                                                    };

                                                    const isClickable = file.status === 'success' && file.image && !file.isCorrupted;
                                                    const fileStatus = file.status === 'success' ? 'success' : 'error';

                                                    return (
                                                        <List.Item
                                                            style={{
                                                                padding: '8px 12px',
                                                                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                                                cursor: isClickable ? 'pointer' : 'default',
                                                            }}
                                                            onClick={() => {
                                                                if (isClickable && file.image) {
                                                                    handleFileClick(file.image.id);
                                                                }
                                                            }}
                                                        >
                                                            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                <div style={{ fontSize: 16 }}>
                                                                    {getFileStatusIcon()}
                                                                </div>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                                        <Text strong style={{ textTransform: 'capitalize', fontSize: 12 }}>
                                                                            Upload
                                                                        </Text>
                                                                        {getStatusTag(fileStatus)}
                                                                        <Text 
                                                                            ellipsis 
                                                                            style={{ 
                                                                                maxWidth: 200,
                                                                                fontSize: 12,
                                                                                color: isClickable ? token.colorPrimary : token.colorTextBase,
                                                                            }}
                                                                        >
                                                                            {file.originalName}
                                                                        </Text>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                                                            {new Date(file.timestamp).toLocaleString()}
                                                                        </Text>
                                                                        <Text type="secondary" style={{ fontSize: 11 }}>
                                                                            File: {file.originalName}
                                                                        </Text>
                                                                        {file.isCorrupted && (
                                                                            <Tag color="warning" style={{ fontSize: 9 }}>
                                                                                Corrupted
                                                                            </Tag>
                                                                        )}
                                                                        {file.error && (
                                                                            <Text type="danger" style={{ fontSize: 11 }}>
                                                                                Error: {file.error}
                                                                            </Text>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </List.Item>
                                                    );
                                                }}
                                            />
                                        )}
                                    </div>
                                ),
                            };
                        })}
                        style={{ background: 'transparent' }}
                    />
                )}
            </div>

        </Card>
    );
};

export default LogPanel;
