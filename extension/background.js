// API compatibility shim for Chrome and Firefox
const api = globalThis.browser ?? globalThis.chrome;

// Detect manifest version
const isManifestV3 = api.runtime.getManifest().manifest_version === 3;

// Supabase configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Maintenance API
const MAINTENANCE_API_URL = 'https://maintenanceapi.classcastle.org/';

// Constants
const ALARM_NAME = 'pollForChanges';
const ALARM_INTERVAL_MINUTES = 0.05; // 3 seconds

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
const KICK_GRACE_PERIOD_MS = 5000; // 5 seconds grace period for joins
const JOIN_TIMEOUT_MS = 120000; // 2 minutes for join to complete

// Direct Supabase REST API calls (no library needed, bypasses CSP)
async function supabaseGet(table, filters = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.append('apikey', SUPABASE_KEY);
  
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.append(key, `eq.${value}`);
  }
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

async function supabaseInsert(table, data) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.append('apikey', SUPABASE_KEY);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}

async function supabaseUpdate(table, data, filters = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.append('apikey', SUPABASE_KEY);
  
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.append(key, `eq.${value}`);
  }
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  
  return response.json();
}

async function supabaseDelete(table, filters = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  url.searchParams.append('apikey', SUPABASE_KEY);
  
  for (const [key, value] of Object.entries(filters)) {
    url.searchParams.append(key, `eq.${value}`);
  }
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  
  return response.ok;
}

// Check maintenance mode
async function isInMaintenance() {
  try {
    const response = await fetch(MAINTENANCE_API_URL);
    const data = await response.json();
    return { maintenance: data.maintenance === true, message: data.message };
  } catch (error) {
    console.error('Error checking maintenance mode:', error);
    // If we can't check, assume not in maintenance to avoid blocking users
    return { maintenance: false, message: null };
  }
}

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

  // Check maintenance mode
  const maintenanceStatus = await isInMaintenance();
  if (maintenanceStatus.maintenance) {
    console.log('Maintenance mode is active, blocking join');
    await saveStorageData({
      roomId: null,
      studentId: null,
      studentName: null,
      currentTargetUrl: null,
      joinedAt: null,
      wasKicked: false,
      joiningSince: null,
      tabId: null,
      inMaintenance: true,
      maintenanceMessage: maintenanceStatus.message
    });
    api.runtime.sendMessage({
      action: 'maintenance',
      message: maintenanceStatus.message
    }).catch(err => {
      console.log('Failed to notify popup of maintenance (popup may be closed):', err);
    });
    return;
  }

  // Fetch current room target_url to avoid navigating to pre-existing URLs
  let initialTargetUrl = null;
  try {
    const room = await supabaseGet('rooms', { id: roomId });
    if (room && room.target_url) {
      initialTargetUrl = room.target_url;
      console.log('Room has existing target_url, will use as baseline:', initialTargetUrl);
    }
  } catch (error) {
    console.error('Error fetching room for initial target_url:', error);
  }

  // Save to storage with joining timestamp and initial target_url
  await saveStorageData({
    roomId: roomId,
    studentId: studentId,
    studentName: studentName,
    currentTargetUrl: initialTargetUrl, // Initialize to room's current URL to avoid re-navigating
    joinedAt: null, // Will be set when subscription confirms
    joiningSince: Date.now(),
    tabId: null
  });

  // Start alarm-based polling
  startAlarm();

  // Mark as joined (no realtime subscription with REST API)
  await saveStorageData({ joinedAt: Date.now() });
  
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
// Note: With REST API, we can't do realtime subscriptions, so we rely entirely on polling
async function subscribeToRoom(roomId, studentId) {
  if (!roomId || !studentId) return;

  console.log('Subscribing to room (polling only):', roomId, 'student:', studentId);
  // Mark as joined
  await saveStorageData({ joinedAt: Date.now() });
}

async function unsubscribeFromRoom(roomId, studentId) {
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
  console.log('Time since join:', timeSinceJoin, 'Grace period:', KICK_GRACE_PERIOD_MS);
  
  if (timeSinceJoin > KICK_GRACE_PERIOD_MS) {
    try {
      console.log('Checking if student still exists in database:', data.studentId);
      const student = await supabaseGet('students', { id: data.studentId });
      console.log('Student query result:', student);

      if (!student) {
        console.log('Student row missing, treating as kicked');
        await handleKicked();
        return;
      } else {
        console.log('Student still exists, not kicked');
      }
    } catch (error) {
      console.error('Error checking kick status:', error);
    }
  } else {
    console.log('Within grace period, skipping kick check');
  }

  // Poll for URL changes
  try {
    const room = await supabaseGet('rooms', { id: data.roomId });

    console.log('Poll for URL changes - room data:', room);
    console.log('Current target_url in storage:', data.currentTargetUrl);
    console.log('Room target_url from DB:', room?.target_url);

    if (room && room.target_url) {
      // Check if we should navigate
      let shouldNavigate = false;
      
      if (room.target_url !== data.currentTargetUrl) {
        console.log('URL changed:', room.target_url);
        shouldNavigate = true;
      } else {
        // URL is the same, but check if the tab still exists and is on that URL
        if (data.tabId) {
          try {
            const tab = await api.tabs.get(data.tabId);
            if (tab && !tab.discarded && tab.url === room.target_url) {
              console.log('Tab already on target URL, skipping navigation');
            } else {
              console.log('Tab not on target URL or discarded, will navigate');
              shouldNavigate = true;
            }
          } catch (e) {
            console.log('Tab not found, will navigate');
            shouldNavigate = true;
          }
        } else {
          console.log('No tab tracked, will navigate');
          shouldNavigate = true;
        }
      }
      
      if (shouldNavigate) {
        await saveStorageData({ currentTargetUrl: room.target_url });
        navigateToUrl(room.target_url, data.studentId);
      }
    } else {
      console.log('No target_url set in room yet');
    }
  } catch (error) {
    console.error('Error polling for URL changes:', error);
  }

  // Update online status and last_seen
  try {
    await supabaseUpdate('students', {
      online: true,
      last_seen: new Date().toISOString()
    }, { id: data.studentId });
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
          await api.tabs.update(data.tabId, { url: url, active: true });
          // Update student's current_url in the database
          await supabaseUpdate('students', {
            current_url: url,
            last_seen: new Date().toISOString()
          }, { id: studentId });
          return;
        }
      } catch (e) {
        console.log('Existing tab not reusable, creating new one:', e);
      }
    }

    // Create new tab and track it
    console.log('Creating new tab for URL:', url);
    const tab = await api.tabs.create({ url: url, active: true });
    console.log('Created new tab:', tab.id, 'for URL:', url);
    await saveStorageData({ tabId: tab.id });

    // Update student's current_url in the database
    await supabaseUpdate('students', {
      current_url: url,
      last_seen: new Date().toISOString()
    }, { id: studentId });
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
