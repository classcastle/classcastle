# Supabase to Appwrite Migration Guide

## Overview
This guide will help you migrate Classcastle from Supabase to Appwrite.

## Current Supabase Setup

### Database Tables
- `rooms` - Classroom rooms with students
- `students` - Students in rooms
- `url_history` - History of URLs pushed to rooms
- `room_templates` - Reusable room templates
- `url_shortcuts` - Teacher's URL shortcuts
- `activity_log` - Activity tracking
- `polls` - Quick polls feature
- `poll_responses` - Poll student responses

### Key Features
- Row Level Security (RLS) policies
- Real-time subscriptions (rooms, students)
- Triggers (updated_at, last_seen)
- PostgreSQL with UUIDs

## Migration Steps

### Step 1: Set Up Appwrite Project

1. Create a new Appwrite project at [appwrite.io](https://appwrite.io)
2. Note your:
   - Project ID
   - Project Endpoint
   - API Key (with all permissions for migration)

### Step 2: Export Data from Supabase

Use the Supabase CLI to export your data:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref hduyofdbpspjcuwvackd

# Export all data
supabase db dump -f supabase-backup.sql
```

### Step 3: Create Appwrite Databases

In Appwrite Console:
1. Go to Databases
2. Create a database named "classcastle"
3. Create the following collections:

#### rooms
- Attributes:
  - id (string) - Primary key
  - teacher_id (string) - References Appwrite user ID
  - code (string) - Unique
  - name (string)
  - description (string)
  - tags (array of strings)
  - template_id (string)
  - notes (string)
  - target_url (string)
  - active (boolean) - Default: true
  - archived (boolean) - Default: false
  - created_at (datetime)
  - updated_at (datetime)

#### students
- Attributes:
  - id (string) - Primary key
  - room_id (string) - References rooms.id
  - name (string)
  - current_url (string)
  - online (boolean) - Default: true
  - joined_at (datetime)
  - last_seen (datetime)

#### url_history
- Attributes:
  - id (string) - Primary key
  - room_id (string) - References rooms.id
  - url (string)
  - pushed_at (datetime)

#### room_templates
- Attributes:
  - id (string) - Primary key
  - teacher_id (string) - References Appwrite user ID
  - name (string)
  - description (string)
  - default_tags (array of strings)
  - created_at (datetime)

#### url_shortcuts
- Attributes:
  - id (string) - Primary key
  - teacher_id (string) - References Appwrite user ID
  - name (string)
  - url (string)
  - tags (array of strings)
  - created_at (datetime)

#### activity_log
- Attributes:
  - id (string) - Primary key
  - teacher_id (string) - References Appwrite user ID
  - room_id (string) - References rooms.id
  - action (string)
  - details (object/JSON)
  - created_at (datetime)

#### polls
- Attributes:
  - id (string) - Primary key
  - custom_id (string) - Unique
  - teacher_id (string) - References Appwrite user ID
  - question (string)
  - options (array/JSON)
  - school_name (string)
  - school_postcode (string)
  - school_lat (number)
  - school_lon (number)
  - active (boolean) - Default: true
  - created_at (datetime)

#### poll_responses
- Attributes:
  - id (string) - Primary key
  - poll_id (string) - References polls.id
  - student_name (string)
  - selected_option (string)
  - submitted_at (datetime)

### Step 4: Set Up Appwrite Permissions

For each collection, set permissions:
- **Read**: Any (for public rooms/polls) or Role:verified (for authenticated users)
- **Write**: Role:verified (for authenticated users)
- **Delete**: Role:verified (for authenticated users)

Note: Appwrite uses a different permission model than Supabase RLS. You'll need to implement permission checks in your application code.

### Step 5: Import Data to Appwrite

Use the migration script below to import data from Supabase to Appwrite.

### Step 6: Update Application Code

1. Replace Supabase SDK with Appwrite SDK
2. Update all database queries to use Appwrite syntax
3. Replace real-time subscriptions with Appwrite Realtime
4. Update authentication flow
5. Test all features

### Step 7: Cutover

1. Set maintenance mode on (IN_MAINTENANCE = true)
2. Export final data from Supabase
3. Import to Appwrite
4. Update app.html with new Appwrite configuration
5. Disable maintenance mode
6. Monitor for issues

## Key Differences

### Authentication
- **Supabase**: Built-in auth with JWT tokens
- **Appwrite**: Built-in auth with sessions, similar flow but different API

### Real-time
- **Supabase**: PostgreSQL-based Realtime
- **Appwrite**: Custom Realtime API with similar functionality

### Permissions
- **Supabase**: Row Level Security (RLS) in SQL
- **Appwrite**: Permission system in app code (read/write/delete permissions per document)

### Triggers
- **Supabase**: PostgreSQL triggers for updated_at, last_seen
- **Appwrite**: Must implement in application code

## Migration Script

See `migrate-to-appwrite.js` for the automated migration script.

## Rolling Back

If you need to roll back:
1. Set IN_MAINTENANCE = true
2. Restore Supabase data from backup
3. Revert app.html to use Supabase
4. Set IN_MAINTENANCE = false
