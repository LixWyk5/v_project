# Electron Image Editor

A desktop image management application built with Electron + React, featuring Dockerized backend services.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker Desktop
- Ports 3000 and 5432 available

### Setup Steps

1. **Start Docker Services**

```bash
cd electron-image-editor
docker-compose up -d --build
```

2. **Start Electron Application**

```bash
cd client
   npm install  # First time only
npm run dev
```

## Core Features

- **File Upload**: Support for JPG, PNG, TIF formats (4K quality), single/batch/JSON config upload, displays total file count, total size, and corrupted image count
- **Image Management**: View, edit, delete, rename
- **Image Editing**: Rotate, crop, filters, watermark (WASM/Canvas)
- **Gallery Viewer**: Thumbnail display, filter by type, multi-select, batch export/download
- **Single Image Viewer**: Pan, zoom, area selection (crop)
- **EXIF Management**: Extract, edit, sync metadata to database
- **Smart Sync**: Two conflict resolution strategies
- **Folder Management**: Create, move, organize images
- **Theme Support**: One-click toggle between light and dark themes

## Sync Strategies

The system provides two sync strategies. All strategies automatically delete files that don't exist on the target side to ensure sync consistency:

1. **Server Always Wins**: Server version always takes precedence, local modifications will be overwritten. Suitable for scenarios where server data is the single source of truth.

2. **Local Always Wins**: Local version always takes precedence, server modifications will be overwritten. Suitable for scenarios where local is the primary working environment.

**Design Rationale**: Considering that Last Write Wins strategy requires precise timestamp comparison, and factors like file renaming, timezone differences, and filesystem limitations can affect timestamp reliability, we chose simpler, more predictable unidirectional priority strategies that give users explicit control over data flow.

**Potential Flaws and Data Loss Risks**:

- **Server Always Wins**: Unsaved local modifications will be overwritten by server versions, potentially losing local work. It is recommended to backup important modifications before syncing.
- **Local Always Wins**: Server-side updates will be overwritten by local versions, which may overwrite other users' modifications in multi-user collaboration scenarios. Only suitable for single-user scenarios.

## Performance Optimization and Scalability Design

### Large-Scale Data Preparation (100k+ images)

#### Database Optimization

- **Index Strategy**: Indexes on `uploadDate`, `format`, `source`, and `folderId` fields to optimize query performance
- **Pagination**: Default 50 records per page to avoid loading large amounts of data at once
- **Query Optimization**: Use Prisma `select` to fetch only necessary fields, reducing data transfer
- **Connection Pool**: Database connection pooling to manage concurrent connections

#### UI Optimization

- **Pagination Rendering**: Gallery uses pagination, rendering only thumbnails for the current page
- **Responsive Grid**: Dynamically adjust images per row based on screen size for optimal rendering performance
- **Lazy Loading**: Thumbnails loaded on demand to reduce initial load time
- **Redux Caching**: Use Redux to cache loaded data, avoiding duplicate requests

#### API Optimization

- **Batch Operations**: Support batch upload and batch delete to reduce network request frequency
- **Async Processing**: Thumbnail generation and EXIF extraction use async processing to avoid blocking the main flow
- **Streaming**: Large file uploads use streaming to reduce memory usage

### Large-Scale Sync Optimization

- **Incremental Sync**: Only sync changed files to avoid performance issues from full sync
- **Concurrency Control**: Limit the number of simultaneous sync operations to avoid resource contention
- **Compressed Transfer**: Compress large files before transmission (where applicable) to reduce network bandwidth usage
- **Resume Support**: Support resuming interrupted syncs to improve reliability for large file syncing

### Large-Scale Rendering Optimization

- **Virtual Scrolling**: For extremely large lists, consider implementing virtual scrolling to render only visible images
- **Thumbnail Compression**: All thumbnails compressed to 300x300 pixels to reduce memory and storage usage
- **Debounced Search**: Search operations use debouncing to avoid frequent database queries
- **Image Preloading**: Preload next page images to improve user experience

## Technology Stack

- **Frontend**: Electron + React + TypeScript + Redux Toolkit + Ant Design
- **Backend**: Node.js + Express + Prisma + PostgreSQL
- **Image Processing**: Sharp, ImageMagick, Canvas API
- **Containerization**: Docker Compose

## Demo Video

A demonstration video showcasing the application's features is available in the GitHub repository:

- **File**: `electron-image-editor-demo.mp4`
- **Location**: Repository root directory

The video demonstrates all core features including file upload, image editing, gallery viewer, synchronization, and additional features like EXIF management and watermarking.

## License

MIT License

Copyright (c) 2025 LixWyk5 (https://github.com/LixWyk5)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
