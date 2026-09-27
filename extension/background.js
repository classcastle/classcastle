// Supabase configuration
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Load Supabase from local file
importScripts('supabase.min.js');

const SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Extension state
let currentRoomId = null;
let currentStudentId = null;
let subscription = null;

// Initialize extension
chrome.storage.local.get(['roomId', 'studentId'], (result) => {
  if (result.roomId && result.studentId) {
    currentRoomId = result.roomId;
    currentStudentId = result.studentId;
    subscribeToRoom();
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'joinRoom') {
    joinRoom(request.roomId, request.studentId);
  } else if (request.action === 'studentJoined') {
    // Student joined via join.html, update background script
    joinRoom(request.roomId, request.studentId);
    // Notify popup of status change
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      joined: true
    });
    sendResponse({ success: true });
  } else if (request.action === 'leaveRoom') {
    leaveRoom();
    // Notify popup of status change
    chrome.runtime.sendMessage({
      action: 'statusUpdate',
      joined: false
    });
  } else if (request.action === 'getStatus') {
    sendResponse({
      joined: currentRoomId !== null,
      roomId: currentRoomId,
      studentId: currentStudentId
    });
  }
  return true;
});

// Join a room
async function joinRoom(roomId, studentId) {
  currentRoomId = roomId;
  currentStudentId = studentId;

  // Save to storage
  chrome.storage.local.set({
    roomId: roomId,
    studentId: studentId
  });

  // Subscribe to room updates
  subscribeToRoom();
}

// Leave the current room
async function leaveRoom() {
  // Unsubscribe from room
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }

  // Clear storage
  chrome.storage.local.remove(['roomId', 'studentId']);

  currentRoomId = null;
  currentStudentId = null;
}

// Subscribe to room updates
function subscribeToRoom() {
  if (!currentRoomId || !currentStudentId) return;

  console.log('Subscribing to room:', currentRoomId, 'student:', currentStudentId);

  // Unsubscribe from existing subscription
  if (subscription) {
    subscription.unsubscribe();
    subscription = null;
  }

  // Subscribe to room updates
  subscription = SupabaseClient
    .channel(`student:${currentStudentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${currentRoomId}`
    }, (payload) => {
      console.log('Room update received:', payload);
      // Check if target_url changed
      if (payload.new && payload.new.target_url) {
        if (!payload.old || payload.new.target_url !== payload.old.target_url) {
          console.log('Target URL changed to:', payload.new.target_url);
          navigateToUrl(payload.new.target_url);
        }
      }
    })
    .subscribe((status) => {
      console.log('Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to room updates');
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.error('Subscription failed, retrying in 5 seconds...');
        setTimeout(subscribeToRoom, 5000);
      }
    });
}

// Navigate to a URL
async function navigateToUrl(url) {
  if (!url) return;

  console.log('Navigating to URL:', url);

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab) {
      console.log('Navigating tab:', tab.id, 'to:', url);
      // Navigate the tab to the new URL
      await chrome.tabs.update(tab.id, { url: url });

      // Update student's current_url in database
      await SupabaseClient
        .from('students')
        .update({
          current_url: url,
          last_seen: new Date().toISOString()
        })
        .eq('id', currentStudentId);
    } else {
      console.error('No active tab found');
    }
  } catch (error) {
    console.error('Error navigating to URL:', error);
  }
}

// Keep student online status updated
setInterval(async () => {
  if (currentRoomId && currentStudentId) {
    try {
      await SupabaseClient
        .from('students')
        .update({
          online: true,
          last_seen: new Date().toISOString()
        })
        .eq('id', currentStudentId);
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  }
}, 30000); // Every 30 seconds
