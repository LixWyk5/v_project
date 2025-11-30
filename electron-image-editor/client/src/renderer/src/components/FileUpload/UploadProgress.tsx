import React from 'react';
import { List, Progress, Typography, Button, Space, theme } from 'antd';
import {
    FileImageOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoadingOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { useToken } = theme;

export interface UploadFileItem {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    error?: string;
}

interface UploadProgressProps {
    files: UploadFileItem[];
    onClear: () => void;
}

const UploadProgress: React.FC<UploadProgressProps> = ({ files, onClear }) => {
    const { token } = useToken();

    if (files.length === 0) return null;

    const getStatusIcon = (status: UploadFileItem['status']) => {
        switch (status) {
            case 'uploading': return <LoadingOutlined style={{ color: token.colorPrimary }} />;
            case 'success': return <CheckCircleOutlined style={{ color: token.colorSuccess }} />;
            case 'error': return <CloseCircleOutlined style={{ color: token.colorError }} />;
            default: return <FileImageOutlined style={{ color: token.colorTextSecondary }} />;
        }
    };

    return (
        <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text strong>Upload Queue ({files.length})</Text>
                {files.length > 0 && (
                    <Button type="text" size="small" onClick={onClear}>
                        Clear All
                    </Button>
                )}
            </div>

            <List
                dataSource={files}
                renderItem={(item) => (
                    <List.Item
                        style={{
                            background: token.colorBgContainer,
                            marginBottom: 8,
                            borderRadius: token.borderRadius,
                            padding: '12px 16px',
                            border: `1px solid ${token.colorBorderSecondary}`
                        }}
                    >
                        <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                <Space>
                                    {getStatusIcon(item.status)}
                                    <Text ellipsis style={{ maxWidth: 300 }}>{item.file.name}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {(item.file.size / 1024 / 1024).toFixed(2)} MB
                                    </Text>
                                </Space>
                            </div>

                            {item.status === 'error' ? (
                                <Text type="danger" style={{ fontSize: 12 }}>{item.error}</Text>
                            ) : item.status === 'success' ? (
                                <Progress
                                    percent={item.progress}
                                    size="small"
                                    status="success"
                                    strokeColor={token.colorSuccess}
                                />
                            ) : (
                                <Progress
                                    percent={item.progress}
                                    size="small"
                                    status={item.status === 'pending' ? 'normal' : 'active'}
                                    strokeColor={token.colorPrimary}
                                />
                            )}
                        </div>
                    </List.Item>
                )}
            />
        </div>
    );
};

export default UploadProgress;
