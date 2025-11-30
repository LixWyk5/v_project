import React from 'react';

interface VoyisIconProps {
    src: string;
    alt?: string;
    size?: number;
}

const VoyisIcon: React.FC<VoyisIconProps> = ({ src, alt = 'icon', size = 20 }) => {
    return (
        <img
            src={src}
            alt={alt}
            style={{
                width: size,
                height: size,
                display: 'inline-block',
                verticalAlign: 'middle',
            }}
        />
    );
};

export default VoyisIcon;
