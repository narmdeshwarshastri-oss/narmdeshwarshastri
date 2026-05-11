const socket = io();

const lobby = document.getElementById('lobby');
const callArea = document.getElementById('callArea');
const roomInput = document.getElementById('roomInput');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const lobbyMsg = document.getElementById('lobbyMsg');
const roomLabel = document.getElementById('roomLabel');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const muteBtn = document.getElementById('muteBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenBtn = document.getElementById('screenBtn');
const hangupBtn = document.getElementById('hangupBtn');
const statusMsg = document.getElementById('statusMsg');

let localStream = null;
let cameraStream = null;
let peerConnection = null;
let otherUserId = null;
let currentRoom = null;
let isSharingScreen = false;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// Auto-join from URL hash
window.addEventListener('load', () => {
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    roomInput.value = hash;
  }
});

joinBtn.addEventListener('click', () => {
  const roomId = roomInput.value.trim();
  if (!roomId) {
    lobbyMsg.textContent = 'कृपया Room ID डालें';
    return;
  }
  startCall(roomId);
});

createBtn.addEventListener('click', () => {
  const roomId = 'room-' + Math.random().toString(36).substring(2, 8);
  roomInput.value = roomId;
  startCall(roomId);
});

async function startCall(roomId) {
  try {
    lobbyMsg.textContent = 'Camera और microphone access माँग रहे हैं...';
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    cameraStream = localStream;
    localVideo.srcObject = localStream;

    currentRoom = roomId;
    window.location.hash = roomId;
    roomLabel.textContent = 'Room: ' + roomId;

    lobby.classList.add('hidden');
    callArea.classList.remove('hidden');

    statusMsg.textContent = 'Room में जुड़ रहे हैं...';
    socket.emit('join-room', roomId);
  } catch (err) {
    lobbyMsg.textContent = 'Camera/Mic access नहीं मिला: ' + err.message;
    console.error(err);
  }
}

socket.on('room-full', () => {
  lobbyMsg.textContent = 'यह Room भरा हुआ है (केवल 2 लोग allowed हैं)';
  lobby.classList.remove('hidden');
  callArea.classList.add('hidden');
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
});

socket.on('other-user', async (userId) => {
  otherUserId = userId;
  statusMsg.textContent = 'दूसरा user मिल गया, connect कर रहे हैं...';
  await createPeerConnection();
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', { target: userId, offer });
});

socket.on('user-joined', async (userId) => {
  otherUserId = userId;
  statusMsg.textContent = 'दूसरा user आ गया, connection बन रहा है...';
  await createPeerConnection();
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
});

socket.on('offer', async ({ from, offer }) => {
  otherUserId = from;
  if (!peerConnection) {
    await createPeerConnection();
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
  }
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  socket.emit('answer', { target: from, answer });
});

socket.on('answer', async ({ answer }) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  statusMsg.textContent = 'Call connected!';
});

socket.on('ice-candidate', async ({ candidate }) => {
  try {
    if (peerConnection && candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  } catch (err) {
    console.error('ICE candidate error:', err);
  }
});

socket.on('user-left', () => {
  statusMsg.textContent = 'दूसरा user call से चला गया';
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  otherUserId = null;
});

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
    remoteVideo.srcObject = event.streams[0];
    statusMsg.textContent = 'Call connected!';
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === 'connected') {
      statusMsg.textContent = 'Call connected!';
    }
  };
}

// Mute/unmute
muteBtn.addEventListener('click', () => {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    muteBtn.textContent = audioTrack.enabled ? 'Mic Off' : 'Mic On';
  }
});

// Camera on/off
cameraBtn.addEventListener('click', () => {
  if (!cameraStream) return;
  const videoTrack = cameraStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    cameraBtn.textContent = videoTrack.enabled ? 'Camera Off' : 'Camera On';
  }
});

// Screen share
screenBtn.addEventListener('click', async () => {
  if (!peerConnection) {
    statusMsg.textContent = 'पहले कोई user join करे';
    return;
  }
  try {
    if (!isSharingScreen) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peerConnection
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      }
      localVideo.srcObject = screenStream;
      isSharingScreen = true;
      screenBtn.textContent = 'Stop Share';

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } else {
      stopScreenShare();
    }
  } catch (err) {
    statusMsg.textContent = 'Screen share नहीं हो सका';
    console.error(err);
  }
});

async function stopScreenShare() {
  if (!peerConnection || !cameraStream) return;
  const videoTrack = cameraStream.getVideoTracks()[0];
  const sender = peerConnection
    .getSenders()
    .find((s) => s.track && s.track.kind === 'video');
  if (sender && videoTrack) {
    await sender.replaceTrack(videoTrack);
  }
  localVideo.srcObject = cameraStream;
  isSharingScreen = false;
  screenBtn.textContent = 'Share Screen';
}

// Copy link
copyLinkBtn.addEventListener('click', () => {
  const link = window.location.origin + window.location.pathname + '#' + currentRoom;
  navigator.clipboard.writeText(link).then(() => {
    copyLinkBtn.textContent = 'Copied!';
    setTimeout(() => (copyLinkBtn.textContent = 'Copy Link'), 1500);
  });
});

// Hang up
hangupBtn.addEventListener('click', () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
  }
  if (cameraStream && cameraStream !== localStream) {
    cameraStream.getTracks().forEach((t) => t.stop());
  }
  socket.disconnect();
  window.location.hash = '';
  window.location.reload();
});
