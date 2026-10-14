// API compatibility shim for Chrome and Firefox
const api = globalThis.browser ?? globalThis.chrome;

// DOM elements
const statusEl = document.getElementById('status');
const statusIcon = document.getElementById('statusIcon');
const checkIcon = document.getElementById('checkIcon');
const kickedIcon = document.getElementById('kickedIcon');
const statusTitle = document.getElementById('statusTitle');
const statusMessage = document.getElementById('statusMessage');
const joinForm = document.getElementById('joinForm');
const roomIdInput = document.getElementById('roomId');
const studentNameInput = document.getElementById('studentName');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const dismissKickedBtn = document.getElementById('dismissKickedBtn');
const errorEl = document.getElementById('error');
const joiningLoadingEl = document.getElementById('joiningLoading');
const waitingLoadingEl = document.getElementById('waitingLoading');
const cancelBtn = document.getElementById('cancelBtn');
const instructionsEl = document.querySelector('.instructions');

// State machine: 'idle' | 'joining' | 'joined' | 'kicked'
let currentState = 'idle';

// Constants
const JOIN_TIMEOUT_MS = 120000; // 2 minutes

// Render the popup based on current state
function render(state, data = {}) {
  console.log('Rendering state:', state, 'data:', data);
  currentState = state;
  
  // Hide all panels first
  statusEl.classList.remove('active', 'kicked');
  joinForm.classList.add('hidden');
  joiningLoadingEl.classList.remove('show');
  waitingLoadingEl.classList.remove('show');
  errorEl.classList.remove('show');
  instructionsEl.style.display = 'none';
  
  switch (state) {
    case 'idle':
      console.log('Showing idle state (join form)');
      joinForm.classList.remove('hidden');
      joinBtn.style.display = 'block';
      leaveBtn.style.display = 'none';
      instructionsEl.style.display = 'block';
      roomIdInput.disabled = false;
      studentNameInput.disabled = false;
      break;
      
    case 'joining':
      console.log('Showing joining state (waiting)');
      waitingLoadingEl.classList.add('show');
      roomIdInput.disabled = true;
      studentNameInput.disabled = true;
      break;
      
    case 'joined':
      console.log('Showing joined state');
      statusEl.classList.add('active');
      checkIcon.style.display = 'block';
      kickedIcon.style.display = 'none';
      statusTitle.textContent = `You're in the room`;
      statusMessage.textContent = `Room: ${data.roomCode || '...'} | Name: ${data.studentName || '...'}`;
      leaveBtn.style.display = 'block';
      joinForm.classList.add('hidden');
      roomIdInput.disabled = true;
      studentNameInput.disabled = true;
      break;
      
    case 'kicked':
      console.log('Showing kicked state');
      statusEl.classList.add('active', 'kicked');
      checkIcon.style.display = 'none';
      kickedIcon.style.display = 'block';
      statusTitle.textContent = 'You were removed';
      statusMessage.textContent = 'Your teacher removed you from the room';
      leaveBtn.style.display = 'none';
      dismissKickedBtn.style.display = 'block';
      joinForm.classList.add('hidden');
      roomIdInput.value = '';
      studentNameInput.value = '';
      roomIdInput.disabled = false;
      studentNameInput.disabled = false;
      break;
      
    case 'error':
      console.log('Showing error state');
      joinForm.classList.remove('hidden');
      joinBtn.style.display = 'block';
      leaveBtn.style.display = 'none';
      instructionsEl.style.display = 'block';
      roomIdInput.disabled = false;
      studentNameInput.disabled = false;
      errorEl.textContent = data.message || 'An error occurred';
      errorEl.classList.add('show');
      break;
  }
}

// Derive initial state from storage
async function initializeState() {
  console.log('Initializing popup state from storage...');

  const result = await new Promise((resolve) => {
    api.storage.local.get([
      'roomId',
      'studentId',
      'studentName',
      'wasKicked',
      'joiningSince'
    ], resolve);
  });

  console.log('Storage data:', result);

  if (result.wasKicked) {
    console.log('User was kicked, showing kicked state');
    render('kicked');
  } else if (result.roomId && result.studentId) {
    console.log('User is joined, showing joined state');
    render('joined', {
      roomCode: result.roomId?.substring(0, 6), // First 6 chars as code
      studentName: result.studentName
    });
  } else if (result.joiningSince) {
    const timeSinceJoin = Date.now() - result.joiningSince;
    if (timeSinceJoin < JOIN_TIMEOUT_MS) {
      console.log('Join in progress, showing joining state');
      render('joining');
      // Set timeout to expire the joining state
      setTimeout(() => {
        if (currentState === 'joining') {
          console.log('Join timed out, returning to idle');
          api.storage.local.remove(['joiningSince', 'roomId', 'studentId', 'studentName']);
          render('idle');
        }
      }, JOIN_TIMEOUT_MS - timeSinceJoin);
    } else {
      console.log('Join expired, showing idle state');
      api.storage.local.remove(['joiningSince', 'roomId', 'studentId', 'studentName']);
      render('idle');
    }
  } else {
    console.log('User is not joined, showing idle state');
    render('idle');
  }
}

