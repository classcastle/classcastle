// DOM elements
const statusEl = document.getElementById('status');
const joinForm = document.getElementById('joinForm');
const roomIdInput = document.getElementById('roomId');
const studentNameInput = document.getElementById('studentName');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');
const cancelBtn = document.getElementById('cancelBtn');

// Load Supabase
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Initialize extension
const SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Check current status
checkStatus();

// Listen for status updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'statusUpdate') {
    if (request.joined) {
      showJoinedState();
    } else {
      showJoinForm();
    }
  }
  return true;
});

// Event listeners
joinBtn.addEventListener('click', handleJoin);
leaveBtn.addEventListener('click', handleLeave);
cancelBtn.addEventListener('click', handleCancel);

// Check current extension status
function checkStatus() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.joined) {
      showJoinedState();
    } else {
      showJoinForm();
    }
  });
}

// Show join form
function showJoinForm() {
  statusEl.classList.remove('active');
  joinForm.classList.remove('hidden');
  joinBtn.style.display = 'block';
  leaveBtn.style.display = 'none';
}

// Show joined state
function showJoinedState() {
  statusEl.classList.add('active');
  joinForm.classList.add('hidden');
  leaveBtn.style.display = 'block';
}

// Show loading state
function showLoading() {
  loadingEl.classList.add('show');
  joinForm.classList.add('hidden');
}

// Hide loading state
function hideLoading() {
  loadingEl.classList.remove('show');
}

// Show error
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add('show');
}

// Hide error
function hideError() {
  errorEl.classList.remove('show');
}

// Handle join room
async function handleJoin() {
  const roomId = roomIdInput.value.trim();
  const studentName = studentNameInput.value.trim();

  if (!roomId || !studentName) {
    showError('Please enter both room ID and your name');
    return;
  }

  hideError();
  showLoading();

  // Open join.html on classcastle.org with room code and student name
  const joinUrl = `https://classcastle.org/join.html?code=${encodeURIComponent(roomId)}&name=${encodeURIComponent(studentName)}&from_extension=true`;

  // Create a new tab instead of updating the existing one
  chrome.tabs.create({ url: joinUrl }, () => {
    // Don't close popup, keep it open with loading state
  });
}

// Handle cancel
function handleCancel() {
  hideLoading();
  showJoinForm();
}

// Handle leave room
function handleLeave() {
  // Leave room via background script
  chrome.runtime.sendMessage({ action: 'leaveRoom' });
  showJoinForm();
}

// Handle leave room
function handleLeave() {
  chrome.runtime.sendMessage({ action: 'leaveRoom' }, () => {
    showJoinForm();
    roomIdInput.value = '';
    studentNameInput.value = '';
  });
}
