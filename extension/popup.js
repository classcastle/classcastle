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

// Check current status
checkStatus();

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

  // Get the active tab and navigate to join page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, { url: joinUrl }, () => {
        // Don't close popup, keep it open with loading state
      });
    }
  });
}

// Handle cancel
function handleCancel() {
  hideLoading();
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
