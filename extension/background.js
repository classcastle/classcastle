// API compatibility shim for Chrome and Firefox
const api = globalThis.browser ?? globalThis.chrome;

// Detect manifest version
const isManifestV3 = api.runtime.getManifest().manifest_version === 3;

// Supabase configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Supabase client (will be loaded dynamically)
let SupabaseClient = null;

// Initialize Supabase client
async function initSupabase() {
  if (SupabaseClient) return SupabaseClient;
  
  try {
    // Try loading from local file (Chrome service worker)
    if (isManifestV3) {
      importScripts('supabase.min.js');
      if (typeof supabase !== 'undefined') {
        SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('Supabase loaded from local file (manifest v3)');
      } else {
        console.log('supabase not defined after importScripts (manifest v3)');
      }
    } else {
      // Firefox manifest v2 - importScripts doesn't work in event pages
      // Load Supabase from CDN using fetch and eval
      console.log('Loading Supabase from CDN for Firefox');
      try {
        const response = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
        const scriptText = await response.text();
        // Use Function constructor to eval the script
        const loadSupabase = new Function(scriptText + '; return supabase;');
        const supabase = loadSupabase();
        if (typeof supabase !== 'undefined') {
          SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
          console.log('Supabase loaded from CDN (manifest v2)');
        } else {
          console.log('supabase not defined after CDN load (manifest v2)');
        }
      } catch (cdnError) {
        console.log('Failed to load Supabase from CDN:', cdnError);
      }
    }
  } catch (e) {
    console.log('Supabase initialization failed:', e);
  }
  
  if (!SupabaseClient) {
    console.log('Supabase not available, will rely on polling only');
  }
  
  return SupabaseClient;
}

// Constants
const ALARM_NAME = 'pollForChanges';
const ALARM_INTERVAL_MINUTES = 0.33; // ~20 seconds

// Storage keys
const STORAGE_KEYS = {
  roomId: 'roomId',
  studentId: 'studentId',
  studentName: 'studentName',
  currentTargetUrl: 'currentTargetUrl',
  joinedAt: 'joinedAt',
  wasKicked: 'wasKicked',
  joiningSince: 'joiningSince',
  tabId: 'tabId'
};

// Constants
const KICK_GRACE_PERIOD_MS = 60000; // 1 minute grace period for joins
const JOIN_TIMEOUT_MS = 120000; // 2 minutes for join to complete

// Listen for messages from popup and content scripts
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log('Background received message:', request.action, request);
    
    if (request.action === 'joinRoom') {
      return joinRoom(request.roomId, request.studentId, request.studentName)
        .then(() => ({ success: true }))
        .catch(err => {
          console.error('joinRoom error:', err);
          return { success: false, error: err.message };
        });
    } else if (request.action === 'studentJoined') {
      // Student joined via join.html content script, start subscription
      console.log('Student joined message received:', request);
      return joinRoom(request.roomId, request.studentId, request.studentName)
        .then(() => {
          // Notify popup of status change
          api.runtime.sendMessage({
            action: 'statusUpdate',
            joined: true
          }).catch(err => {
            console.log('Failed to notify popup (popup may be closed):', err);
          });
          return { success: true };
        })
        .catch(err => {
          console.error('studentJoined error:', err);
          return { success: false, error: err.message };
        });
    } else if (request.action === 'leaveRoom') {
      return leaveRoom()
        .then(() => {
          // Notify popup of status change
          api.runtime.sendMessage({
            action: 'statusUpdate',
            joined: false
          }).catch(err => {
            console.log('Failed to notify popup (popup may be closed):', err);
          });
          return { success: true };
        })
        .catch(err => {
          console.error('leaveRoom error:', err);
          return { success: false, error: err.message };
        });
    } else if (request === 'getStatus') {
      // Handle legacy 'getStatus' message (without request.action)
      return getStorageData().then(data => ({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId,
        studentName: data.studentName
      }));
    } else if (request.action === 'getStatus') {
      return getStorageData().then(data => ({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId,
        studentName: data.studentName
      }));
    }
    
    // Synchronous responses (none currently)
    return Promise.resolve({ success: false, error: 'Unknown action' });
  } catch (e) {
    console.error('Error in message listener:', e);
    return Promise.resolve({ success: false, error: e.message });
  }
});

// Get storage data
async function getStorageData() {
  return new Promise((resolve) => {
    try {
      api.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
        resolve({
          roomId: result.roomId || null,
          studentId: result.studentId || null,
          studentName: result.studentName || null,
          currentTargetUrl: result.currentTargetUrl || null,
          joinedAt: result.joinedAt || null,
          wasKicked: result.wasKicked || false,
          joiningSince: result.joiningSince || null,
          tabId: result.tabId || null
        });
      });
    } catch (e) {
      console.error('Error getting storage data:', e);
      resolve({
        roomId: null,
        studentId: null,
        studentName: null,
        currentTargetUrl: null,
        joinedAt: null,
        wasKicked: false,
        joiningSince: null,
        tabId: null
      });
    }
  });
}

