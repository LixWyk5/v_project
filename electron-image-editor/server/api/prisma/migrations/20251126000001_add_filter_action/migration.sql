-- AlterTable: Add 'filter' and 'crop' to sync_log action check constraint
ALTER TABLE sync_log DROP CONSTRAINT IF EXISTS sync_log_action_check;
ALTER TABLE sync_log ADD CONSTRAINT sync_log_action_check CHECK (action IN ('upload', 'download', 'delete', 'sync', 'conflict', 'filter', 'crop'));


