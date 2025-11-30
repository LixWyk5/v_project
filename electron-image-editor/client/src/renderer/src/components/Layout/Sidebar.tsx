import React from 'react';
import { Layout, Menu, theme, Divider, Grid } from 'antd';
import {
    AppstoreOutlined,
    EyeOutlined,
    SyncOutlined,
    SettingOutlined,
    HistoryOutlined
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setSidebarTab } from '../../store/slices/uiSlice';
import FolderList from '../Folders/FolderList';
import FileUpload from '../FileUpload/FileUpload';

const { Sider } = Layout;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const Sidebar: React.FC = () => {
    const { token } = useToken();
    const dispatch = useAppDispatch();
    const screens = useBreakpoint();
    const { sidebarTab } = useAppSelector((state) => state.ui);

    const menuItems = [
        {
            key: 'gallery',
            icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
            label: 'Gallery',
        },
        {
            key: 'single',
            icon: <EyeOutlined style={{ fontSize: 18 }} />,
            label: 'Viewer',
        },
        {
            key: 'sync',
            icon: <SyncOutlined style={{ fontSize: 18 }} />,
            label: 'Sync',
        },
        {
            key: 'systemActivity',
            icon: <HistoryOutlined style={{ fontSize: 18 }} />,
            label: 'System Activity',
        },
        {
            key: 'settings',
            icon: <SettingOutlined style={{ fontSize: 18 }} />,
            label: 'Settings',
        },
    ];

    const handleMenuClick = ({ key }: { key: string }) => {
        dispatch(setSidebarTab(key as any));
    };

    // Responsive width: adjust based on screen size
    // Maintains original 320px on desktop, slightly smaller on smaller screens
    const sidebarWidth = screens.xs 
        ? 280  // Mobile: 280px (slightly smaller for mobile)
        : screens.sm 
        ? 300  // Tablet: 300px (slightly smaller for tablet)
        : 320; // Desktop: 320px (original width)

    return (
        <Sider
            width={sidebarWidth}
            style={{
                background: token.Layout?.siderBg,
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}
        >
                <div style={{ 
                padding: screens.xs ? '8px' : '12px', 
                    borderBottom: `1px solid ${token.colorBorderSecondary}`, 
                    overflowY: 'auto', 
                    flexShrink: 0,
                    maxHeight: '280px',
                }}>
                <h3 style={{ 
                    marginBottom: 8, 
                    color: token.colorText, 
                    fontSize: screens.xs ? 12 : 14 
                }}>
                    Upload Images
                </h3>
                    <FileUpload compact />
                </div>

            <Divider style={{ margin: 0 }} />

            <Menu
                mode="inline"
                selectedKeys={[sidebarTab]}
                items={menuItems}
                onClick={handleMenuClick}
                style={{
                    background: 'transparent',
                    borderRight: 0,
                }}
            />

                <div style={{ 
                padding: screens.xs ? '8px 12px' : '12px 16px', 
                    borderTop: `1px solid ${token.colorBorderSecondary}`, 
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                }}>
                <FolderList />
            </div>
        </Sider>
    );
};

export default Sidebar;
