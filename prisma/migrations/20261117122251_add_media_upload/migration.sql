-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('SHOW_COVER', 'EPISODE_AUDIO');

-- CreateEnum
CREATE TYPE "MediaUploadStatus" AS ENUM ('PENDING', 'VERIFIED', 'ATTACHED', 'EXPIRED');

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "publicId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "status" "MediaUploadStatus" NOT NULL DEFAULT 'PENDING',
    "secureUrl" TEXT,
    "format" TEXT,
    "bytes" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_publicId_key" ON "MediaUpload"("publicId");

-- CreateIndex
CREATE INDEX "MediaUpload_userId_status_idx" ON "MediaUpload"("userId", "status");

-- CreateIndex
CREATE INDEX "MediaUpload_expiresAt_idx" ON "MediaUpload"("expiresAt");

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
