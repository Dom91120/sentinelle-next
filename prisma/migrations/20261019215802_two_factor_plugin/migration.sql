-- AlterTable
ALTER TABLE "rate_limits" ALTER COLUMN "count" SET DEFAULT 0,
ALTER COLUMN "last_request" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "two_factor" ADD COLUMN     "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMPTZ,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;
