import React, { useState } from 'react';
import { Modal, Form, Input, Select, Slider, Space, Typography, Button, Upload, message, App } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';

const { Text } = Typography;
const { Option } = Select;

export interface WatermarkOptions {
  type: 'text' | 'image';
  text?: string;
  imageFile?: File;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile';
  opacity: number;
  fontSize?: number;
  fontColor?: string;
  offsetX: number;
  offsetY: number;
  angle?: number; // Rotation angle in degrees
  spacing?: number; // Spacing for tile mode
}

interface WatermarkModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (options: WatermarkOptions) => void;
  loading?: boolean;
}

const WatermarkModal: React.FC<WatermarkModalProps> = ({
  visible,
  onCancel,
  onOk,
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [position, setPosition] = useState<string>('tile');

  const handleTypeChange = (type: 'text' | 'image') => {
    setWatermarkType(type);
    form.setFieldsValue({ type });
  };

  const handleImageUpload = (file: File) => {
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      message.error('Please upload an image file');
      return false;
    }
    setImageFile(file);
    return false; // 阻止自动上传
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const options: WatermarkOptions = {
        type: watermarkType,
        position: values.position || 'tile',
        opacity: values.opacity / 100, // 转换为 0-1
        offsetX: values.offsetX || 10,
        offsetY: values.offsetY || 10,
        angle: values.angle || -45,
        spacing: values.spacing || 150,
      };

      if (watermarkType === 'text') {
        if (!values.text || values.text.trim() === '') {
          message.error('Please enter watermark text');
          return;
        }
        options.text = values.text;
        options.fontSize = values.fontSize || 24;
        options.fontColor = values.fontColor || '#FFFFFF';
      } else {
        if (!imageFile) {
          message.error('Please upload a watermark image');
          return;
        }
        options.imageFile = imageFile;
      }

      onOk(options);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  return (
    <Modal
      title="Add Watermark (WASM)"
      open={visible}
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={600}
      okText="Preview"
      cancelText="Cancel"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: 'text',
          position: 'tile',
          opacity: 15, // 降低默认透明度
          fontSize: 24,
          fontColor: '#FFFFFF',
          offsetX: 10,
          offsetY: 10,
          angle: -45, // 默认倾斜 -45 度
          spacing: 150, // 默认间距
        }}
      >
        <Form.Item label="Watermark Type" name="type">
          <Select onChange={handleTypeChange}>
            <Option value="text">Text Watermark</Option>
            <Option value="image">Image Watermark</Option>
          </Select>
        </Form.Item>

        {watermarkType === 'text' && (
          <>
            <Form.Item
              label="Watermark Text"
              name="text"
              rules={[{ required: true, message: 'Please enter watermark text' }]}
            >
              <Input placeholder="Enter watermark text" maxLength={100} />
            </Form.Item>

            <Form.Item label="Font Size" name="fontSize">
              <Slider min={12} max={72} marks={{ 12: '12', 36: '36', 72: '72' }} />
            </Form.Item>

            <Form.Item label="Font Color" name="fontColor">
              <Input type="color" style={{ width: 100 }} />
            </Form.Item>
          </>
        )}

        {watermarkType === 'image' && (
          <Form.Item
            label="Watermark Image"
            rules={[{ required: true, message: 'Please upload a watermark image' }]}
          >
            <Upload
              beforeUpload={handleImageUpload}
              showUploadList={false}
              accept="image/*"
            >
              <Button icon={<UploadOutlined />}>Select Image</Button>
            </Upload>
            {imageFile && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {imageFile.name}
              </Text>
            )}
          </Form.Item>
        )}

        <Form.Item label="Position" name="position">
          <Select onChange={(value) => setPosition(value)}>
            <Option value="tile">Tile (Cover Image)</Option>
            <Option value="top-left">Top Left</Option>
            <Option value="top-right">Top Right</Option>
            <Option value="bottom-left">Bottom Left</Option>
            <Option value="bottom-right">Bottom Right</Option>
            <Option value="center">Center</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Opacity" name="opacity">
          <Slider
            min={0}
            max={100}
            marks={{ 0: '0%', 15: '15%', 50: '50%', 100: '100%' }}
          />
        </Form.Item>

        <Form.Item label="Rotation Angle (degrees)" name="angle">
          <Slider
            min={-90}
            max={90}
            marks={{ '-90': '-90°', '-45': '-45°', '0': '0°', '45': '45°', '90': '90°' }}
          />
        </Form.Item>

        {position === 'tile' && (
          <Form.Item label="Spacing" name="spacing" tooltip="Distance between watermarks when tiling">
            <Slider
              min={50}
              max={300}
              marks={{ 50: '50', 150: '150', 300: '300' }}
            />
          </Form.Item>
        )}

        <Space>
          <Form.Item label="Offset X" name="offsetX" style={{ width: 200 }}>
            <Slider min={0} max={100} />
          </Form.Item>
          <Form.Item label="Offset Y" name="offsetY" style={{ width: 200 }}>
            <Slider min={0} max={100} />
          </Form.Item>
        </Space>

        <Text type="secondary" style={{ fontSize: 12 }}>
          * This feature uses WebAssembly for client-side processing
        </Text>
      </Form>
    </Modal>
  );
};

export default WatermarkModal;

