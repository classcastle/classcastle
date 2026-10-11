// API compatibility shim for Chrome and Firefox
const api = globalThis.browser ?? globalThis.chrome;

// Supabase configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Supabase client (will be loaded dynamically for Firefox)
let SupabaseClient = null;

// Initialize Supabase client
async function initSupabase() {
  if (SupabaseClient) return SupabaseClient;
  
  try {
    // Try loading from local file (Chrome service worker)
    importScripts('supabase.min.js');
    SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('Supabase loaded from local file');
  } catch (e) {
    console.log('importScripts not available, will use fetch-based fallback');
    // For Firefox/event pages, we'll use direct fetch calls instead
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
  console.log('Background received message:', request.action, request);
  
  if (request.action === 'joinRoom') {
    joinRoom(request.roomId, request.studentId, request.studentName).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error('joinRoom error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  } else if (request.action === 'studentJoined') {
    // Student joined via join.html content script, start subscription
    console.log('Student joined message received:', request);
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
    return true; // async response
  } else if (request.action === 'leaveRoom') {
    leaveRoom().then(() => {
      // Notify popup of status change
      api.runtime.sendMessage({
        action: 'statusUpdate',
        joined: false
      }).catch(err => {
        console.log('Failed to notify popup (popup may be closed):', err);
      });
      sendResponse({ success: true });
    }).catch(err => {
      console.error('leaveRoom error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  } else if (request === 'getStatus') {
    // Handle legacy 'getStatus' message (without request.action)
    getStorageData().then(data => {
      sendResponse({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId,
        studentName: data.studentName
      });
    });
    return true; // async response
  } else if (request.action === 'getStatus') {
    getStorageData().then(data => {
      sendResponse({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId,
        studentName: data.studentName
      });
    });
    return true; // async response
  }
  
  // Synchronous responses (none currently)
  return false;
});

// Get storage data
async function getStorageData() {
  return new Promise((resolve) => {
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
  });
}

// Save storage data
async function saveStorageData(data) {
  return new Promise((resolve) => {
    api.storage.local.set(data, () => resolve());
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
      console.log('Room update received:', payload);
      // Check if target_url changed
      if (payload.new && payload.new.target_url) {
        if (!payload.old || payload.new.target_url !== payload.old.target_url) {
          console.log('Target URL changed to:', payload.new.target_url);
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
  if (alarm.name === ALARM_NAME) {
    await handleAlarm();
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

      if (room && room.target_url && room.target_url !== data.currentTargetUrl) {
        console.log('Poll detected URL change:', room.target_url);
        await saveStorageData({ currentTargetUrl: room.target_url });
        navigateToUrl(room.target_url, data.studentId);
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
  if (!url) return;

  console.log('Navigating to URL:', url);

  try {
    const data = await getStorageData();
    
    // Try to reuse existing tab
    if (data.tabId) {
      try {
        const tab = await api.tabs.get(data.tabId);
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
  api.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_INTERVAL_MINUTES
  });
}

// Initialize - check storage and start alarm if joined
api.storage.local.get(['roomId', 'studentId'], (result) => {
  if (result.roomId && result.studentId) {
    console.log('Found existing session, starting alarm');
    startAlarm();
    subscribeToRoom(result.roomId, result.studentId);
  }
});

// Listen for external messages from join.html via content script
api.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
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
      return true; // async response
    }
  } else {
    console.log('External message from unauthorized origin:', senderOrigin);
    sendResponse({ success: false, error: 'Unauthorized origin' });
  }
  
  return false; // synchronous response
});
