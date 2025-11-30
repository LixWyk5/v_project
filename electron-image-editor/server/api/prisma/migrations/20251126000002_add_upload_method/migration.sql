-- AlterTable
ALTER TABLE "upload_batches" ADD COLUMN "upload_method" TEXT NOT NULL DEFAULT 'batch';

-- CreateIndex
CREATE INDEX "upload_batches_upload_method_idx" ON "upload_batches"("upload_method");

