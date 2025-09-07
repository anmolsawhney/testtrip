-- Rename the column from display_name to username
ALTER TABLE "public"."profiles" RENAME COLUMN "display_name" TO "username";

-- Adjust column length
ALTER TABLE "public"."profiles" ALTER COLUMN "username" TYPE varchar(30);

-- Add first_name and last_name columns
ALTER TABLE "public"."profiles" ADD COLUMN "first_name" text;
ALTER TABLE "public"."profiles" ADD COLUMN "last_name" text;

-- Backfill existing data with placeholder values (optional but recommended)
UPDATE "public"."profiles" SET "first_name" = 'User' WHERE "first_name" IS NULL;
UPDATE "public"."profiles" SET "last_name" = 'Name' WHERE "last_name" IS NULL;

-- Now, make the columns NOT NULL
ALTER TABLE "public"."profiles" ALTER COLUMN "first_name" SET NOT NULL;
ALTER TABLE "public"."profiles" ALTER COLUMN "last_name" SET NOT NULL;

-- Add a unique constraint to the username column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_username_key' AND conrelid = 'profiles'::regclass
    ) THEN
        ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
    END IF;
END $$;

-- Drop the old default value if it exists
ALTER TABLE "public"."profiles" ALTER COLUMN "username" DROP DEFAULT;