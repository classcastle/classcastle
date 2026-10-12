/**
 * Supabase to Appwrite Migration Script
 *
 * This script exports data from Supabase and imports it to Appwrite.
 *
 * Prerequisites:
 * - Node.js installed
 * - npm install @supabase/supabase-js node-appwrite
 *
 * Usage:
 * 1. Fill in your configuration below
 * 2. Run: node migrate-to-appwrite.js
 */

const { createClient } = require('@supabase/supabase-js');
const { Client, Databases, ID } = require('node-appwrite');

// ============================================
// CONFIGURATION - Fill in your credentials
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Appwrite Configuration
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1'; // or your self-hosted endpoint
const APPWRITE_PROJECT_ID = 'YOUR_PROJECT_ID';
const APPWRITE_API_KEY = 'YOUR_API_KEY'; // Get from Appwrite Console > API Keys
const APPWRITE_DATABASE_ID = 'classcastle'; // Create this in Appwrite Console

// ============================================
// END CONFIGURATION
// ============================================

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Initialize Appwrite client
const appwrite = new Client()
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID)
  .setKey(APPWRITE_API_KEY);

const databases = new Databases(appwrite);

// Table/Collection mapping
const collections = {
  rooms: 'rooms',
  students: 'students',
  url_history: 'url_history',
  room_templates: 'room_templates',
  url_shortcuts: 'url_shortcuts',
  activity_log: 'activity_log',
  polls: 'polls',
  poll_responses: 'poll_responses'
};

// Migration functions
async function migrateTable(tableName, collectionId) {
  console.log(`\nMigrating ${tableName}...`);

  try {
    // Fetch all data from Supabase
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      console.error(`Error fetching from ${tableName}:`, error);
      return;
    }

    if (!data || data.length === 0) {
      console.log(`No data in ${tableName}, skipping...`);
      return;
    }

    console.log(`Found ${data.length} records in ${tableName}`);

    // Import to Appwrite
    let successCount = 0;
    let errorCount = 0;

    for (const record of data) {
      try {
        // Convert UUID to string for Appwrite
        const document = {
          ...record,
          id: record.id || ID.unique(),
        };

        // Handle arrays (tags, options)
        if (record.tags && !Array.isArray(record.tags)) {
          document.tags = JSON.parse(record.tags);
        }
        if (record.options && !Array.isArray(record.options)) {
          document.options = JSON.parse(record.options);
        }
        if (record.details && typeof record.details === 'string') {
          document.details = JSON.parse(record.details);
        }

        // Handle datetime conversion
        if (record.created_at) {
          document.created_at = new Date(record.created_at).toISOString();
        }
        if (record.updated_at) {
          document.updated_at = new Date(record.updated_at).toISOString();
        }
        if (record.joined_at) {
          document.joined_at = new Date(record.joined_at).toISOString();
        }
        if (record.last_seen) {
          document.last_seen = new Date(record.last_seen).toISOString();
        }
        if (record.pushed_at) {
          document.pushed_at = new Date(record.pushed_at).toISOString();
        }
        if (record.submitted_at) {
          document.submitted_at = new Date(record.submitted_at).toISOString();
        }

        await databases.createDocument(
          APPWRITE_DATABASE_ID,
          collectionId,
          document.id,
          document
        );

        successCount++;
        process.stdout.write('.');
      } catch (error) {
        errorCount++;
        console.error(`\nError importing record ${record.id}:`, error.message);
      }
    }

    console.log(`\nCompleted ${tableName}: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error(`Error migrating ${tableName}:`, error);
  }
}

// Main migration function
async function migrate() {
  console.log('Starting migration from Supabase to Appwrite...\n');
  console.log('Supabase URL:', SUPABASE_URL);
  console.log('Appwrite Endpoint:', APPWRITE_ENDPOINT);
  console.log('Appwrite Project ID:', APPWRITE_PROJECT_ID);
  console.log('Appwrite Database ID:', APPWRITE_DATABASE_ID);

  // Migrate in order (dependencies first)
  await migrateTable('room_templates', collections.room_templates);
  await migrateTable('url_shortcuts', collections.url_shortcuts);
  await migrateTable('rooms', collections.rooms);
  await migrateTable('students', collections.students);
  await migrateTable('url_history', collections.url_history);
  await migrateTable('activity_log', collections.activity_log);
  await migrateTable('polls', collections.polls);
  await migrateTable('poll_responses', collections.poll_responses);

  console.log('\n\nMigration complete!');
}

// Run migration
migrate().catch(console.error);
