'use strict';

const socket = io({ reconnectionDelay: 1000, reconnectionDelayMax: 5000 });

// ============ DOM elements ============
const lobby = document.getElementById('lobby');
const callArea = document.getElementById('callArea');
const roomInput = document.getElementById('roomInput');
const startCallBtn = document.getElementById('startCallBtn');
const joinBtn = document.getElementById('joinBtn');
const lobbyMsg = document.getElementById('lobbyMsg');
const startView = document.getElementById('startView');
const inviteView = document.getElementById('inviteView');
const acceptCallBtn = document.getElementById('acceptCallBtn');

const waitingOverlay = document.getElementById('waitingOverlay');
const shareLinkInput = document.getElementById('shareLink');
const shareCopyBtn = document.getElementById('shareCopyBtn');
const whatsappShareBtn = document.getElementById('whatsappShareBtn');

const localVideo = document.getElementById('localVideo');
const localWrapper = document.getElementById('localWrapper');
const localPlaceholder = document.getElementById('localPlaceholder');
const flipBtn = document.getElementById('flipBtn');
const remoteVideo = document.getElementById('remoteVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const remoteMuteBadge = document.getElementById('remoteMuteBadge');

const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenBtn = document.getElementById('screenBtn');
const inviteBtn = document.getElementById('inviteBtn');
const hangupBtn = document.getElementById('hangupBtn');

const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const timerEl = document.getElementById('timer');
const toast = document.getElementById('toast');
const micIconEl = document.getElementById('micIcon');
const camIconEl = document.getElementById('camIcon');

// SVG icons for toggle states
const ICONS = {
  micOn: '<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>',
  micOff: '<path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM15 11.16L9 5.18V5c0-1.66 1.34-3 3-3s3 1.34 3 3v6.16zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>',
  camOn: '<path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/>',
  camOff: '<path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2z"/>'
};

// ============ State ============
let localStream = null;      // camera + mic (or mic only when no camera)
let screenStream = null;     // active screen share, if any
let peerConnection = null;
let videoSender = null;      // RTCRtpSender carrying our camera/screen
let otherUserId = null;      // socket id of the other side
let otherPeerId = null;      // stable id of the other side
let currentRoom = null;
let joined = false;          // joined the room at least once (rejoin on reconnect)
let isSharingScreen = false;
let audioOnly = false;
let facingMode = 'user';
let flipping = false;
let negotiationEnabled = false;
let callStartTime = null;
let timerInterval = null;
let pendingCandidates = [];
let recoverTimer = null;
let lastJoinAt = 0;
let wakeLock = null;
let pendingRoomId = null;

// A stable id for this browser tab. Survives page reloads and network
// drops, so the server lets us back into the same call seat.
const myPeerId = getPeerId();

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

// ============ Helpers ============
function randomId(len) {
  // No 0/o/1/l/i so a room id can be read out over the phone without confusion
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function getPeerId() {
  try {
    let id = sessionStorage.getItem('sjc-peer-id');
    if (!id || !/^[a-z0-9_-]{6,64}$/i.test(id)) {
      id = randomId(12);
      sessionStorage.setItem('sjc-peer-id', id);
    }
    return id;
  } catch (e) {
    return randomId(12);
  }
}

// Accepts a full link, "?room=xyz", or a bare room id and returns a clean id
function extractRoomId(input) {
  let s = String(input || '').trim();
  if (s.includes('#')) {
    s = s.split('#').pop();
  } else if (/[?&]room=/.test(s)) {
    s = s.split(/[?&]room=/).pop().split('&')[0];
  } else if (s.includes('/')) {
    s = s.split('/').pop();
  }
  try { s = decodeURIComponent(s); } catch (e) { /* keep as is */ }
  return s.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
}

function getRoomFromUrl() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) return extractRoomId(hash);
  const params = new URLSearchParams(window.location.search);
  return extractRoomId(params.get('room') || '');
}

function showToast(message, duration = 2000) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

function setStatus(text, connected) {
  statusText.textContent = text;
  statusDot.classList.toggle('connected', !!connected);
}

