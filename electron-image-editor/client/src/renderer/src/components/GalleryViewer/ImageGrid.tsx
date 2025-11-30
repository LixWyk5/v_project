import React, { useMemo } from 'react';
import { Row, Col, Empty, Spin, Grid } from 'antd';
import { Image } from '../../types';
import ImageCard from './ImageCard';

const { useBreakpoint } = Grid;

interface ImageGridProps {
    images: Image[];
    loading: boolean;
    selectedIds: number[];
    onSelect: (id: number) => void;
    onView: (id: number) => void;
    onDelete: (id: number) => void;
    onMoveToFolder?: (id: number) => void;
    isLastPage?: boolean;
}

const ImageGrid: React.FC<ImageGridProps> = ({
    images,
    loading,
    selectedIds,
    onSelect,
    onView,
    onDelete,
    onMoveToFolder,
    isLastPage = false
}) => {
    const screens = useBreakpoint();

    // Calculate images per row based on current breakpoint
    // Col settings: xs={24} sm={12} md={8} lg={6} xl={4}
    const imagesPerRow = useMemo(() => {
        if (screens.xl) return 6; // xl={4} -> 24/4 = 6
        if (screens.lg) return 4; // lg={6} -> 24/6 = 4
        if (screens.md) return 3; // md={8} -> 24/8 = 3
        if (screens.sm) return 2; // sm={12} -> 24/12 = 2
        return 1; // xs={24} -> 24/24 = 1
    }, [screens]);

    // Only show images that fill complete rows (no partial rows)
    // Exception: if it's the last page, show all images even if they don't fill a complete row
    const displayImages = useMemo(() => {
        if (images.length === 0) return [];
        // If it's the last page, show all images
        if (isLastPage) {
            return images;
        }
        // Otherwise, only show images that fill complete rows
        const fullRowsCount = Math.floor(images.length / imagesPerRow) * imagesPerRow;
        return images.slice(0, fullRowsCount);
    }, [images, imagesPerRow, isLastPage]);

    if (loading && images.length === 0) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                <Spin size="large" />
            </div>
        );
    }

    if (displayImages.length === 0 && images.length === 0) {
        return (
            <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No images found"
                style={{ margin: '48px 0' }}
            />
        );
    }

    return (
        <Row gutter={[16, 16]}>
            {displayImages.map((image) => (
                <Col key={image.id} xs={24} sm={12} md={8} lg={6} xl={4}>
                    <ImageCard
                        image={image}
                        selected={selectedIds.includes(image.id)}
                        onSelect={onSelect}
                        onView={onView}
                        onDelete={onDelete}
                        onDoubleClick={onView}
                        onMoveToFolder={onMoveToFolder}
                    />
                </Col>
            ))}
        </Row>
    );
};

export default ImageGrid;
