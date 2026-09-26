// DOM elements
const statusEl = document.getElementById('status');
const joinForm = document.getElementById('joinForm');
const roomIdInput = document.getElementById('roomId');
const studentNameInput = document.getElementById('studentName');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const errorEl = document.getElementById('error');
const loadingEl = document.getElementById('loading');

// Load Supabase
const SUPABASE_URL = 'https://hduyofdbpspjcuwvackd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zI1zwUpMhbnU1cMwRJBTug_or6athhK';

// Initialize extension
const SupabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Check current status
checkStatus();

// Event listeners
joinBtn.addEventListener('click', handleJoin);
leaveBtn.addEventListener('click', handleLeave);

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

  try {
    // Find room by code
    const { data: room, error: roomError } = await SupabaseClient
      .from('rooms')
      .select('id')
      .eq('code', roomId)
      .eq('active', true)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found or closed');
    }

    // Create or find student
    const { data: student, error: studentError } = await SupabaseClient
      .from('students')
      .upsert({
        room_id: room.id,
        name: studentName,
        online: true,
        current_url: null,
        last_seen: new Date().toISOString()
      }, {
        onConflict: 'room_id,name'
      })
      .select()
      .single();

    if (studentError) {
      throw new Error('Error joining room');
    }

    // Join room in background script
    chrome.runtime.sendMessage({
      action: 'joinRoom',
      roomId: room.id,
      studentId: student.id
    }, () => {
      hideLoading();
      showJoinedState();
    });

  } catch (error) {
    console.error('Error joining room:', error);
    hideLoading();
    showJoinForm();
    showError(error.message || 'Error joining room');
  }
}

// Handle leave room
function handleLeave() {
  chrome.runtime.sendMessage({ action: 'leaveRoom' }, () => {
    showJoinForm();
    roomIdInput.value = '';
    studentNameInput.value = '';
  });
}