// ============ In-app browser detection ============
// WhatsApp / Facebook / Instagram open links inside their own mini browser
// (Android WebView, iOS WKWebView) where camera/mic usually do not work.
function isInAppBrowser() {
  const ua = navigator.userAgent || '';
  if (/WhatsApp|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|\bLine\/|; wv\)/i.test(ua)) return true;
  // iOS WKWebView: has "iPhone" but neither Safari's "Version/x Safari" nor a known browser marker
  if (/iPhone|iPad/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPT\//.test(ua) && !/Version\/[\d.]+.*Safari/.test(ua)) {
    return true;
  }
  return false;
}

function showInAppBrowserWarning() {
  const warning = document.createElement('div');
  warning.className = 'inapp-warning';
  warning.innerHTML = `
    <div class="warning-card">
      <div class="warning-icon">⚠️</div>
      <h2>Browser बदलें</h2>
      <p>आप अभी किसी <strong>app के अंदर वाले browser</strong> (WhatsApp/Facebook/Instagram) में हैं।</p>
      <p>इसमें Camera/Mic काम नहीं करता।</p>
      <div class="warning-steps">
        <p><strong>क्या करें:</strong></p>
        <ol>
          <li>ऊपर/नीचे दाईं तरफ <strong>तीन dots (⋮)</strong> पर click करें</li>
          <li><strong>"Open in Browser"</strong> या <strong>"Chrome में खोलें"</strong> चुनें</li>
        </ol>
      </div>
      <button id="copyLinkWarning" class="big-btn primary" style="margin-top: 16px">Link Copy करें</button>
    </div>
  `;
  document.body.appendChild(warning);
  document.getElementById('copyLinkWarning').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link copy हो गया! Chrome में paste करें');
    } catch (e) {
      showToast('Address bar से link copy करें');
    }
  });
}

// ============ Page load ============
window.addEventListener('load', () => {
  const roomFromUrl = getRoomFromUrl();

  if (roomFromUrl && isInAppBrowser()) {
    showInAppBrowserWarning();
    return;
  }

  if (roomFromUrl) {
    // Receiver clicked an invite link - show invite view, don't auto-join
    pendingRoomId = roomFromUrl;
    startView.classList.add('hidden');
    inviteView.classList.remove('hidden');
  } else {
    startView.classList.remove('hidden');
    inviteView.classList.add('hidden');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    screenBtn.classList.add('unsupported');
  }
});

acceptCallBtn.addEventListener('click', () => {
  if (pendingRoomId) startCall(pendingRoomId);
});

startCallBtn.addEventListener('click', () => {
  startCall('call-' + randomId(8));
});

joinBtn.addEventListener('click', () => {
  const roomId = extractRoomId(roomInput.value);
  if (!roomId) {
    lobbyMsg.textContent = 'कृपया सही link या Room ID डालें';
    return;
  }
  startCall(roomId);
});

roomInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') joinBtn.click();
});

// ============ Local media ============
async function getLocalMedia() {
  const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  const video = { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    audioOnly = false;
    return await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch (err) {
    // No camera / camera busy / camera denied but mic allowed -> still join with voice
    const retryAudioOnly = ['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError',
      'OverconstrainedError', 'ConstraintNotSatisfiedError', 'AbortError', 'NotAllowedError'];
    if (!retryAudioOnly.includes(err.name)) throw err;
    const stream = await navigator.mediaDevices.getUserMedia({ audio });
    audioOnly = true;
    showToast('Camera नहीं मिला, सिर्फ़ आवाज़ से जुड़ रहे हैं', 4000);
    return stream;
  }
}

function updateLocalPreview() {
  const hasVideo = !!(localStream && localStream.getVideoTracks().length);
  localPlaceholder.classList.toggle('hidden', hasVideo || isSharingScreen);
  localWrapper.classList.toggle('mirror', !isSharingScreen && facingMode === 'user');
  cameraBtn.classList.toggle('unsupported', !hasVideo);
}

async function checkCameraFlipAvailable() {
  try {
    if (!navigator.mediaDevices.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    flipBtn.classList.toggle('hidden', audioOnly || cams.length < 2);
  } catch (e) { /* ignore */ }
}

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (localStream) checkCameraFlipAvailable();
  });
}

