/**
 * Appwrite Configuration for Classcastle
 *
 * Replace the Supabase configuration in app.html with this Appwrite configuration.
 *
 * In app.html, replace:
 * <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 *
 * With:
 * <script src="https://cdn.jsdelivr.net/npm/appwrite@13.0.0"></script>
 */

// Appwrite configuration
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1'; // or your self-hosted endpoint
const APPWRITE_PROJECT_ID = 'YOUR_PROJECT_ID';
const APPWRITE_DATABASE_ID = 'classcastle';

// Initialize Appwrite client
const appwriteClient = new Appwrite();

appwriteClient
  .setEndpoint(APPWRITE_ENDPOINT)
  .setProject(APPWRITE_PROJECT_ID);

// Databases API
const databases = appwriteClient.databases;

// Authentication
const account = appwriteClient.account;

// Realtime
const realtime = appwriteClient.realtime;

// ============================================
// EXAMPLE: Replacing Supabase queries with Appwrite
// ============================================

// OLD (Supabase):
// const { data, error } = await SupabaseClient
//   .from('rooms')
//   .select('*')
//   .eq('teacher_id', userId)
//   .eq('active', true);

// NEW (Appwrite):
// const { documents, error } = await databases.listDocuments(
//   APPWRITE_DATABASE_ID,
//   'rooms',
//   [
//     Query.equal('teacher_id', userId),
//     Query.equal('active', true)
//   ]
// );

// ============================================
// EXAMPLE: Real-time subscriptions
// ============================================

// OLD (Supabase):
// const subscription = SupabaseClient
//   .channel('rooms')
//   .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, payload => {
//     console.log('Change received!', payload);
//   })
//   .subscribe();

// NEW (Appwrite):
// const channel = realtime.subscribe(`databases.${APPWRITE_DATABASE_ID}.collections.rooms.documents`);
// channel.on('document.updated', (payload) => {
//   console.log('Document updated:', payload);
// });
// channel.on('document.created', (payload) => {
//   console.log('Document created:', payload);
// });
// channel.on('document.deleted', (payload) => {
//   console.log('Document deleted:', payload);
// });

// ============================================
// EXAMPLE: Authentication
// ============================================

// OLD (Supabase):
// const { data, error } = await SupabaseClient.auth.signInWithOAuth({
//   provider: 'google'
// });

// NEW (Appwrite):
// const session = await account.createOAuth2Session(
//   'google',
//   'https://your-site.com/auth/success',
//   'https://your-site.com/auth/failure'
// );

// ============================================
// EXAMPLE: Creating a document
// ============================================

// OLD (Supabase):
// const { data, error } = await SupabaseClient
//   .from('rooms')
//   .insert([
//     { name: 'Math Class', code: 'ABC123', teacher_id: userId }
//   ]);

// NEW (Appwrite):
// const { document, error } = await databases.createDocument(
//   APPWRITE_DATABASE_ID,
//   'rooms',
//   ID.unique(),
//   {
//     name: 'Math Class',
//     code: 'ABC123',
//     teacher_id: userId,
//     active: true,
//     archived: false,
//     created_at: new Date().toISOString(),
//     updated_at: new Date().toISOString()
//   }
// );

// ============================================
// EXAMPLE: Updating a document
// ============================================

// OLD (Supabase):
// const { data, error } = await SupabaseClient
//   .from('rooms')
//   .update({ name: 'Updated Name' })
//   .eq('id', roomId);

// NEW (Appwrite):
// const { document, error } = await databases.updateDocument(
//   APPWRITE_DATABASE_ID,
//   'rooms',
//   roomId,
//   {
//     name: 'Updated Name',
//     updated_at: new Date().toISOString()
//   }
// );

// ============================================
// EXAMPLE: Deleting a document
// ============================================

// OLD (Supabase):
// const { error } = await SupabaseClient
//   .from('rooms')
//   .delete()
//   .eq('id', roomId);

// NEW (Appwrite):
// const { error } = await databases.deleteDocument(
//   APPWRITE_DATABASE_ID,
//   'rooms',
//   roomId
// );
