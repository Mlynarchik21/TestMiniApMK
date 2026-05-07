-- Migration: add vipExpiresAt to Subscription
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "vipExpiresAt" TIMESTAMP(3);