// ============ Start Call ============
async function startCall(roomId) {
  roomId = extractRoomId(roomId);
  if (!roomId) {
    lobbyMsg.textContent = 'कृपया सही link या Room ID डालें';
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    lobbyMsg.textContent = 'यह browser video call support नहीं करता। कृपया Chrome या Safari में खोलें।';
    return;
  }
  try {
    lobbyMsg.textContent = '';
    setStatus('Camera तैयार कर रहे हैं...', false);

    localStream = await getLocalMedia();
    localVideo.srcObject = localStream;
    updateLocalPreview();
    checkCameraFlipAvailable();

    currentRoom = roomId;
    history.replaceState(null, '', window.location.pathname + '#' + roomId);
    shareLinkInput.value = window.location.origin + window.location.pathname + '#' + roomId;

    lobby.classList.add('hidden');
    callArea.classList.remove('hidden');
    waitingOverlay.classList.remove('hidden');

    if (socket.connected) {
      joinRoom();
    } else {
      setStatus('Server से जुड़ रहे हैं...', false);
      socket.connect();
    }
  } catch (err) {
    let msg = 'Camera/Mic access नहीं मिला';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Camera/Mic की permission नहीं मिली। Address bar में lock 🔒 या camera icon पर tap करके "Allow" करें, फिर दोबारा कोशिश करें।';
    } else if (err.name === 'NotFoundError') {
      msg = 'Camera या Microphone नहीं मिला';
    } else if (err.name === 'NotReadableError') {
      msg = 'Camera/Mic कोई और app इस्तेमाल कर रहा है। उसे बंद करके दोबारा कोशिश करें।';
    } else if (window.isSecureContext === false) {
      msg = 'Video call के लिए https link ज़रूरी है';
    }
    lobbyMsg.textContent = msg;
    console.error(err);
  }
}

function joinRoom() {
  if (!currentRoom || !socket.connected) return;
  const now = Date.now();
  if (now - lastJoinAt < 1500) return; // avoid double joins
  lastJoinAt = now;

  setStatus(joined ? 'दोबारा जुड़ रहे हैं...' : 'Room में जुड़ रहे हैं...', false);
  socket.emit('join-room', currentRoom, myPeerId, (res) => {
    if (!res || !res.ok) {
      if (res && res.error === 'full') {
        leaveToLobby('यह call पहले से चल रही है (सिर्फ़ 2 लोग जुड़ सकते हैं)। नई call शुरू करें या सही link माँगें।');
      } else {
        leaveToLobby('Room से जुड़ नहीं पाए। दोबारा कोशिश करें।');
      }
      return;
    }
    joined = true;
    if (!otherUserId) setStatus('दूसरे का इंतज़ार...', false);
  });
}

// ============ Socket lifecycle ============
socket.on('connect', () => {
  if (!currentRoom) return;
  if (joined) {
    // Came back after a network drop: start the peer connection fresh
    showToast('Server से दोबारा जुड़ गए');
    resetPeer();
  }
  lastJoinAt = 0;
  joinRoom();
});

socket.on('disconnect', () => {
  if (currentRoom) setStatus('Server से संपर्क टूटा, जोड़ रहे हैं...', false);
});

socket.on('connect_error', () => {
  if (currentRoom) setStatus('Server से जुड़ नहीं पा रहे...', false);
});

socket.on('kicked', () => {
  leaveToLobby('यह call किसी दूसरी tab या device में खुल गई है।');
});

// ============ Signaling ============
socket.on('other-user', async ({ socketId, peerId }) => {
  // We are the newcomer -> we send the offer
  resetPeer();
  otherUserId = socketId;
  otherPeerId = peerId;
  waitingOverlay.classList.add('hidden');
  setStatus('जुड़ रहे हैं...', false);
  createPeerConnection();
  addLocalTracks();
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { target: socketId, offer });
  } catch (err) {
    console.error('offer failed', err);
  }
});

socket.on('user-joined', ({ socketId, peerId }) => {
  // Someone joined us -> wait for their offer
  resetPeer();
  otherUserId = socketId;
  otherPeerId = peerId;
  waitingOverlay.classList.add('hidden');
  setStatus('जुड़ रहे हैं...', false);
  createPeerConnection();
  addLocalTracks();
});

socket.on('offer', async ({ from, offer }) => {
  otherUserId = from;
  waitingOverlay.classList.add('hidden');
  if (!peerConnection) {
    createPeerConnection();
    addLocalTracks();
  }
  try {
    if (peerConnection.signalingState !== 'stable') {
      await peerConnection.setLocalDescription({ type: 'rollback' });
    }
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    await flushCandidates();
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { target: from, answer });
  } catch (err) {
    console.error('answer failed', err);
  }
});

