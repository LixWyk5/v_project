import React from 'react';
import { Layout, Typography, Space, Tag, theme, Grid } from 'antd';
import { WifiOutlined, CloudSyncOutlined } from '@ant-design/icons';
import { useAppSelector } from '../../store/hooks';

const { Header: AntHeader } = Layout;
const { Text } = Typography;
const { useToken } = theme;
const { useBreakpoint } = Grid;

const Header: React.FC = () => {
    const { token } = useToken();
    const screens = useBreakpoint();
    const { status, localImages, serverImages } = useAppSelector((state) => state.sync);

    const getSyncStatusColor = () => {
        switch (status) {
            case 'syncing': return 'processing';
            case 'success': return 'success';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    return (
        <AntHeader
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: screens.xs ? '0 12px' : screens.sm ? '0 16px' : '0 24px',
                background: token.Layout?.headerBg, // Use theme header background
                borderBottom: `1px solid ${token.colorBorder}`
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img
                    src="/voyis-logo.jpg"
                    alt="Voyis Logo"
                    style={{
                        width: screens.xs ? 24 : 32,
                        height: screens.xs ? 24 : 32,
                        borderRadius: 6,
                    }}
                />
                <Text strong style={{ fontSize: screens.xs ? 14 : screens.sm ? 16 : 18, color: token.colorPrimary }}>
                    {screens.xs ? 'Voyis' : 'Voyis Image Editor'}
                </Text>
            </div>

            <Space size="large" wrap>
                {!(screens.xs || screens.sm) && (
                    <Space>
                        <WifiOutlined style={{ color: token.colorTextBase }} />
                        <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                            Local: {localImages} | Server: {serverImages}
                        </Text>
                    </Space>
                )}

                <Tag icon={<CloudSyncOutlined spin={status === 'syncing'} />} color={getSyncStatusColor()}>
                    {status.toUpperCase()}
                </Tag>
            </Space>
        </AntHeader>
    );
};

export default Header;
