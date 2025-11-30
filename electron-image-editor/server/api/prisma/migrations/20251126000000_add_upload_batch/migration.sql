-- CreateTable
CREATE TABLE "upload_batches" (
    "id" SERIAL NOT NULL,
    "batch_id" TEXT NOT NULL,
    "total_files" INTEGER NOT NULL DEFAULT 0,
    "total_size" BIGINT NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "corrupted_count" INTEGER NOT NULL DEFAULT 0,
    "folder_id" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "upload_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_files" (
    "id" SERIAL NOT NULL,
    "batch_id" TEXT NOT NULL,
    "image_id" INTEGER,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "is_corrupted" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_batches_batch_id_key" ON "upload_batches"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "upload_files_image_id_key" ON "upload_files"("image_id");

-- CreateIndex
CREATE INDEX "upload_batches_timestamp_idx" ON "upload_batches"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "upload_files_batch_id_idx" ON "upload_files"("batch_id");

-- AddForeignKey
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_files" ADD CONSTRAINT "upload_files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "upload_batches"("batch_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_files" ADD CONSTRAINT "upload_files_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE SET NULL ON UPDATE CASCADE;