socket.on('answer', async ({ answer }) => {
  if (!peerConnection || peerConnection.signalingState !== 'have-local-offer') return;
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    await flushCandidates();
  } catch (err) {
    console.error('setRemoteDescription(answer) failed', err);
  }
});

socket.on('ice-candidate', async ({ candidate }) => {
  if (!candidate) return;
  if (peerConnection && peerConnection.remoteDescription) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('addIceCandidate failed', err);
    }
  } else {
    // Candidates can arrive before the offer/answer is applied - keep them
    pendingCandidates.push(candidate);
  }
});

socket.on('media-state', (state) => updateRemoteState(state));

socket.on('user-left', () => {
  showToast('दूसरा व्यक्ति call से चला गया');
  resetPeer();
  otherUserId = null;
  otherPeerId = null;
  updateRemoteState({ audio: true, video: true, screen: false });
  waitingOverlay.classList.remove('hidden');
  setStatus('दूसरे का इंतज़ार...', false);
  stopTimer();
  releaseWakeLock();
});

async function flushCandidates() {
  const list = pendingCandidates;
  pendingCandidates = [];
  for (const c of list) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(c));
    } catch (err) {
      console.warn('addIceCandidate (queued) failed', err);
    }
  }
}

// ============ Peer Connection ============
function createPeerConnection() {
  const pc = new RTCPeerConnection(iceServers);
  peerConnection = pc;
  videoSender = null;
  negotiationEnabled = false;
  pendingCandidates = [];

  pc.onicecandidate = (event) => {
    if (event.candidate && otherUserId) {
      socket.emit('ice-candidate', { target: otherUserId, candidate: event.candidate });
    }
  };

  pc.ontrack = (event) => {
    if (pc !== peerConnection) return;
    if (event.streams && event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
    } else {
      if (!remoteVideo.srcObject) remoteVideo.srcObject = new MediaStream();
      remoteVideo.srcObject.addTrack(event.track);
    }
    remoteVideo.play().catch((err) => {
      console.warn('Remote video play failed:', err);
      showToast('Video दिखाने के लिए screen पर tap करें');
    });
    onConnected();
  };

  pc.onnegotiationneeded = async () => {
    // Only used for changes made after the call is up (e.g. an audio-only
    // user starting a screen share). Initial offers are driven by the server.
    if (pc !== peerConnection || !negotiationEnabled || pc.signalingState !== 'stable' || !otherUserId) return;
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      socket.emit('offer', { target: otherUserId, offer });
    } catch (err) {
      console.error('renegotiation failed', err);
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc !== peerConnection) return;
    console.log('ICE state:', pc.iceConnectionState);
    switch (pc.iceConnectionState) {
      case 'checking':
        setStatus('Connection बना रहे हैं...', false);
        break;
      case 'connected':
      case 'completed':
        clearRecoverTimer();
        onConnected();
        break;
      case 'disconnected':
        setStatus('Connection कमज़ोर है, संभाल रहे हैं...', false);
        scheduleRecover(5000);
        break;
      case 'failed':
        setStatus('Connection टूट गया, दोबारा जोड़ रहे हैं...', false);
        scheduleRecover(0);
        break;
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc !== peerConnection) return;
    console.log('Peer state:', pc.connectionState);
    if (pc.connectionState === 'connected') onConnected();
    if (pc.connectionState === 'failed') scheduleRecover(0);
  };
}

function addLocalTracks() {
  if (!peerConnection || !localStream) return;
  localStream.getAudioTracks().forEach((t) => peerConnection.addTrack(t, localStream));
  const videoTrack = isSharingScreen && screenStream
    ? screenStream.getVideoTracks()[0]
    : localStream.getVideoTracks()[0];
  if (videoTrack) videoSender = peerConnection.addTrack(videoTrack, localStream);
}

function resetPeer() {
  clearRecoverTimer();
  if (peerConnection) {
    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.onnegotiationneeded = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
    peerConnection = null;
  }
  videoSender = null;
  negotiationEnabled = false;
  pendingCandidates = [];
  remoteVideo.srcObject = null;
}

// Try to rebuild the call when the connection is lost. The peer with the
// smaller id goes first; the other waits so both do not rejoin at once.
function scheduleRecover(delay) {
  clearRecoverTimer();
  const lead = !otherPeerId || myPeerId < otherPeerId;
  recoverTimer = setTimeout(() => {
    recoverTimer = null;
    const st = peerConnection && peerConnection.iceConnectionState;
    if (st === 'connected' || st === 'completed') return;
    recoverConnection();
  }, delay + (lead ? 0 : 6000));
}

