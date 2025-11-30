import React, { useState } from 'react';
import { Card, Typography, Space, theme, Dropdown, MenuProps, Tooltip, App, Modal, Input, Divider, Alert } from 'antd';
import {
    FileImageOutlined,
    MoreOutlined,
    DeleteOutlined,
    EyeOutlined,
    CheckOutlined,
    EditOutlined,
    SaveOutlined,
    CloudDownloadOutlined,
    WarningOutlined,
    CloseCircleOutlined
} from '@ant-design/icons';
import { Image } from '../../types';
import { useAppDispatch } from '../../store/hooks';
import { renameImage } from '../../store/slices/imagesSlice';

const { Text } = Typography;
const { useToken } = theme;

interface ImageCardProps {
    image: Image;
    selected?: boolean;
    onSelect?: (id: number) => void;
    onView?: (id: number) => void;
    onDelete?: (id: number) => void;
    onDoubleClick?: (id: number) => void;
    onMoveToFolder?: (id: number) => void;
}

const ImageCard: React.FC<ImageCardProps> = ({
    image,
    selected,
    onSelect,
    onView,
    onDelete,
    onMoveToFolder
}) => {
    const { token } = useToken();
    const { message, modal } = App.useApp();
    const dispatch = useAppDispatch();

    // Rename state
    const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
    const [newName, setNewName] = useState('');

    const handleRename = () => {
        // Extract filename without extension
        const lastDotIndex = image.originalName.lastIndexOf('.');
        const nameWithoutExt = lastDotIndex > 0 ? image.originalName.substring(0, lastDotIndex) : image.originalName;
        setNewName(nameWithoutExt);
        setIsRenameModalVisible(true);
    };

    const submitRename = async () => {
        if (!newName.trim()) return;

        // Get the original extension
        const lastDotIndex = image.originalName.lastIndexOf('.');
        const extension = lastDotIndex > 0 ? image.originalName.substring(lastDotIndex) : '';

        // Remove any extension the user might have typed
        let nameWithoutExt = newName.trim();
        const userLastDotIndex = nameWithoutExt.lastIndexOf('.');
        if (userLastDotIndex > 0) {
            // User typed an extension, remove it
            nameWithoutExt = nameWithoutExt.substring(0, userLastDotIndex);
        }

        // Combine new name with original extension
        const fullName = nameWithoutExt + extension;

        try {
            await dispatch(renameImage({ id: image.id, name: fullName })).unwrap();
            message.success('Image renamed successfully');
            setIsRenameModalVisible(false);
        } catch (error: any) {
            message.error(`Failed to rename image: ${error.message}`);
        }
    };

    const handleDelete = () => {
        modal.confirm({
            title: 'Delete Image',
            content: `Are you sure you want to delete ${image.originalName}?`,
            okText: 'Delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: () => onDelete?.(image.id),
        });
    };

    const handleViewOrDoubleClick = (isDoubleClick: boolean) => {
        if (image.isCorrupted) {
            // Show personalized alert for corrupted images
            modal.warning({
                title: (
                    <Space>
                        <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                        <span>Corrupted Image</span>
                    </Space>
                ),
                width: 500,
                content: (
                    <div style={{ marginTop: 16 }}>
                        <Alert
                            message="This image file is corrupted"
                            description={
                                <div style={{ marginTop: 12 }}>
                                    <p style={{ marginBottom: 8 }}>
                                        <strong>{image.originalName}</strong> cannot be opened because the file is corrupted or damaged.
                                    </p>
                                    <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                                        <li>The image file may be incomplete or damaged</li>
                                        <li>Image processing operations (filters, cropping, etc.) are not available</li>
                                        <li>You can still delete or move this image to organize your library</li>
                                    </ul>
                                </div>
                            }
                            type="warning"
                            icon={<WarningOutlined />}
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                            <p style={{ margin: 0 }}>File: {image.originalName}</p>
                            <p style={{ margin: '4px 0 0 0' }}>Size: {(parseInt(image.fileSize) / 1024).toFixed(2)} KB</p>
                        </div>
                    </div>
                ),
                okText: 'OK',
                okButtonProps: { type: 'primary' },
            });
            return;
        }

        if (isDoubleClick) {
            onDoubleClick?.(image.id);
        } else {
            onView?.(image.id);
        }
    };

    const handleSaveAs = async () => {
        try {
            // Ensure filename has extension
            let filename = image.originalName;
            const ext = `.${image.format.toLowerCase()}`;
            if (!filename.toLowerCase().endsWith(ext)) {
                filename += ext;
            }

            const result = await (window as any).api.saveFile({
                defaultPath: filename,
                filters: [
                    { name: 'Images', extensions: ['jpg', 'png', 'gif', 'tiff'] }
                ]
            });

            if (!result.canceled && result.filePath) {
                const response = await fetch(`http://localhost:3000/api/images/${image.id}/file`);

                if (!response.ok) {
                    throw new Error(`Failed to download image: ${response.statusText}`);
                }

                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);

                const writeResult = await (window as any).api.writeFile(result.filePath, buffer);
                if (writeResult && writeResult.success === false) {
                    throw new Error(writeResult.error || 'Failed to write file');
                }

                message.success('Image saved successfully');
            }
        } catch (error: any) {

            message.error(`Failed to save image: ${error.message}`);
        }
    };

    const handleSaveToDefault = async () => {
        try {
            let downloadFolder = localStorage.getItem('downloadFolder');
            if (!downloadFolder) {
                // Prompt user to select a folder
                const result = await (window as any).api.openDirectory();
                if (!result.canceled && result.filePaths.length > 0) {
                    downloadFolder = result.filePaths[0];
                    localStorage.setItem('downloadFolder', downloadFolder!);
                    message.success('Download folder configured');
                } else {
                    message.warning('No download folder selected. Operation cancelled.');
                    return;
                }
            }

            // Ensure target directory exists
            const exists = await (window as any).api.exists(downloadFolder);
            if (!exists) {
                await (window as any).api.createDirectory(downloadFolder);
            }

            const response = await fetch(`http://localhost:3000/api/images/${image.id}/file`);

            if (!response.ok) {
                throw new Error(`Failed to download image: ${response.statusText}`);
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);

            // Ensure filename has extension
            let filename = image.originalName;
            const ext = `.${image.format.toLowerCase()}`;
            if (!filename.toLowerCase().endsWith(ext)) {
                filename += ext;
            }

            const filePath = await (window as any).api.pathJoin(downloadFolder, filename);
            const writeResult = await (window as any).api.writeFile(filePath, buffer);

            if (writeResult && writeResult.success === false) {
                throw new Error(writeResult.error || 'Failed to write file');
            }

            message.success(`Image saved to ${downloadFolder}`);
        } catch (error: any) {

            message.error(`Failed to save image: ${error.message}`);
        }
    };

    const menuItems: MenuProps['items'] = [
        {
            key: 'view',
            label: 'View Details',
            icon: <EyeOutlined />,
            onClick: () => onView?.(image.id),
        },
        {
            key: 'saveDefault',
            label: 'Save to Default Path',
            icon: <CloudDownloadOutlined />,
            onClick: handleSaveToDefault,
        },
        {
            key: 'saveCustom',
            label: 'Save to Custom Path...',
            icon: <SaveOutlined />,
            onClick: handleSaveAs,
        },
        {
            key: 'rename',
            label: 'Rename',
            icon: <EditOutlined />,
            onClick: handleRename,
        },
        {
            key: 'move',
            label: 'Move to Folder',
            icon: <FileImageOutlined />,
            onClick: () => onMoveToFolder?.(image.id),
        },
        {
            type: 'divider',
        },
        {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: handleDelete,
        },
    ];



    return (
        <>
            <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
                <Card
                    hoverable
                    style={{
                        width: '100%',
                        position: 'relative',
                        border: selected ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorBgContainer,
                    }}
                    bodyStyle={{ padding: '4px 8px 6px 8px' }}
                    cover={
                        <div
                            style={{ position: 'relative', height: 150, overflow: 'hidden', cursor: image.isCorrupted ? 'not-allowed' : 'pointer' }}
                            onClick={() => handleViewOrDoubleClick(false)}
                            onDoubleClick={() => handleViewOrDoubleClick(true)}
                        >
                            {image.isCorrupted ? (
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        background: token.colorErrorBg,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: token.colorError,
                                        padding: 16,
                                    }}
                                >
                                    <CloseCircleOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                                    <Text type="danger" style={{ fontSize: 14, textAlign: 'center', fontWeight: 'bold' }}>
                                        Corrupted Image
                                    </Text>
                                    <Text type="danger" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                                        Cannot be displayed
                                    </Text>
                                </div>
                            ) : (
                                <img
                                    alt={image.originalName}
                                    src={`http://localhost:3000/api/images/${image.id}/thumbnail`}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Error';
                                    }}
                                />
                            )}
                            {/* Selection Checkbox Overlay */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    zIndex: 10,
                                    cursor: 'pointer',
                                    background: selected ? token.colorPrimary : 'rgba(0,0,0,0.5)',
                                    borderRadius: 4,
                                    padding: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 24,
                                    height: 24,
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect?.(image.id);
                                }}
                            >
                                {selected && <CheckOutlined style={{ color: '#000', fontSize: 14 }} />}
                            </div>
                        </div>
                    }
                    actions={[
                        <Tooltip title="View">
                            <EyeOutlined key="view" onClick={() => handleViewOrDoubleClick(false)} style={{ cursor: image.isCorrupted ? 'not-allowed' : 'pointer', opacity: image.isCorrupted ? 0.5 : 1, fontSize: 14 }} />
                        </Tooltip>,
                        <Tooltip title="Save As">
                            <SaveOutlined key="save" onClick={(e) => { e.stopPropagation(); handleSaveAs(); }} style={{ fontSize: 14 }} />
                        </Tooltip>,
                        <Dropdown menu={{ items: menuItems }} placement="bottomRight" arrow>
                            <MoreOutlined key="more" onClick={(e) => e.stopPropagation()} style={{ fontSize: 14 }} />
                        </Dropdown>
                    ]}
                >
                    <div style={{ marginTop: 0 }}>
                        <Tooltip title={image.originalName}>
                            <Text ellipsis style={{ fontSize: 10, lineHeight: '14px', display: 'block', marginBottom: 2 }}>{image.originalName}</Text>
                        </Tooltip>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, lineHeight: '12px' }}>
                            <Text type="secondary" style={{ fontSize: 9 }}>
                                {(() => {
                                    const ext = image.originalName.split('.').pop()?.toUpperCase();
                                    if (ext && ['TIF', 'TIFF', 'PNG', 'JPG', 'JPEG'].includes(ext)) {
                                        return ext === 'JPEG' ? 'JPG' : (ext === 'TIFF' ? 'TIF' : ext);
                                    }
                                    return image.format.toUpperCase();
                                })()}
                            </Text>
                            <span style={{ color: token.colorTextTertiary, fontSize: 8 }}>|</span>
                            <Text type="secondary" style={{ fontSize: 9 }}>{(parseInt(image.fileSize) / 1024 / 1024).toFixed(2)} MB</Text>
                            <span style={{ color: token.colorTextTertiary, fontSize: 8 }}>|</span>
                            <Text type="secondary" style={{ fontSize: 9 }}>
                                {new Date(image.createdAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '/')}
                            </Text>
                        </div>
                    </div>
                </Card>
            </Dropdown>

            <Modal
                title="Rename Image"
                open={isRenameModalVisible}
                onOk={submitRename}
                onCancel={() => setIsRenameModalVisible(false)}
                destroyOnClose
            >
                <div>
                    <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Enter new name (without extension)"
                        autoFocus
                        onPressEnter={submitRename}
                    />
                    <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary }}>
                        Extension ({image.originalName.split('.').pop()}) will be preserved automatically
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ImageCard;
