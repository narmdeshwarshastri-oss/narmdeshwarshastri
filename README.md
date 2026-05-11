# Shastri Ji Connect

A simple 1-on-1 video call web app with screen sharing.

## Features
- 1-on-1 video calling
- Audio/video controls (mute, camera off)
- Screen sharing
- Shareable room links
- Mobile friendly (works in any modern browser)

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