function clearRecoverTimer() {
  if (recoverTimer) clearTimeout(recoverTimer);
  recoverTimer = null;
}

function recoverConnection() {
  if (!currentRoom || !otherUserId) return;
  if (!socket.connected) return; // the 'connect' handler will rejoin
  showToast('Call दोबारा जोड़ रहे हैं...');
  resetPeer();
  lastJoinAt = 0;
  joinRoom();
}

function onConnected() {
  setStatus('जुड़े हैं', true);
  waitingOverlay.classList.add('hidden');
  if (!callStartTime) startTimer();
  negotiationEnabled = true;
  requestWakeLock();
  sendMediaState();
}

// User tap fallback for autoplay
document.addEventListener('click', () => {
  if (remoteVideo.srcObject && remoteVideo.paused) {
    remoteVideo.play().catch(() => {});
  }
});

// ============ Media state (mute / camera off / screen) ============
function sendMediaState() {
  if (!otherUserId || !socket.connected || !localStream) return;
  const a = localStream.getAudioTracks()[0];
  const v = localStream.getVideoTracks()[0];
  socket.emit('media-state', {
    target: otherUserId,
    audio: !!(a && a.enabled),
    video: isSharingScreen || !!(v && v.enabled),
    screen: isSharingScreen
  });
}

function updateRemoteState(state) {
  if (!state) return;
  remoteMuteBadge.classList.toggle('hidden', state.audio !== false);
  remotePlaceholder.classList.toggle('hidden', state.video !== false);
  remoteVideo.classList.toggle('contain', !!state.screen);
}

// ============ Keep the screen awake during a call ============
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* not critical */ }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentRoom && otherUserId) requestWakeLock();
});

// ============ Timer ============
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
  muteBtn.classList.toggle('off', !track.enabled);
  micIconEl.innerHTML = track.enabled ? ICONS.micOn : ICONS.micOff;
  showToast(track.enabled ? 'Mic ON' : 'Mic OFF');
  sendMediaState();
});

// ============ Camera toggle ============
cameraBtn.addEventListener('click', () => {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (!track) {
    showToast('Camera उपलब्ध नहीं है');
    return;
  }
  track.enabled = !track.enabled;
  cameraBtn.classList.toggle('off', !track.enabled);
  camIconEl.innerHTML = track.enabled ? ICONS.camOn : ICONS.camOff;
  showToast(track.enabled ? 'Camera ON' : 'Camera OFF');
  sendMediaState();
});

// ============ Camera flip (front / back) ============
flipBtn.addEventListener('click', flipCamera);

async function flipCamera() {
  if (!localStream || audioOnly || flipping) return;
  flipping = true;
  const oldTrack = localStream.getVideoTracks()[0];
  const wantFacing = facingMode === 'user' ? 'environment' : 'user';
  const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
  try {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ facingMode: { exact: wantFacing } }, size), audio: false });
    } catch (e) {
      // Desktop / unusual phones: no facingMode - just move to the next camera
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      const currentId = oldTrack && oldTrack.getSettings().deviceId;
      const idx = cams.findIndex((d) => d.deviceId === currentId);
      const next = cams[(idx + 1) % cams.length];
      if (!next || next.deviceId === currentId) throw e;
      stream = await navigator.mediaDevices.getUserMedia({ video: Object.assign({ deviceId: { exact: next.deviceId } }, size), audio: false });
    }
    const newTrack = stream.getVideoTracks()[0];
    const settings = newTrack.getSettings ? newTrack.getSettings() : {};
    facingMode = settings.facingMode || wantFacing;
    if (oldTrack) {
      newTrack.enabled = oldTrack.enabled;
      localStream.removeTrack(oldTrack);
      oldTrack.stop();
    }
    localStream.addTrack(newTrack);
    if (!isSharingScreen) {
      if (videoSender) await videoSender.replaceTrack(newTrack);
      localVideo.srcObject = localStream;
    }
    updateLocalPreview();
    showToast(facingMode === 'environment' ? 'पीछे का camera' : 'सामने का camera');
  } catch (err) {
    console.error('flip failed', err);
    showToast('Camera बदल नहीं सका');
  }
  flipping = false;
}

