import React, { useEffect, useState } from 'react';
import { List, Button, Input, Modal, Space, Typography, theme, App, Dropdown } from 'antd';
import { FolderOutlined, FolderAddOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchFolders, createFolder, updateFolder, deleteFolder, setCurrentFolder } from '../../store/slices/foldersSlice';
import { setSidebarTab } from '../../store/slices/uiSlice';

const { Text } = Typography;
const { useToken } = theme;

const FolderList: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const { items: folders, loading, currentFolderId } = useAppSelector((state) => state.folders);
    const { message, modal } = App.useApp();

    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [selectedFolder, setSelectedFolder] = useState<any>(null);

    useEffect(() => {
        dispatch(fetchFolders());
    }, [dispatch]);

    const handleCreate = async () => {
        if (!folderName.trim()) return;
        try {
            await dispatch(createFolder({ name: folderName })).unwrap();
            message.success('Folder created');
            setIsCreateModalVisible(false);
            setFolderName('');
        } catch (error: any) {
            message.error(error.message || 'Failed to create folder');
        }
    };

    const handleRename = async () => {
        if (!folderName.trim() || !selectedFolder) return;
        try {
            await dispatch(updateFolder({ id: selectedFolder.id, name: folderName })).unwrap();
            message.success('Folder renamed');
            setIsRenameModalVisible(false);
            setFolderName('');
            setSelectedFolder(null);
        } catch (error: any) {
            message.error(error.message || 'Failed to rename folder');
        }
    };

    const handleDelete = (folder: any) => {
        modal.confirm({
            title: 'Delete Folder',
            content: `Are you sure you want to delete "${folder.name}"? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            onOk: async () => {
                try {
                    await dispatch(deleteFolder(folder.id)).unwrap();
                    message.success('Folder deleted');
                } catch (error: any) {
                    message.error(error.message || 'Failed to delete folder');
                }
            },
        });
    };

    const handleFolderClick = (id: number | null) => {
        dispatch(setCurrentFolder(id));
        dispatch(setSidebarTab('gallery')); // Switch to gallery view
    };

    const renderFolderMenu = (folder: any) => ({
        items: [
            {
                key: 'rename',
                icon: <EditOutlined />,
                label: 'Rename',
                onClick: (e: any) => {
                    e.domEvent.stopPropagation();
                    setSelectedFolder(folder);
                    setFolderName(folder.name);
                    setIsRenameModalVisible(true);
                }
            },
            {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: (e: any) => {
                    e.domEvent.stopPropagation();
                    handleDelete(folder);
                }
            }
        ]
    });

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16 }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 16 }}>Folders</Text>
                <Button
                    type="primary"
                    icon={<FolderAddOutlined />}
                    size="small"
                    onClick={() => setIsCreateModalVisible(true)}
                />
            </div>

            <List
                loading={loading}
                dataSource={[{ id: null, name: 'All Images' }, ...folders]}
                renderItem={(item: any) => (
                    <List.Item
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: token.borderRadius,
                            background: currentFolderId === item.id ? token.colorPrimaryBg : 'transparent',
                            marginBottom: 4,
                            border: 'none'
                        }}
                        onClick={() => handleFolderClick(item.id)}
                        actions={item.id ? [
                            <Dropdown menu={renderFolderMenu(item)} trigger={['click']}>
                                <Button type="text" size="small" icon={<MoreOutlined />} onClick={(e) => e.stopPropagation()} />
                            </Dropdown>
                        ] : []}
                    >
                        <Space>
                            <FolderOutlined style={{
                                color: currentFolderId === item.id ? token.colorPrimary : token.colorTextSecondary,
                                fontSize: 18
                            }} />
                            <Text style={{
                                color: currentFolderId === item.id ? token.colorPrimary : token.colorText
                            }}>
                                {item.name}
                            </Text>
                        </Space>
                    </List.Item>
                )}
            />

            <Modal
                title="Create Folder"
                open={isCreateModalVisible}
                onOk={handleCreate}
                onCancel={() => setIsCreateModalVisible(false)}
            >
                <Input
                    placeholder="Folder Name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    autoFocus
                />
            </Modal>

            <Modal
                title="Rename Folder"
                open={isRenameModalVisible}
                onOk={handleRename}
                onCancel={() => setIsRenameModalVisible(false)}
            >
                <Input
                    placeholder="Folder Name"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    autoFocus
                />
            </Modal>
        </div>
    );
};

export default FolderList;
