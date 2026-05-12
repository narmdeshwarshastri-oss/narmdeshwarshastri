const socket = io();

// DOM elements
const lobby = document.getElementById('lobby');
const callArea = document.getElementById('callArea');
const roomInput = document.getElementById('roomInput');
const startCallBtn = document.getElementById('startCallBtn');
const joinBtn = document.getElementById('joinBtn');
const lobbyMsg = document.getElementById('lobbyMsg');

const waitingOverlay = document.getElementById('waitingOverlay');
const waitingTitle = document.getElementById('waitingTitle');
const shareLinkInput = document.getElementById('shareLink');
const shareCopyBtn = document.getElementById('shareCopyBtn');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenBtn = document.getElementById('screenBtn');
const inviteBtn = document.getElementById('inviteBtn');
const hangupBtn = document.getElementById('hangupBtn');

const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const timerEl = document.getElementById('timer');
const toast = document.getElementById('toast');

// SVG icons for toggle states
const ICONS = {
  micOn: '<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>',
  micOff: '<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM15 11.16L9 5.18V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.16zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>',
  camOn: '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>',
  camOff: '<path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/>'
};

const micIconEl = document.getElementById('micIcon');
const camIconEl = document.getElementById('camIcon');

// State
let localStream = null;
let cameraStream = null;
let peerConnection = null;
let otherUserId = null;
let currentRoom = null;
let isSharingScreen = false;
let callStartTime = null;
let timerInterval = null;

// ICE servers - STUN (free) + TURN (free public relay servers)
// TURN servers help when direct peer connection is blocked by firewall/NAT
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:relay1.expressturn.com:3480',
      username: '000000002067886454',
      credential: 'P/Mh1S+wnJfDh1NKZkQJl1KQy00='
    }
  ],
  iceCandidatePoolSize: 10
};

// ============ Toast ============
function showToast(message, duration = 2000) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

// ============ Auto-detect invite from URL ============
function getRoomFromUrl() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) return hash;
  const params = new URLSearchParams(window.location.search);
  return params.get('room');
}

const startView = document.getElementById('startView');
const inviteView = document.getElementById('inviteView');
const acceptCallBtn = document.getElementById('acceptCallBtn');

let pendingRoomId = null;

window.addEventListener('load', () => {
  const roomFromUrl = getRoomFromUrl();
  if (roomFromUrl) {
    // Receiver clicked an invite link - show invite view, don't auto-join
    pendingRoomId = roomFromUrl;
    startView.classList.add('hidden');
    inviteView.classList.remove('hidden');
  } else {
    startView.classList.remove('hidden');
    inviteView.classList.add('hidden');
  }
});

acceptCallBtn.addEventListener('click', () => {
  if (pendingRoomId) {
    startCall(pendingRoomId);
  }
});

// ============ Buttons ============
startCallBtn.addEventListener('click', () => {
  const roomId = 'call-' + Math.random().toString(36).substring(2, 8);
  startCall(roomId);
});

joinBtn.addEventListener('click', () => {
  let input = roomInput.value.trim();
  if (!input) {
    lobbyMsg.textContent = 'कृपया link या Room ID डालें';
    return;
  }
  // Extract room ID from full URL if pasted
  if (input.includes('#')) {
    input = input.split('#').pop();
  } else if (input.includes('?room=')) {
    input = input.split('?room=').pop().split('&')[0];
  } else if (input.includes('/')) {
    input = input.split('/').pop();
  }
  startCall(input);
});

roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// ============ Start Call ============
async function startCall(roomId) {
  try {
    lobbyMsg.textContent = '';
    setStatus('Camera तैयार कर रहे हैं...', false);

    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: true
    });
    cameraStream = localStream;
    localVideo.srcObject = localStream;

    currentRoom = roomId;
    window.location.hash = roomId;

    // Setup share link
    const link = window.location.origin + window.location.pathname + '#' + roomId;
    shareLinkInput.value = link;

    // Show call screen with waiting overlay
    lobby.classList.add('hidden');
    callArea.classList.remove('hidden');
    waitingOverlay.classList.remove('hidden');

    setStatus('Room में जुड़ रहे हैं...', false);
    socket.emit('join-room', roomId);
  } catch (err) {
    let msg = 'Camera/Mic access नहीं मिला';
    if (err.name === 'NotAllowedError') msg = 'Camera/Mic की permission देनी होगी';
    if (err.name === 'NotFoundError') msg = 'Camera या Microphone नहीं मिला';
    lobbyMsg.textContent = msg;
    console.error(err);
  }
}

// ============ Socket events ============
socket.on('room-full', () => {
  showToast('यह Call पहले से full है (2 लोग ही allowed हैं)', 3000);
  endCall(true);
});

socket.on('other-user', async (userId) => {
  otherUserId = userId;
  waitingOverlay.classList.add('hidden');
  setStatus('जुड़ रहे हैं...', false);
  await createPeerConnection();
  localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', { target: userId, offer });
});

socket.on('user-joined', async (userId) => {
  otherUserId = userId;
  waitingOverlay.classList.add('hidden');
  setStatus('जुड़ रहे हैं...', false);
  await createPeerConnection();
  localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
});

socket.on('offer', async ({ from, offer }) => {
  otherUserId = from;
  waitingOverlay.classList.add('hidden');
  if (!peerConnection) {
    await createPeerConnection();
    localStream.getTracks().forEach((t) => peerConnection.addTrack(t, localStream));
  }
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { target: from, answer });
});

socket.on('answer', async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.error(err);
  }
});

socket.on('user-left', () => {
  showToast('दूसरा व्यक्ति call से चला गया');
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  otherUserId = null;
  waitingOverlay.classList.remove('hidden');
  setStatus('इंतज़ार...', false);
  stopTimer();
});

// ============ Peer Connection ============
async function createPeerConnection() {
  peerConnection = new RTCPeerConnection(iceServers);

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && otherUserId) {
      socket.emit('ice-candidate', {
        target: otherUserId,
        candidate: event.candidate
      });
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('Received remote track:', event.track.kind);
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    } else {
      // Some browsers fire ontrack without streams - build one
      if (!remoteVideo.srcObject) {
        remoteVideo.srcObject = new MediaStream();
      }
      remoteVideo.srcObject.addTrack(event.track);
    }
    // Try to play (autoplay may be blocked on some browsers)
    remoteVideo.play().catch(err => {
      console.warn('Remote video play failed:', err);
      showToast('Video दिखाने के लिए screen पर tap करें');
    });
    onConnected();
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log('ICE state:', peerConnection.iceConnectionState);
    switch (peerConnection.iceConnectionState) {
      case 'checking':
        setStatus('Connection बना रहे हैं...', false);
        break;
      case 'connected':
      case 'completed':
        onConnected();
        break;
      case 'failed':
        setStatus('Connection नहीं बन सकी', false);
        showToast('Connection fail - दूसरे network पर try करें');
        break;
      case 'disconnected':
        setStatus('Connection टूट गया', false);
        break;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Peer state:', peerConnection.connectionState);
    if (peerConnection.connectionState === 'connected') {
      onConnected();
    }
  };
}

// User tap fallback for autoplay
document.addEventListener('click', () => {
  if (remoteVideo.srcObject && remoteVideo.paused) {
    remoteVideo.play().catch(() => {});
  }
}, { once: false });

function onConnected() {
  setStatus('जुड़े हैं', true);
  if (!callStartTime) startTimer();
}

// ============ Status & Timer ============
function setStatus(text, connected) {
  statusText.textContent = text;
  if (connected) {
    statusDot.classList.add('connected');
  } else {
    statusDot.classList.remove('connected');
  }
}

function startTimer() {
  callStartTime = Date.now();
  timerInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - callStartTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    timerEl.textContent = `${mm}:${ss}`;
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  callStartTime = null;
  timerEl.textContent = '00:00';
}