// Save storage data
async function saveStorageData(data) {
  return new Promise((resolve) => {
    try {
      api.storage.local.set(data, () => resolve());
    } catch (e) {
      console.error('Error saving storage data:', e);
      resolve();
    }
  });
}

// Join a room
async function joinRoom(roomId, studentId, studentName) {
  console.log('Joining room:', roomId, 'student:', studentId, 'name:', studentName);

  // Save to storage with joining timestamp
  await saveStorageData({
    roomId: roomId,
    studentId: studentId,
    studentName: studentName,
    currentTargetUrl: null,
    joinedAt: null, // Will be set when subscription confirms
    joiningSince: Date.now(),
    tabId: null
  });

  // Start alarm-based polling
  startAlarm();

  // Subscribe to room updates (best-effort fast path)
  await subscribeToRoom(roomId, studentId);
  
  console.log('joinRoom completed successfully');
}

// Handle being kicked by the teacher
async function handleKicked() {
  const data = await getStorageData();

  if (data.roomId && data.studentId) {
    await unsubscribeFromRoom(data.roomId, data.studentId);
  }

  await api.alarms.clear(ALARM_NAME);

  await saveStorageData({
    roomId: null,
    studentId: null,
    studentName: null,
    currentTargetUrl: null,
    joinedAt: null,
    wasKicked: true,
    joiningSince: null,
    tabId: null
  });

  api.runtime.sendMessage({
    action: 'kicked'
  }).catch(err => {
    console.log('Failed to notify popup of kick (popup may be closed):', err);
  });
  
  console.log('User kicked and cleaned up');
}

// Leave the current room
async function leaveRoom() {
  console.log('Leaving room');
  
  // Unsubscribe from room
  const data = await getStorageData();
  if (data.roomId && data.studentId) {
    await unsubscribeFromRoom(data.roomId, data.studentId);
  }

  // Stop alarm
  await api.alarms.clear(ALARM_NAME);

  // Clear storage
  await saveStorageData({
    roomId: null,
    studentId: null,
    studentName: null,
    currentTargetUrl: null,
    joinedAt: null,
    wasKicked: false,
    joiningSince: null,
    tabId: null
  });
  
  console.log('Room left successfully');
}

// Subscribe to room updates (best-effort fast path)
let subscription = null;

