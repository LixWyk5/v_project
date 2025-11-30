-- Image Editor Database Initialization Script

-- Create images table
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    thumbnail_path VARCHAR(500),
    file_size BIGINT NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('jpg', 'jpeg', 'png', 'tif', 'tiff')),
    width INTEGER,
    height INTEGER,
    is_corrupted BOOLEAN DEFAULT false,
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB,
    source VARCHAR(50) DEFAULT 'local' CHECK (source IN ('local', 'server')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sync_log table
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL CHECK (action IN ('upload', 'download', 'delete', 'sync', 'conflict', 'filter', 'crop', 'update')),
    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB,
    status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending'))
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_images_upload_date ON images(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_images_format ON images(format);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source);
CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_action ON sync_log(action);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_images_updated_at BEFORE UPDATE ON images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
INSERT INTO images (filename, original_name, file_path, file_size, format, width, height, source)
VALUES 
    ('sample1.jpg', 'Sample Image 1.jpg', '/storage/sample-images/sample1.jpg', 1024000, 'jpg', 1920, 1080, 'server'),
    ('sample2.png', 'Sample Image 2.png', '/storage/sample-images/sample2.png', 2048000, 'png', 3840, 2160, 'server')
ON CONFLICT (filename) DO NOTHING;

-- Log the initialization
INSERT INTO sync_log (action, details, status)
VALUES ('sync', '{"message": "Database initialized successfully"}', 'success');
