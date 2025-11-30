-- CreateTable
CREATE TABLE "images" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "thumbnail_path" TEXT,
    "file_size" BIGINT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "is_corrupted" BOOLEAN NOT NULL DEFAULT false,
    "upload_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_modified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "source" TEXT NOT NULL DEFAULT 'local',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "folder_id" INTEGER,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_log" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "image_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'success',

    CONSTRAINT "sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "images_filename_key" ON "images"("filename");

-- CreateIndex
CREATE INDEX "images_upload_date_idx" ON "images"("upload_date" DESC);

-- CreateIndex
CREATE INDEX "images_format_idx" ON "images"("format");

-- CreateIndex
CREATE INDEX "images_source_idx" ON "images"("source");

-- CreateIndex
CREATE INDEX "sync_log_timestamp_idx" ON "sync_log"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "sync_log_action_idx" ON "sync_log"("action");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
