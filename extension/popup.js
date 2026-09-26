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
    console.log('Looking for room with code:', roomId);

    // First, check if room exists at all (without active filter)
    const { data: allRooms, error: allRoomsError } = await SupabaseClient
      .from('rooms')
      .select('id, active, code')
      .eq('code', roomId)
      .limit(1);

    console.log('All rooms with this code:', { allRooms, allRoomsError });

    if (allRoomsError) {
      console.error('Room query error:', allRoomsError);
      throw new Error('Error looking up room: ' + allRoomsError.message);
    }

    if (!allRooms || allRooms.length === 0) {
      console.log('No room found with code:', roomId);
      throw new Error('Room not found. Please check the room code with your teacher.');
    }

    const roomData = allRooms[0];
    console.log('Found room:', roomData);

    // Check if room is active
    if (!roomData.active) {
      console.log('Room is closed (active: false)');
      throw new Error('Room is closed. Please ask your teacher to reopen it.');
    }

    const roomIdValue = roomData.id;
    console.log('Room is active, ID:', roomIdValue);

    // Try to insert student
    const { data: student, error: studentError } = await SupabaseClient
      .from('students')
      .insert({
        room_id: roomIdValue,
        name: studentName,
        online: true,
        current_url: null,
        last_seen: new Date().toISOString()
      })
      .select()
      .limit(1);

    if (studentError) {
      console.error('Student insert error:', studentError);
      throw new Error('Error joining room: ' + studentError.message);
    }

    if (!student || student.length === 0) {
      throw new Error('Error joining room');
    }

    const studentId = student[0].id;
    console.log('Created student with ID:', studentId);

    // Join room in background script
    chrome.runtime.sendMessage({
      action: 'joinRoom',
      roomId: roomIdValue,
      studentId: studentId
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