// ============ Screen share ============
screenBtn.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast('Screen share सिर्फ़ computer/laptop के browser में चलता है', 3500);
    return;
  }
  if (isSharingScreen) {
    stopScreenShare();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15 } },
      audio: false
    });
    const track = stream.getVideoTracks()[0];
    screenStream = stream;
    isSharingScreen = true;
    if (peerConnection) {
      if (videoSender) {
        await videoSender.replaceTrack(track);
      } else if (localStream) {
        // Audio-only user: add a video sender (triggers renegotiation)
        videoSender = peerConnection.addTrack(track, localStream);
      }
    }
    localVideo.srcObject = stream;
    updateLocalPreview();
    screenBtn.classList.add('active');
    showToast('Screen share शुरू');
    track.onended = () => stopScreenShare();
    sendMediaState();
  } catch (err) {
    console.error(err);
    if (err.name !== 'NotAllowedError') showToast('Screen share शुरू नहीं हो सका');
  }
});

async function stopScreenShare(quiet) {
  if (!isSharingScreen) return;
  isSharingScreen = false;
  if (screenStream) {
    // Stop the capture so the browser's "sharing your screen" bar goes away
    screenStream.getTracks().forEach((t) => t.stop());
    screenStream = null;
  }
  const camTrack = localStream ? localStream.getVideoTracks()[0] : null;
  if (videoSender) {
    try { await videoSender.replaceTrack(camTrack || null); } catch (e) { console.warn(e); }
  }
  localVideo.srcObject = localStream;
  updateLocalPreview();
  screenBtn.classList.remove('active');
  if (!quiet) showToast('Screen share बंद');
  sendMediaState();
}

// ============ Invite (share link via WhatsApp / native share) ============
const INVITE_TEXT = 'नमस्ते 🙏 मेरे साथ video call पर बात कीजिए। नीचे दिए link पर click करें:\n';

inviteBtn.addEventListener('click', async () => {
  const link = shareLinkInput.value;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Shastri Ji Connect', text: INVITE_TEXT.trim(), url: link });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    showToast('Link copy हो गया! WhatsApp खुल रहा है...');
  } catch (err) { /* ignore */ }
  waitingOverlay.classList.remove('hidden');
  setTimeout(() => {
    window.open('https://wa.me/?text=' + encodeURIComponent(INVITE_TEXT + link), '_blank');
  }, 300);
});

// Tap on the backdrop to close the waiting overlay once someone is connected
waitingOverlay.addEventListener('click', (e) => {
  if (e.target === waitingOverlay && otherUserId) waitingOverlay.classList.add('hidden');
});

shareCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(shareLinkInput.value);
    showToast('Link copy हो गया!');
  } catch (err) {
    shareLinkInput.select();
    document.execCommand('copy');
    showToast('Link copy हो गया!');
  }
});

whatsappShareBtn.addEventListener('click', () => {
  window.open('https://wa.me/?text=' + encodeURIComponent(INVITE_TEXT + shareLinkInput.value), '_blank');
});

// ============ End call / leave ============
hangupBtn.addEventListener('click', () => {
  if (socket.connected) socket.emit('leave-room');
  leaveToLobby('Call बंद हो गई।');
});

function leaveToLobby(message) {
  resetPeer();
  stopTimer();
  releaseWakeLock();
  if (isSharingScreen) stopScreenShare(true);
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  currentRoom = null;
  joined = false;
  otherUserId = null;
  otherPeerId = null;
  pendingRoomId = null;
  audioOnly = false;
  facingMode = 'user';

  // Reset control states
  muteBtn.classList.remove('off');
  cameraBtn.classList.remove('off', 'unsupported');
  micIconEl.innerHTML = ICONS.micOn;
  camIconEl.innerHTML = ICONS.camOn;
  screenBtn.classList.remove('active');
  flipBtn.classList.add('hidden');
  updateRemoteState({ audio: true, video: true, screen: false });
  waitingOverlay.classList.remove('hidden');
  setStatus('जुड़ रहे हैं...', false);

  history.replaceState(null, '', window.location.pathname);
  callArea.classList.add('hidden');
  lobby.classList.remove('hidden');
  inviteView.classList.add('hidden');
  startView.classList.remove('hidden');
  roomInput.value = '';
  lobbyMsg.textContent = message || '';
}

window.addEventListener('beforeunload', () => {
  if (currentRoom && socket.connected) socket.emit('leave-room');
});