async function subscribeToRoom(roomId, studentId) {
  if (!roomId || !studentId) return;

  console.log('Subscribing to room:', roomId, 'student:', studentId);

  await initSupabase();
  if (!SupabaseClient) {
    console.log('Supabase not available, will rely on polling only');
    // Mark as joined anyway since we can still poll
    await saveStorageData({ joinedAt: Date.now() });
    return;
  }

  // Unsubscribe from existing subscription
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }

  // Subscribe to room updates
  subscription = SupabaseClient
    .channel(`student:${studentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      console.log('Room update received via subscription:', payload);
      // Check if target_url changed
      if (payload.new && payload.new.target_url) {
        if (!payload.old || payload.new.target_url !== payload.old.target_url) {
          console.log('Target URL changed via subscription to:', payload.new.target_url);
          saveStorageData({ currentTargetUrl: payload.new.target_url });
          navigateToUrl(payload.new.target_url, studentId);
        }
      }
    })
    .on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'students',
      filter: `id=eq.${studentId}`
    }, (payload) => {
      // Teacher removed this student's row -- treat as a kick
      console.log('Student row deleted (kicked):', payload);
      handleKicked();
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to room updates');
        // Mark as fully joined when subscription confirms
        saveStorageData({
          joinedAt: Date.now()
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.error('Subscription failed, will retry on next alarm');
        // Still mark as joined so polling works
        saveStorageData({
          joinedAt: Date.now()
        });
      }
    });
}

async function unsubscribeFromRoom(roomId, studentId) {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
  console.log('Unsubscribed from room');
}

// Alarm handler - called every ~20 seconds
api.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARM_NAME) {
      await handleAlarm();
    }
  } catch (e) {
    console.error('Error in alarm handler:', e);
  }
});

async function handleAlarm() {
  const data = await getStorageData();

  if (!data.roomId || !data.studentId) {
    // Not joined, no need to poll
    return;
  }

  console.log('Alarm fired, checking for changes:', data);

  // Check whether this student's row still exists (teacher may have kicked them)
  // But only after a grace period to avoid race conditions during join
  const timeSinceJoin = data.joinedAt ? Date.now() - data.joinedAt : Infinity;
  if (timeSinceJoin > KICK_GRACE_PERIOD_MS) {
    try {
      await initSupabase();
      if (SupabaseClient) {
        const { data: student, error: studentError } = await SupabaseClient
          .from('students')
          .select('id')
          .eq('id', data.studentId)
          .single();

        if (studentError || !student) {
          console.log('Student row missing, treating as kicked');
          await handleKicked();
          return;
        }
      }
    } catch (error) {
      console.error('Error checking kick status:', error);
    }
  } else {
    console.log('Within grace period, skipping kick check');
  }

  // Poll for URL changes
  try {
    await initSupabase();
    if (SupabaseClient) {
      const { data: room } = await SupabaseClient
        .from('rooms')
        .select('target_url')
        .eq('id', data.roomId)
        .single();

      console.log('Poll for URL changes - room data:', room);
      console.log('Current target_url in storage:', data.currentTargetUrl);
      console.log('Room target_url from DB:', room?.target_url);

      if (room && room.target_url && room.target_url !== data.currentTargetUrl) {
        console.log('Poll detected URL change:', room.target_url);
        await saveStorageData({ currentTargetUrl: room.target_url });
        navigateToUrl(room.target_url, data.studentId);
      } else if (room && room.target_url && room.target_url === data.currentTargetUrl) {
        console.log('URL already set to:', room.target_url);
      } else {
        console.log('No target_url set in room yet');
      }
    }
  } catch (error) {
    console.error('Error polling for URL changes:', error);
  }

  // Update online status and last_seen
  try {
    await initSupabase();
    if (SupabaseClient) {
      await SupabaseClient
        .from('students')
        .update({
          online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', data.studentId);
    }
  } catch (error) {
    console.error('Error updating online status:', error);
  }
}

// Navigate to a new URL, reusing the tab if possible
async function navigateToUrl(url, studentId) {
  if (!url) {
    console.log('navigateToUrl called with no URL, skipping');
    return;
  }

  console.log('Navigating to URL:', url, 'for student:', studentId);

  try {
    const data = await getStorageData();
    console.log('Current storage data for navigation:', data);
    
    // Try to reuse existing tab
    if (data.tabId) {
      try {
        const tab = await api.tabs.get(data.tabId);
        console.log('Existing tab found:', tab.id, 'discarded:', tab.discarded);
        if (tab && !tab.discarded) {
          console.log('Reusing existing tab:', data.tabId);
          await api.tabs.update(data.tabId, { url: url });
          // Update student's current_url in the database
          await initSupabase();
          if (SupabaseClient) {
            await SupabaseClient
              .from('students')
              .update({
                current_url: url,
                last_seen: new Date().toISOString()
              })
              .eq('id', studentId);
          }
          return;
        }
      } catch (e) {
        console.log('Existing tab not reusable, creating new one:', e);
      }
    }

    // Create new tab and track it
    console.log('Creating new tab for URL:', url);
    const tab = await api.tabs.create({ url: url });
    console.log('Created new tab:', tab.id, 'for URL:', url);
    await saveStorageData({ tabId: tab.id });

    // Update student's current_url in the database
    await initSupabase();
    if (SupabaseClient) {
      await SupabaseClient
        .from('students')
        .update({
          current_url: url,
          last_seen: new Date().toISOString()
        })
        .eq('id', studentId);
    }
  } catch (error) {
    console.error('Error navigating to URL:', error);
  }
}

// Start alarm-based polling
function startAlarm() {
  console.log('Starting alarm for polling');
  api.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_INTERVAL_MINUTES
  });
}

// Initialize - check storage and start alarm if joined
try {
  api.storage.local.get(['roomId', 'studentId'], (result) => {
    if (result.roomId && result.studentId) {
      console.log('Found existing session, starting alarm');
      startAlarm();
      subscribeToRoom(result.roomId, result.studentId);
    }
  });
} catch (e) {
  console.error('Error during initialization:', e);
}

// Listen for external messages from join.html (Chrome only, via externally_connectable)
// Firefox uses content script instead
if (isManifestV3) {
  try {
    api.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
      try {
        console.log('External message received from:', sender.url, 'action:', request.action);
        
        const allowedOrigins = ['https://classcastle.org', 'https://www.classcastle.org'];
        const senderOrigin = new URL(sender.url).origin;
        
        if (allowedOrigins.includes(senderOrigin)) {
          if (request.action === 'studentJoined') {
            console.log('External studentJoined message received:', request);
            joinRoom(request.roomId, request.studentId, request.studentName).then(() => {
              // Notify popup of status change
              api.runtime.sendMessage({
                action: 'statusUpdate',
                joined: true
              }).catch(err => {
                console.log('Failed to notify popup (popup may be closed):', err);
              });
              sendResponse({ success: true });
            }).catch(err => {
              console.error('studentJoined error:', err);
              sendResponse({ success: false, error: err.message });
            });
            return true; // async response for Chrome
          }
        } else {
          console.log('External message from unauthorized origin:', senderOrigin);
          sendResponse({ success: false, error: 'Unauthorized origin' });
        }
        
        return false;
      } catch (e) {
        console.error('Error in external message listener:', e);
        sendResponse({ success: false, error: e.message });
        return false;
      }
    });
  } catch (e) {
    console.error('Error setting up external message listener:', e);
  }
}
