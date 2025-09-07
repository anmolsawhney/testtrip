/**
 * @description
 * Script to manually trigger the data migration from the 'matches' table
 * to the 'follows' table by executing the `migrateMatchesToFollowsAction`.
 *
 * Usage:
 * 1. Ensure DATABASE_URL environment variable is set (e.g., in .env.local or system env).
 * 2. Run using a TypeScript runner like `tsx`: `tsx scripts/run-match-migration.ts`
 *    or compile first (`tsc scripts/run-match-migration.ts`) and run with node (`node scripts/run-match-migration.js`).
 *
 * @notes
 * - This is intended as a ONE-TIME script. Run with caution and ensure backups.
 * - It directly invokes the server action.
 * - Requires necessary environment variables (DATABASE_URL) to be accessible.
 */

import { migrateMatchesToFollowsAction } from "../actions/db/data-migration-actions";
import { config } from "dotenv";
import path from "path";

// Function to load environment variables from .env.local
const loadEnv = () => {
  const envPath = path.resolve(process.cwd(), ".env.local");
  config({ path: envPath });
  console.log(`Loaded environment variables from: ${envPath}`);

  // Check if DATABASE_URL is loaded
  if (!process.env.DATABASE_URL) {
    console.error(
      "Error: DATABASE_URL environment variable is not set. Make sure it's defined in .env.local or your system environment."
    );
    process.exit(1); // Exit with error
  } else {
    console.log("DATABASE_URL is set.");
  }
};

// Main execution function
const runMigration = async () => {
  console.log("--- Running Match to Follow Migration Script ---");

  // Load environment variables first
  loadEnv();

  try {
    // Execute the server action
    const result = await migrateMatchesToFollowsAction();

    // Log the result from the action
    if (result.isSuccess) {
      console.log("\n✅ Migration Successful!");
      console.log(`   Message: ${result.message}`);
      process.exit(0); // Exit successfully
    } else {
      console.error("\n❌ Migration Failed!");
      console.error(`   Message: ${result.message}`);
      process.exit(1); // Exit with error
    }
  } catch (error) {
    console.error("\n❌ An unexpected error occurred during the script execution:");
    console.error(error);
    process.exit(1); // Exit with error
  } finally {
    console.log("--- Migration Script Finished ---");
  }
};

// Run the migration
runMigration();