// Listen for storage changes to sync state
api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  
  console.log('Storage changed:', changes);
  
  // Just reinitialize from storage to get the current state
  initializeState();
});

// Listen for status updates from background script
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Popup received message:', request);

  if (request.action === 'statusUpdate') {
    if (request.joined) {
      console.log('Status update: joined');
      // State will be updated via storage listener
    } else {
      console.log('Status update: not joined');
      render('idle');
    }
  } else if (request.action === 'kicked') {
    console.log('Status update: kicked');
    render('kicked');
  }

  // Return true for async response if needed
  return false;
});

// Event listeners
joinBtn.addEventListener('click', handleJoin);
cancelBtn.addEventListener('click', handleCancel);
leaveBtn.addEventListener('click', handleLeave);
dismissKickedBtn.addEventListener('click', handleDismissKicked);

// Handle join room
async function handleJoin() {
  const roomId = roomIdInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!roomId || !studentName) {
    render('error', { message: 'Please enter both room ID and your name' });
    return;
  }

  // Validate room code is exactly 6 digits
  if (!/^\d{6}$/.test(roomId)) {
    render('error', { message: 'Room code must be exactly 6 digits' });
    return;
  }

  console.log('Join requested:', roomId, studentName);

  // Store joining state
  await new Promise((resolve) => {
    api.storage.local.set({
      joiningSince: Date.now(),
      roomId: roomId,
      studentId: null, // Will be set by background
      studentName: studentName
    }, resolve);
  });

  render('joining');

  // Get extension ID
  const extensionId = api.runtime.id;

  // Open join.html on classcastle.org with room code, student name, and extension ID
  const joinUrl = `https://classcastle.org/join.html?code=${encodeURIComponent(roomId)}&name=${encodeURIComponent(studentName)}&from_extension=true&extension_id=${encodeURIComponent(extensionId)}`;

  console.log('Opening join.html:', joinUrl);

  // Create a new tab
  await new Promise((resolve) => {
    api.tabs.create({ url: joinUrl }, (tab) => {
      console.log('Opened join.html in tab:', tab.id);
      resolve();
    });
  });
}

// Handle cancel
async function handleCancel() {
  console.log('Cancel requested');
  
  // Clear joining state
  await new Promise((resolve) => {
    api.storage.local.remove(['joiningSince', 'roomId', 'studentId', 'studentName'], resolve);
  });
  
  render('idle');
}

// Handle leave room
async function handleLeave() {
  console.log('Leave requested');
  
  try {
    const response = await api.runtime.sendMessage({ action: 'leaveRoom' });
    
    if (response && response.success) {
      console.log('Leave successful');
      roomIdInput.value = '';
      studentNameInput.value = '';
      render('idle');
    } else {
      console.log('Leave failed:', response?.error);
      // Fallback: clear storage directly
      await new Promise((resolve) => {
        api.storage.local.remove(['roomId', 'studentId', 'studentName', 'joinedAt', 'tabId'], resolve);
      });
      roomIdInput.value = '';
      studentNameInput.value = '';
      render('idle');
    }
  } catch (error) {
    console.error('Error in handleLeave:', error);
    // Fallback: clear storage directly
    await new Promise((resolve) => {
      api.storage.local.remove(['roomId', 'studentId', 'studentName', 'joinedAt', 'tabId'], resolve);
    });
    roomIdInput.value = '';
    studentNameInput.value = '';
    render('idle');
  }
}

// Handle dismiss kicked notification
async function handleDismissKicked() {
  console.log('Dismiss kicked requested');
  
  await new Promise((resolve) => {
    api.storage.local.set({ wasKicked: false }, resolve);
  });
  
  render('idle');
}

// Initialize on load
initializeState();
