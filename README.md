# VoxCall — Open-Source WebRTC Live Audio & Video Calling Package

[![npm version](https://img.shields.io/npm/v/vox-call.svg)](https://www.npmjs.com/package/vox-call)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**VoxCall** is a modern, zero-config, TypeScript-first WebRTC audio and video calling SDK for web applications. It abstracts away complex SDP negotiation, ICE candidate handling, and stream management into an intuitive, promise-based API.

---

## Features

- ⚡ **Peer-to-Peer Audio & Video**: HD two-way calling using modern Opus and VP8/H.264 codecs.
- 🖥️ **Screen Sharing in 1 Line of Code**: Built-in display capture with automatic track replacement and reversion.
- 🎛️ **Device & Media Controls**: Real-time mute/unmute, camera toggle, and device switching.
- 📦 **Dual-Format Build**: Bundles both ESM (`.mjs`) and CommonJS (`.js`) with full TypeScript `.d.ts` declarations.
- 🔌 **Plug-and-Play Signaling**: Includes a companion WebSocket signaling server.

---

## Directory Structure

```text
vox-call/
├── src/
│   ├── index.ts               # Main VoxCall class entry point
│   ├── types.ts               # TypeScript interfaces & event types
│   ├── signaling.ts           # WebSocket signaling client
│   └── media.ts               # Camera, mic, and screen share helpers
├── server/
│   ├── signaling-server.js    # Companion WebSocket signaling server
│   └── package.json           # ES module declaration for server
├── examples/
│   └── index.html             # Working Vanilla JS demo app
├── package.json               # Package metadata and build scripts
├── tsconfig.json              # TypeScript compiler configuration
├── tsup.config.ts             # Zero-config ESM/CJS bundler
├── README.md                  # Public GitHub / npm documentation
└── LICENSE                    # MIT License
```

---

## Installation

```bash
npm install vox-call
```

---

## Quick Start (Browser / React / Vue / Vanilla)

```typescript
import { VoxCall } from 'vox-call';

// 1. Initialize client with signaling server URL
const call = new VoxCall({
  signalingUrl: 'ws://localhost:8080'
});

// 2. Listen for remote media streams
call.on('remote-stream', (stream) => {
  const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
  remoteVideo.srcObject = stream;
});

// 3. Acquire local camera & mic, then join room
async function startCall() {
  const localStream = await call.initMedia();
  const localVideo = document.getElementById('localVideo') as HTMLVideoElement;
  localVideo.srcObject = localStream;

  call.join('room-xyz');
}

// 4. In-call controls
document.getElementById('muteBtn')?.addEventListener('click', () => {
  const isMuted = call.toggleMute();
  console.log('Muted:', isMuted);
});

document.getElementById('videoBtn')?.addEventListener('click', () => {
  const isOff = call.toggleVideo();
  console.log('Camera off:', isOff);
});

document.getElementById('screenBtn')?.addEventListener('click', async () => {
  await call.startScreenShare();
});

document.getElementById('hangupBtn')?.addEventListener('click', () => {
  call.leave();
});
```

---

## API Reference

### `VoxCall(config: VoxCallConfig)`

#### Configuration Options:
- `signalingUrl: string` — WebSocket signaling URL (e.g. `ws://localhost:8080` or `wss://your-domain.com`).
- `iceServers?: RTCIceServer[]` — Custom STUN/TURN server configuration (defaults to Google Public STUN).

#### Methods:
- `initMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>` — Requests camera and microphone access.
- `join(roomId: string): void` — Connects to signaling server and joins a room.
- `toggleMute(): boolean` — Toggles microphone state. Returns `true` if muted, `false` if unmuted.
- `toggleVideo(): boolean` — Toggles camera state. Returns `true` if camera is off, `false` if on.
- `startScreenShare(): Promise<MediaStream>` — Captures screen stream and replaces video track on active peer connection.
- `leave(): void` — Closes peer connection, stops all local tracks, notifies signaling, and resets state.
- `on(event: VoxCallEvent, callback: EventCallback): void` — Registers an event listener.
- `off(event: VoxCallEvent, callback: EventCallback): void` — Removes an event listener.
- `getLocalStream(): MediaStream | null` — Returns the current local media stream.
- `getRemoteStream(): MediaStream | null` — Returns the remote media stream.
- `getPeerConnection(): RTCPeerConnection | null` — Returns the underlying `RTCPeerConnection` for advanced operations.

#### Events:
- `'local-stream'` — Local media stream acquired (`(stream: MediaStream) => void`).
- `'remote-stream'` — Remote peer's media stream received (`(stream: MediaStream) => void`).
- `'user-joined'` — A peer entered the room.
- `'user-left'` — Remote peer disconnected.
- `'call-ended'` — Call was terminated.
- `'connection-state-changed'` — WebRTC peer connection state update (`connected`, `disconnected`, etc.).
- `'error'` — Any error encountered during signaling or media operations.

---

## Running Companion Signaling Server

Run the included companion signaling server:

```bash
npm run server
```

The server starts on port `8080` (or the port defined by `PORT` environment variable).

---

## Development & Building

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build package (ESM + CommonJS + Types):**
   ```bash
   npm run build
   ```

3. **Watch mode during development:**
   ```bash
   npm run dev
   ```

4. **Run Live Demo:**
   - In terminal 1: `npm run server`
   - In terminal 2: serve the package folder (e.g., `npx serve .` or open `examples/index.html` in your browser)

---

## Publishing to npm

1. Log into your npm account:
   ```bash
   npm login
   ```
2. Verify package name uniqueness:
   ```bash
   npm search vox-call
   ```
3. Publish package:
   ```bash
   npm publish --access public
   ```

---

## License

MIT © [VoxCall Contributors](LICENSE)
