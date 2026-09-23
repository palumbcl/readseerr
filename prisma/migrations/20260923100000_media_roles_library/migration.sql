-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "altTitles" TEXT,
    "year" INTEGER,
    "coverUrl" TEXT,
    "volumeCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "komgaSeriesId" TEXT,
    "availableAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LibrarySeries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "titles" TEXT NOT NULL,
    "year" INTEGER,
    "booksCount" INTEGER NOT NULL,
    "syncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill : une œuvre par couple (mediaType, externalId), titre et couverture de la demande la plus récente
INSERT INTO "Media" ("id", "mediaType", "externalId", "title", "coverUrl", "createdAt", "updatedAt")
SELECT 'm' || lower(hex(randomblob(12))), "mediaType", "externalId", "title", "coverUrl", MIN("createdAt"), CURRENT_TIMESTAMP
FROM (
    SELECT "mediaType", "externalId", "title", "coverUrl", "createdAt", MAX("createdAt") OVER (PARTITION BY "mediaType", "externalId") AS "latest"
    FROM "Request"
)
WHERE "createdAt" = "latest"
GROUP BY "mediaType", "externalId";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Request" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverUrl" TEXT,
    "volumes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "declineReason" TEXT,
    "handledById" TEXT,
    "handledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Request_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Request_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Anciens statuts : success -> available, sent -> approved, error -> pending
INSERT INTO "new_Request" ("coverUrl", "createdAt", "externalId", "id", "mediaId", "mediaType", "status", "title", "updatedAt", "userId", "volumes")
SELECT r."coverUrl", r."createdAt", r."externalId", r."id", m."id", r."mediaType",
    CASE r."status" WHEN 'success' THEN 'available' WHEN 'sent' THEN 'approved' WHEN 'error' THEN 'pending' ELSE r."status" END,
    r."title", r."updatedAt", r."userId", r."volumes"
FROM "Request" r
JOIN "Media" m ON m."mediaType" = r."mediaType" AND m."externalId" = r."externalId";
DROP TABLE "Request";
ALTER TABLE "new_Request" RENAME TO "Request";
CREATE INDEX "Request_userId_idx" ON "Request"("userId");
CREATE INDEX "Request_mediaId_idx" ON "Request"("mediaId");
CREATE INDEX "Request_status_idx" ON "Request"("status");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "image", "name", "passwordHash") SELECT "createdAt", "email", "emailVerified", "id", "image", "name", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Media_status_idx" ON "Media"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Media_mediaType_externalId_key" ON "Media"("mediaType", "externalId");

-- Statut agrégé de chaque œuvre à partir de ses demandes
UPDATE "Media" SET
    "status" = CASE
        WHEN EXISTS (SELECT 1 FROM "Request" r WHERE r."mediaId" = "Media"."id" AND r."status" = 'available') THEN 'available'
        WHEN EXISTS (SELECT 1 FROM "Request" r WHERE r."mediaId" = "Media"."id" AND r."status" = 'approved') THEN 'processing'
        WHEN EXISTS (SELECT 1 FROM "Request" r WHERE r."mediaId" = "Media"."id" AND r."status" = 'pending') THEN 'pending'
        ELSE 'unknown'
    END,
    "availableAt" = (SELECT MAX(r."updatedAt") FROM "Request" r WHERE r."mediaId" = "Media"."id" AND r."status" = 'available');

-- Premier administrateur : le compte local créé par le seed, sinon le plus ancien compte
UPDATE "User" SET "role" = 'admin' WHERE "email" = 'admin@readseerr.local';
UPDATE "User" SET "role" = 'admin'
WHERE NOT EXISTS (SELECT 1 FROM "User" WHERE "role" = 'admin')
  AND "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
