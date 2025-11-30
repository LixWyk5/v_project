import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Typography, theme, App } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { Image } from '../../types';
import { imageAPI } from '../../api/client';

const { Text } = Typography;
const { useToken } = theme;

interface ExifEditorProps {
    image: Image | null;
    visible: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

const ExifEditor: React.FC<ExifEditorProps> = ({ image, visible, onClose, onUpdate }) => {
    const { token } = useToken();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [exifData, setExifData] = useState<any>(null);

    useEffect(() => {
        if (image && visible) {
            loadExifData();
        }
    }, [image, visible]);

    const loadExifData = async () => {
        if (!image) return;
        try {
            // First try to get EXIF data from database (updated EXIF)
            let exif = null;
            try {
                const response = await imageAPI.getImage(image.id, false);
                // Check if database has EXIF data in metadata
                if (response.data.metadata?.exif) {
                    exif = response.data.metadata.exif;
                }
            } catch (dbError) {
                console.log('Failed to get EXIF from database, trying file...');
            }

            // If no EXIF in database, try from file (original EXIF)
            if (!exif || Object.keys(exif).length === 0) {
                try {
                    const exifResponse = await imageAPI.getExif(image.id);
                    if (exifResponse.data?.exif) {
                        exif = exifResponse.data.exif;
                    }
                } catch (exifError) {
                    console.log('Failed to get EXIF from file');
                }
            }

            // Default to empty object if no EXIF found
            if (!exif) {
                exif = {};
            }

            setExifData(exif);
            form.setFieldsValue({
                make: exif.make || '',
                model: exif.model || '',
                dateTimeOriginal: exif.dateTimeOriginal || '',
                iso: exif.iso || undefined,
                fNumber: exif.fNumber || '',
                exposureTime: exif.exposureTime || '',
                focalLength: exif.focalLength || '',
                gpsLatitude: exif.gpsLatitude || '',
                gpsLongitude: exif.gpsLongitude || '',
                software: exif.software || '',
            });
        } catch (error: any) {
            message.error(`Failed to load EXIF data: ${error.message}`);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const updatedExif = {
                ...exifData,
                ...values,
            };

            await imageAPI.updateMetadata(image!.id, { exif: updatedExif });
            message.success('EXIF data updated successfully');
            onUpdate();
            onClose();
        } catch (error: any) {
            if (error.errorFields) {
                return; // Form validation error
            }
            message.error(`Failed to update EXIF data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <EditOutlined />
                    <span>Edit EXIF Data</span>
                    {image && <Text type="secondary" style={{ fontSize: 14 }}>({image.originalName})</Text>}
                </Space>
            }
            open={visible}
            onCancel={onClose}
            width={600}
            footer={
                <Space>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="primary" loading={loading} onClick={handleSave}>
                        Save
                    </Button>
                </Space>
            }
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 16 }}
            >
                <Form.Item label="Camera Make" name="make">
                    <Input placeholder="e.g., Canon, Nikon" />
                </Form.Item>
                <Form.Item label="Camera Model" name="model">
                    <Input placeholder="e.g., EOS 5D Mark IV" />
                </Form.Item>
                <Form.Item label="Date/Time Original" name="dateTimeOriginal">
                    <Input placeholder="YYYY:MM:DD HH:MM:SS" />
                </Form.Item>
                <Form.Item label="ISO" name="iso">
                    <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g., 100" />
                </Form.Item>
                <Form.Item label="F-Number" name="fNumber">
                    <Input placeholder="e.g., f/2.8" />
                </Form.Item>
                <Form.Item label="Exposure Time" name="exposureTime">
                    <Input placeholder="e.g., 1/125" />
                </Form.Item>
                <Form.Item label="Focal Length" name="focalLength">
                    <Input placeholder="e.g., 50 mm" />
                </Form.Item>
                <Form.Item label="GPS Latitude" name="gpsLatitude">
                    <Input placeholder="e.g., 43.6532° N" />
                </Form.Item>
                <Form.Item label="GPS Longitude" name="gpsLongitude">
                    <Input placeholder="e.g., 79.3832° W" />
                </Form.Item>
                <Form.Item label="Software" name="software">
                    <Input placeholder="e.g., Adobe Photoshop" />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ExifEditor;




