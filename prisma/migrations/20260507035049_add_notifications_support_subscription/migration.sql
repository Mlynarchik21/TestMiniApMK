-- Add new columns to UserSettings
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "theme" TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifyTradeOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifyTradeClose" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifyBotStop" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifyBotError" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN IF NOT EXISTS "notifySubscription" BOOLEAN NOT NULL DEFAULT true;

-- Create Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'SYSTEM',
    "title"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "read"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create SupportMessage table
CREATE TABLE IF NOT EXISTS "SupportMessage" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "fromUser"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SupportMessage_userId_idx" ON "SupportMessage"("userId");

ALTER TABLE "SupportMessage" DROP CONSTRAINT IF EXISTS "SupportMessage_userId_fkey";
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create Subscription table
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "plan"      TEXT NOT NULL DEFAULT 'free',
    "status"    TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_userId_key" ON "Subscription"("userId");

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
