# Use Node.js LTS
FROM node:18-alpine

# Install OpenSSL for Prisma and ImageMagick for TIF processing
# Also install JPEG libraries for ImageMagick to support JPEG-compressed TIF files
RUN apk add --no-cache openssl imagemagick imagemagick-dev libjpeg-turbo-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Create directories for sample images (will be mounted via volume)
RUN mkdir -p /app/sample_images

# Make start script executable
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Start with custom script
CMD ["sh", "/app/start.sh"]
