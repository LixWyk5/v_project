/**
 * Canvas-based Watermark Processor (Fallback)
 * 使用 Canvas API 实现水印功能，作为 WASM 的备选方案
 */

export interface WatermarkOptions {
  text?: string;
  image?: HTMLImageElement | ImageBitmap;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'tile'; // 添加平铺选项
  opacity?: number;
  fontSize?: number;
  fontColor?: string;
  offsetX?: number;
  offsetY?: number;
  angle?: number; // 倾斜角度（度）
  spacing?: number; // 平铺时的间距
}

/**
 * 使用 Canvas 添加文字水印
 */
export async function addTextWatermarkCanvas(
  imageData: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      // 创建图片对象
      const img = new Image();
      const blob = new Blob([imageData], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          // 创建 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // 绘制原图
          ctx.drawImage(img, 0, 0);

          // 设置水印样式
          const fontSize = options.fontSize || 24;
          const fontColor = options.fontColor || '#FFFFFF';
          const opacity = options.opacity || 0.15; // 降低默认透明度，让水印更不明显
          const position = options.position || 'tile'; // 默认使用平铺
          const offsetX = options.offsetX || 10;
          const offsetY = options.offsetY || 10;
          const angle = options.angle || -45; // 默认倾斜 -45 度
          const spacing = options.spacing || 150; // 平铺间距

          ctx.font = `${fontSize}px Arial`;
          ctx.fillStyle = fontColor;
          ctx.globalAlpha = opacity;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const text = options.text || '';
          const textMetrics = ctx.measureText(text);
          const textWidth = textMetrics.width;
          const textHeight = fontSize;

          if (position === 'tile') {
            // 平铺模式：斜着布满图片
            const radian = (angle * Math.PI) / 180;
            const cos = Math.cos(radian);
            const sin = Math.sin(radian);
            
            // 计算平铺需要的范围（考虑旋转）
            const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
            const tileWidth = textWidth + spacing;
            const tileHeight = textHeight + spacing;
            
            // 计算需要平铺的行数和列数
            const cols = Math.ceil(diagonal / tileWidth) + 2;
            const rows = Math.ceil(diagonal / tileHeight) + 2;
            
            // 从中心点开始平铺
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            
            for (let row = -rows; row <= rows; row++) {
              for (let col = -cols; col <= cols; col++) {
                // 计算未旋转时的位置
                const baseX = centerX + col * tileWidth;
                const baseY = centerY + row * tileHeight;
                
                // 应用旋转
                ctx.save();
                ctx.translate(baseX, baseY);
                ctx.rotate(radian);
                
                // 添加轻微阴影（可选）
                ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
                ctx.shadowBlur = 1;
                ctx.shadowOffsetX = 0.5;
                ctx.shadowOffsetY = 0.5;
                
                // 绘制文字（在旋转后的坐标系中，从中心绘制）
                ctx.fillText(text, -textWidth / 2, -textHeight / 2);
                ctx.restore();
              }
            }
          } else {
            // 单点模式：在指定位置绘制
            let x = 0;
            let y = 0;

            switch (position) {
              case 'top-left':
                x = offsetX;
                y = offsetY;
                break;
              case 'top-right':
                x = canvas.width - textWidth - offsetX;
                y = offsetY;
                break;
              case 'bottom-left':
                x = offsetX;
                y = canvas.height - textHeight - offsetY;
                break;
              case 'bottom-right':
                x = canvas.width - textWidth - offsetX;
                y = canvas.height - textHeight - offsetY;
                break;
              case 'center':
                x = (canvas.width - textWidth) / 2;
                y = (canvas.height - textHeight) / 2;
                break;
            }

            // 如果指定了角度，应用旋转
            if (angle && angle !== 0) {
              ctx.save();
              ctx.translate(x + textWidth / 2, y + textHeight / 2);
              ctx.rotate((angle * Math.PI) / 180);
              ctx.fillText(text, -textWidth / 2, -textHeight / 2);
              ctx.restore();
            } else {
              // 添加文字阴影（可选，提高可读性）
              ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
              ctx.shadowBlur = 2;
              ctx.shadowOffsetX = 1;
              ctx.shadowOffsetY = 1;
              ctx.fillText(text, x, y);
            }
          }

          // 转换为 Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              blob.arrayBuffer().then((buffer) => {
                resolve(new Uint8Array(buffer));
                URL.revokeObjectURL(url);
              });
            },
            'image/jpeg',
            0.9
          );
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 使用 Canvas 添加图片水印
 */
