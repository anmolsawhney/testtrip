-- Migration: Add selfie_photo column to profiles table

ALTER TABLE "profiles" ADD COLUMN "selfie_photo" text; -- Add as nullable text column

-- Add final newline