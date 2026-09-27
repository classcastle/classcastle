// Supabase configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Load Supabase from local file
importScripts('supabase.min.js');

const SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Constants
const ALARM_NAME = 'pollForChanges';
const ALARM_INTERVAL_MINUTES = 0.33; // ~20 seconds

// Storage keys
const STORAGE_KEYS = {
  roomId: 'roomId',
  studentId: 'studentId',
  currentTargetUrl: 'currentTargetUrl'
};

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'joinRoom') {
    joinRoom(request.roomId, request.studentId);
  } else if (request.action === 'studentJoined') {
    // Student joined via join.html, start subscription
    console.log('Student joined message received:', request);
    joinRoom(request.roomId, request.studentId);
    // Notify popup of status change
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      joined: true
    }).catch(err => {
      console.log('Failed to notify popup (popup may be closed):', err);
    });
    sendResponse({ success: true });
  } else if (request.action === 'leaveRoom') {
    leaveRoom();
    // Notify popup of status change
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      joined: false
    }).catch(err => {
      console.log('Failed to notify popup (popup may be closed):', err);
    });
  } else if (request === 'getStatus') {
    // Handle legacy 'getStatus' message (without request.action)
    getStorageData().then(data => {
      sendResponse({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId
      });
    });
    return true;
  } else if (request.action === 'getStatus') {
    getStorageData().then(data => {
      sendResponse({
        joined: data.roomId !== null && data.studentId !== null,
        roomId: data.roomId,
        studentId: data.studentId
      });
    });
    return true;
  }
  return true;
});

// Get storage data
async function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(Object.values(STORAGE_KEYS), (result) => {
      resolve({
        roomId: result.roomId || null,
        studentId: result.studentId || null,
        currentTargetUrl: result.currentTargetUrl || null
      });
    });
  });
}

// Save storage data
async function saveStorageData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => resolve());
  });
}

// Join a room
async function joinRoom(roomId, studentId) {
  console.log('Joining room:', roomId, 'student:', studentId);

  // Save to storage
  await saveStorageData({
    roomId: roomId,
    studentId: studentId,
    currentTargetUrl: null
  });

  // Start alarm-based polling
  startAlarm();

  // Subscribe to room updates (best-effort fast path)
  subscribeToRoom(roomId, studentId);
}

// Leave the current room
async function leaveRoom() {
  // Unsubscribe from room
  const data = await getStorageData();
  if (data.roomId && data.studentId) {
    unsubscribeFromRoom(data.roomId, data.studentId);
  }

  // Stop alarm
  chrome.alarms.clear(ALARM_NAME);

  // Clear storage
  await saveStorageData({
    roomId: null,
    studentId: null,
    currentTargetUrl: null
  });
}

// Subscribe to room updates (best-effort fast path)
let subscription = null;

function subscribeToRoom(roomId, studentId) {
  if (!roomId || !studentId) return;

  console.log('Subscribing to room:', roomId, 'student:', studentId);

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
          saveStorageData({ currentTargetUrl: payload.new.targetUrl });
          navigateToUrl(payload.new.target_url, studentId);
        }
      }
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to room updates');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.error('Subscription failed, will retry on next alarm');
      }
    });
}

function unsubscribeFromRoom(roomId, studentId) {
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }
}

// Alarm handler - called every ~20 seconds
chrome.alarms.onAlarm.addListener(async (alarm) => {
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

  // Poll for URL changes
  try {
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
  } catch (error) {
    console.error('Error polling for URL changes:', error);
  }

  // Update online status and last_seen
  try {
    await SupabaseClient
      .from('students')
      .update({
        online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', data.studentId);
  } catch (error) {
    console.error('Error updating online status:', error);
  }
}

// Start alarm-based polling
function startAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_INTERVAL_MINUTES
  });
}

// Initialize - check storage and start alarm if joined
chrome.storage.local.get(['roomId', 'studentId'], (result) => {
  if (result.roomId && result.studentId) {
    console.log('Found existing session, starting alarm');
    startAlarm();
    subscribeToRoom(result.roomId, result.studentId);
  }
});

// Listen for external messages from join.html
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (sender.url && sender.url.startsWith('https://classcastle.org')) {
    if (request.action === 'studentJoined') {
      console.log('External studentJoined message received:', request);
      joinRoom(request.roomId, request.studentId);
      // Notify popup of status change
      chrome.runtime.sendMessage({
        action: 'statusUpdate',
        joined: true
      }).catch(err => {
        console.log('Failed to notify popup (popup may be closed):', err);
      });
      sendResponse({ success: true });
    }
  }
  return true;
});
