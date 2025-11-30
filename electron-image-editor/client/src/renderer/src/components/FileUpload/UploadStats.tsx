import React from 'react';
import { Card, Statistic, Row, Col, Typography, theme } from 'antd';
import {
    FileImageOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    DatabaseOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { useToken } = theme;

export interface UploadStats {
    totalFiles: number;
    totalSize: number;
    successCount: number;
    failedCount: number;
    corruptedCount: number;
}

interface UploadStatsProps {
    stats: UploadStats | null;
}

const UploadStats: React.FC<UploadStatsProps> = ({ stats }) => {
    const { token } = useToken();

    if (!stats || stats.totalFiles === 0) return null;

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <Card
            title="Upload Statistics"
            style={{ marginTop: 24, background: token.colorBgContainer }}
        >
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                    <Statistic
                        title="Total Files"
                        value={stats.totalFiles}
                        prefix={<FileImageOutlined />}
                        valueStyle={{ color: token.colorText }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic
                        title="Total Size"
                        value={formatSize(stats.totalSize)}
                        prefix={<DatabaseOutlined />}
                        valueStyle={{ color: token.colorText }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic
                        title="Success"
                        value={stats.successCount}
                        prefix={<CheckCircleOutlined />}
                        valueStyle={{ color: token.colorSuccess }}
                    />
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Statistic
                        title="Failed"
                        value={stats.failedCount}
                        prefix={<CloseCircleOutlined />}
                        valueStyle={{ color: token.colorError }}
                    />
                </Col>
            </Row>
            
            {/* Separate row for Corrupted count - per PDF requirement */}
            {stats.corruptedCount > 0 && (
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                    <Col xs={24}>
                        <div style={{ 
                            padding: 16, 
                            background: token.colorWarningBg, 
                            borderRadius: token.borderRadius,
                            border: `1px solid ${token.colorWarningBorder}`
                        }}>
                            <Statistic
                                title="Corrupted Images (uploaded but marked)"
                                value={stats.corruptedCount}
                                prefix={<WarningOutlined />}
                                valueStyle={{ color: token.colorWarning }}
                            />
                            <Text type="warning" style={{ marginTop: 8, display: 'block' }}>
                                Corrupted images have been uploaded but marked as corrupted. 
                                You can filter them in the Gallery using the Status filter.
                            </Text>
                        </div>
                    </Col>
                </Row>
            )}
        </Card>
    );
};

export default UploadStats;