export async function addImageWatermarkCanvas(
  imageData: Uint8Array,
  watermarkImageData: Uint8Array,
  options: WatermarkOptions
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      // 加载主图
      const mainImg = new Image();
      const mainBlob = new Blob([imageData], { type: 'image/jpeg' });
      const mainUrl = URL.createObjectURL(mainBlob);

      // 加载水印图
      const watermarkImg = new Image();
      const watermarkBlob = new Blob([watermarkImageData], { type: 'image/png' });
      const watermarkUrl = URL.createObjectURL(watermarkBlob);

      let mainLoaded = false;
      let watermarkLoaded = false;

      const tryProcess = () => {
        if (!mainLoaded || !watermarkLoaded) return;

        try {
          // 创建 Canvas
          const canvas = document.createElement('canvas');
          canvas.width = mainImg.width;
          canvas.height = mainImg.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // 绘制主图
          ctx.drawImage(mainImg, 0, 0);

              // 计算水印位置
              const position = options.position || 'tile';
              const opacity = options.opacity || 0.15; // 降低默认透明度
              const offsetX = options.offsetX || 10;
              const offsetY = options.offsetY || 10;
              const angle = options.angle || -45;
              const spacing = options.spacing || 150;

              ctx.globalAlpha = opacity;

              if (position === 'tile') {
                // 平铺模式：斜着布满图片
                const radian = (angle * Math.PI) / 180;
                const tileWidth = watermarkImg.width + spacing;
                const tileHeight = watermarkImg.height + spacing;
                
                // 计算需要平铺的范围
                const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
                const cols = Math.ceil(diagonal / tileWidth) + 2;
                const rows = Math.ceil(diagonal / tileHeight) + 2;
                
                const centerX = canvas.width / 2;
                const centerY = canvas.height / 2;
                
                for (let row = -rows; row <= rows; row++) {
                  for (let col = -cols; col <= cols; col++) {
                    const baseX = centerX + col * tileWidth;
                    const baseY = centerY + row * tileHeight;
                    
                    ctx.save();
                    ctx.translate(baseX, baseY);
                    ctx.rotate(radian);
                    ctx.drawImage(watermarkImg, -watermarkImg.width / 2, -watermarkImg.height / 2);
                    ctx.restore();
                  }
                }
              } else {
                // 单点模式
                let x = 0;
                let y = 0;

                switch (position) {
                  case 'top-left':
                    x = offsetX;
                    y = offsetY;
                    break;
                  case 'top-right':
                    x = canvas.width - watermarkImg.width - offsetX;
                    y = offsetY;
                    break;
                  case 'bottom-left':
                    x = offsetX;
                    y = canvas.height - watermarkImg.height - offsetY;
                    break;
                  case 'bottom-right':
                    x = canvas.width - watermarkImg.width - offsetX;
                    y = canvas.height - watermarkImg.height - offsetY;
                    break;
                  case 'center':
                    x = (canvas.width - watermarkImg.width) / 2;
                    y = (canvas.height - watermarkImg.height) / 2;
                    break;
                }

                // 如果指定了角度，应用旋转
                if (angle && angle !== 0) {
                  ctx.save();
                  ctx.translate(x + watermarkImg.width / 2, y + watermarkImg.height / 2);
                  ctx.rotate((angle * Math.PI) / 180);
                  ctx.drawImage(watermarkImg, -watermarkImg.width / 2, -watermarkImg.height / 2);
                  ctx.restore();
                } else {
                  ctx.drawImage(watermarkImg, x, y);
                }
              }

          // 转换为 Blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Failed to create blob'));
                return;
              }
              blob.arrayBuffer().then((buffer) => {
                resolve(new Uint8Array(buffer));
                URL.revokeObjectURL(mainUrl);
                URL.revokeObjectURL(watermarkUrl);
              });
            },
            'image/jpeg',
            0.9
          );
        } catch (error) {
          URL.revokeObjectURL(mainUrl);
          URL.revokeObjectURL(watermarkUrl);
          reject(error);
        }
      };

      mainImg.onload = () => {
        mainLoaded = true;
        tryProcess();
      };

      watermarkImg.onload = () => {
        watermarkLoaded = true;
        tryProcess();
      };

      mainImg.onerror = () => {
        URL.revokeObjectURL(mainUrl);
        URL.revokeObjectURL(watermarkUrl);
        reject(new Error('Failed to load main image'));
      };

      watermarkImg.onerror = () => {
        URL.revokeObjectURL(mainUrl);
        URL.revokeObjectURL(watermarkUrl);
        reject(new Error('Failed to load watermark image'));
      };

      mainImg.src = mainUrl;
      watermarkImg.src = watermarkUrl;
    } catch (error) {
      reject(error);
    }
  });
}

