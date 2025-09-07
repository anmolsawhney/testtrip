-- Migration: Add date_of_birth and location to profiles table

ALTER TABLE "profiles" ADD COLUMN "date_of_birth" date;
ALTER TABLE "profiles" ADD COLUMN "location" text;

-- Add final newline