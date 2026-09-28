# Shastri Ji Connect

A simple 1-on-1 video call web app with screen sharing. Hindi UI, works in any modern browser, no app install.

## Features
- 1-on-1 video calling (WebRTC, peer-to-peer) with STUN + TURN fallback
- Audio/video controls (mute, camera off), front/back camera switch on phones
- Screen sharing (desktop browsers); the other side sees the whole screen, uncropped
- Shareable room links, WhatsApp share button, link preview card (Open Graph)
- Invite screen for receivers, warning when opened inside WhatsApp/Instagram in-app browsers
- Auto-reconnect: a dropped network (WiFi ↔ mobile data) rejoins the same call automatically
- Audio-only fallback when no camera is available
- Shows when the other person has muted or turned the camera off
- Keeps the phone screen awake during a call
- Installable as a PWA (PNG icons for Android / iOS home screen)

## Tech Stack
- Node.js + Express
- Socket.io (signaling)
- WebRTC (peer-to-peer video/audio)

## Local Development
```
npm install
npm start
```
Then open http://localhost:3000

## Deployment
Configured to deploy on any platform that sets the `PORT` environment variable (Render, Railway, Heroku, etc.).

Optional environment variables:
- `PUBLIC_URL` – public https origin (e.g. `https://call.example.com`). Used for the WhatsApp link-preview image. If unset, it is derived from the request host.

Health check endpoint: `GET /healthz`

## How it works
1. The caller opens the site, taps "नई Call शुरू करें" and gets a link like `https://.../#call-xxxxxxxx`.
2. They send the link (WhatsApp button or copy). The receiver opens it, taps "Call में जुड़ें" and allows camera/mic.
3. The server only exchanges signaling messages between the two browsers; audio and video flow directly between them (or via a TURN relay when a firewall blocks the direct path).
4. Each browser tab keeps a stable peer id, so if a phone loses network for a moment it rejoins the same seat and the call resumes.