// ============ Mute toggle ============
muteBtn.addEventListener('click', () => {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  if (track.enabled) {
    muteBtn.classList.remove('off');
    micIconEl.innerHTML = ICONS.micOn;
    showToast('Mic ON');
  } else {
    muteBtn.classList.add('off');
    micIconEl.innerHTML = ICONS.micOff;
    showToast('Mic OFF');
  }
});

// ============ Camera toggle ============
cameraBtn.addEventListener('click', () => {
  if (!cameraStream) return;
  const track = cameraStream.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  if (track.enabled) {
    cameraBtn.classList.remove('off');
    camIconEl.innerHTML = ICONS.camOn;
    showToast('Camera ON');
  } else {
    cameraBtn.classList.add('off');
    camIconEl.innerHTML = ICONS.camOff;
    showToast('Camera OFF');
  }
});

// ============ Screen share ============
screenBtn.addEventListener('click', async () => {
  if (!peerConnection) {
    showToast('पहले कोई जुड़े');
    return;
  }
  try {
    if (!isSharingScreen) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const track = screenStream.getVideoTracks()[0];
      const sender = peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      localVideo.srcObject = screenStream;
      isSharingScreen = true;
      screenBtn.classList.add('active');
      showToast('Screen share शुरू');
      track.onended = () => stopScreenShare();
    } else {
      stopScreenShare();
    }
  } catch (err) {
    console.error(err);
  }
});

async function stopScreenShare() {
  if (!peerConnection || !cameraStream) return;
  const track = cameraStream.getVideoTracks()[0];
  const sender = peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
  if (sender && track) await sender.replaceTrack(track);
  localVideo.srcObject = cameraStream;
  isSharingScreen = false;
  screenBtn.classList.remove('active');
  showToast('Screen share बंद');
}

// ============ Invite (share link via WhatsApp / native share) ============
inviteBtn.addEventListener('click', async () => {
  const link = shareLinkInput.value;
  const shareText = 'नमस्ते 🙏 मेरे साथ video call पर बात कीजिए। नीचे link पर click करें:\n' + link;

  // Try native share API first (mobile phones, some desktops)
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Shastri Ji Connect',
        text: 'मेरे साथ video call पर बात कीजिए',
        url: link
      });
      return;
    } catch (err) {
      // User cancelled - that's fine
      if (err.name === 'AbortError') return;
    }
  }

  // Fallback: copy to clipboard + open WhatsApp share
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link copy हो गया! WhatsApp खुल रहा है...');
  } catch (err) {}

  // Make sure the overlay is visible so user can also see the link
  waitingOverlay.classList.remove('hidden');

  // Open WhatsApp share in new tab
  setTimeout(() => {
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank');
  }, 300);
});

// Tap on remote area to close waiting overlay
waitingOverlay.addEventListener('click', (e) => {
  // Only close if clicked on the overlay backdrop, not on content
  if (e.target === waitingOverlay && otherUserId) {
    waitingOverlay.classList.add('hidden');
  }
});

// ============ Copy / Share link ============
shareCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    showToast('Link copy हो गया!');
  } catch (err) {
    // Fallback
    shareLinkInput.select();
    document.execCommand('copy');
    showToast('Link copy हो गया!');
  }
});

whatsappShareBtn.addEventListener('click', () => {
  const text = encodeURIComponent('Mujhse video call par baat karein:\n' + shareLinkInput.value);
  window.open('https://wa.me/?text=' + text, '_blank');
});

// Use native share API if available
whatsappShareBtn.addEventListener('contextmenu', async (e) => {
  e.preventDefault();
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Shastri Ji Connect',
        text: 'Mujhse video call par baat karein',
        url: shareLinkInput.value
      });
    } catch (err) {}
  }
});

// ============ End call ============
hangupBtn.addEventListener('click', () => endCall(false));

function endCall(silent) {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (cameraStream && cameraStream !== localStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
    cameraStream = null;
  }
  socket.disconnect();
  stopTimer();
  if (!silent) {
    window.location.hash = '';
    window.location.reload();
  }
}
