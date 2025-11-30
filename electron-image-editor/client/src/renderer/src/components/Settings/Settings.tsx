import React, { useState, useEffect } from 'react';
import { Layout, Card, Typography, Switch, Form, Input, Button, Divider, theme, Space, App } from 'antd';
import { BulbOutlined, BulbFilled, SaveOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setTheme } from '../../store/slices/uiSlice';

const { Content } = Layout;
const { Title, Text } = Typography;
const { useToken } = theme;

const Settings: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const { theme: currentTheme } = useAppSelector((state) => state.ui);
    const { message } = App.useApp();
    const [downloadFolder, setDownloadFolder] = useState('');

    useEffect(() => {
        const savedDownloadFolder = localStorage.getItem('downloadFolder');
        if (savedDownloadFolder) {
            setDownloadFolder(savedDownloadFolder);
        }
    }, []);

    const handleThemeChange = (checked: boolean) => {
        dispatch(setTheme(checked ? 'dark' : 'light'));
    };


    const handleSelectDownloadFolder = async () => {
        try {
            const result = await (window as any).api.openDirectory();
            if (!result.canceled && result.filePaths.length > 0) {
                const folder = result.filePaths[0];
                setDownloadFolder(folder);
                localStorage.setItem('downloadFolder', folder);
            }
        } catch (error) {

        }
    };

    const handleOpenDownloadFolder = async () => {
        if (!downloadFolder) return;
        try {
            // Check if folder exists before opening
            const exists = await (window as any).api.exists(downloadFolder);
            if (!exists) {
                message.error(
                    `Download folder does not exist: ${downloadFolder}. Please reconfigure the download folder.`
                );
                return;
            }
            const result = await (window as any).api.openPath(downloadFolder);
            if (!result.success) {
                message.error(`Failed to open folder: ${result.error || "Unknown error"}`);
            }
        } catch (error: any) {
            message.error(`Failed to open folder: ${error.message || "Unknown error"}`);
        }
    };

    return (
        <Content style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
            <Title level={2} style={{ marginBottom: 24 }}>Settings</Title>

            <Card title="Appearance" bordered={false} style={{ marginBottom: 24, background: token.colorBgContainer }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        {currentTheme === 'dark' ? <BulbFilled /> : <BulbOutlined />}
                        <div>
                            <Text strong style={{ display: 'block' }}>Dark Mode</Text>
                            <Text type="secondary">Switch between light and dark themes</Text>
                        </div>
                    </Space>
                    <Switch
                        checked={currentTheme === 'dark'}
                        onChange={handleThemeChange}
                        checkedChildren="Dark"
                        unCheckedChildren="Light"
                    />
                </div>
            </Card>

            <Card title="Download Configuration" bordered={false} style={{ marginBottom: 24, background: token.colorBgContainer }}>
                <Form layout="vertical">
                    <Form.Item label="Local Download Path" tooltip="Folder to save downloaded images to">
                        <Space.Compact style={{ width: '100%' }}>
                            <Input
                                value={downloadFolder}
                                placeholder="Select a folder..."
                                readOnly
                                status={downloadFolder ? '' : 'warning'}
                                prefix={downloadFolder ? <FolderOpenOutlined /> : <FolderOpenOutlined style={{ color: 'orange' }} />}
                            />
                            <Button onClick={handleSelectDownloadFolder}>
                                Browse
                            </Button>
                            <Button
                                icon={<FolderOpenOutlined />}
                                onClick={handleOpenDownloadFolder}
                                disabled={!downloadFolder}
                            >
                                Open
                            </Button>
                        </Space.Compact>
                        {!downloadFolder && <Text type="warning" style={{ fontSize: 12 }}>If not set, will prompt on download</Text>}
                    </Form.Item>
                </Form>
            </Card>



            <Card title="About" bordered={false} style={{ background: token.colorBgContainer }}>
                <Space direction="vertical">
                    <Text><strong>Voyis Image Editor</strong> v1.0.0</Text>
                    <Text type="secondary">Electron + React + TypeScript</Text>
                    <Divider style={{ margin: '12px 0' }} />
                    <Text type="secondary">© 2023 Voyis. All rights reserved.</Text>
                </Space>
            </Card>
        </Content>
    );
};

export default Settings;
