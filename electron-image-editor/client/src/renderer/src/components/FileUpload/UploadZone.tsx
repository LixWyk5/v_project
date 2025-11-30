import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudUploadOutlined } from '@ant-design/icons';
import { Typography, theme } from 'antd';

const { Title, Text } = Typography;
const { useToken } = theme;

interface UploadZoneProps {
    onDrop: (files: File[]) => void;
    disabled?: boolean;
    compact?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onDrop, disabled, compact = false }) => {
    const { token } = useToken();

    const onDropCallback = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles?.length > 0) {
            onDrop(acceptedFiles);
        }
    }, [onDrop]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: onDropCallback,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.tif', '.tiff']
        },
        disabled
    });

    return (
        <div
            {...getRootProps()}
            style={{
                border: `2px dashed ${isDragActive ? token.colorPrimary : token.colorBorder}`,
                borderRadius: token.borderRadiusLG,
                padding: compact ? '20px 16px' : '48px 24px',
                textAlign: 'center',
                background: isDragActive ? token.colorFillAlter : token.colorBgContainer,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <input {...getInputProps()} />
            <CloudUploadOutlined
                style={{
                    fontSize: compact ? 32 : 64,
                    color: isDragActive ? token.colorPrimary : token.colorTextSecondary,
                    marginBottom: compact ? 12 : 24
                }}
            />
            <Title 
                level={compact ? 5 : 4} 
                style={{ 
                    color: token.colorTextBase, 
                    marginBottom: compact ? 4 : 8,
                    fontSize: compact ? 13 : undefined
                }}
            >
                {isDragActive ? 'Drop images here' : 'Drag & Drop images here'}
            </Title>
            <Text type="secondary" style={{ fontSize: compact ? 11 : undefined }}>
                Supports JPG, PNG, TIFF. Max size 50MB.
            </Text>
        </div>
    );
};

export default UploadZone;
