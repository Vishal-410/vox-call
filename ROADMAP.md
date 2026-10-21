# VoxCall — Product Roadmap & Architecture Specification

This document outlines the architectural evolution and planned feature milestones for **VoxCall**. It serves as the official technical roadmap for upcoming releases.

---

## Table of Contents
1. [Current State (v1.0.0)](#current-state-v100)
2. [Release Milestones](#release-milestones)
   - [v1.1.0: Multi-Party Mesh Calling & Audio Detection](#v110-multi-party-mesh-calling--audio-detection)
   - [v1.2.0: P2P Data Channels, Chat & Network Resilience](#v120-p2p-data-channels-chat--network-resilience)
   - [v1.3.0: Drop-In Web Component & React/Vue Hooks](#v130-drop-in-web-component--reactvue-hooks)
   - [v2.0.0: Call Recording & Direct Dial Ringing System](#v200-call-recording--direct-dial-ringing-system)
3. [Proposed API Specifications](#proposed-api-specifications)
4. [Signaling Protocol Extensions](#signaling-protocol-extensions)

---

## Current State (v1.0.0)

- **Topology:** 1-on-1 direct Peer-to-Peer (P2P).
- **Media:** Two-way audio/video (Opus & VP8/H.264) + single-track screen sharing with auto-reversion.
- **Controls:** `initMedia()`, `join(roomId)`, `toggleMute()`, `toggleVideo()`, `startScreenShare()`, `leave()`.
- **Signaling:** Companion Node.js WebSocket server managing room sets.
- **Distribution:** Dual ESM/CJS build with full TypeScript definitions (`.d.ts`).

---

## Release Milestones

### v1.1.0: Multi-Party Mesh Calling & Audio Detection

#### Objectives:
Support 3 to 6 participants in the same room without requiring an external media server, and visually identify active speakers.

#### Technical Specifications:
1. **Multi-Peer Mesh Connection Pool:**
   - Migrate from single `RTCPeerConnection` to:
     ```typescript
     private peers: Map<string, { pc: RTCPeerConnection; stream: MediaStream | null }> = new Map();
     ```
   - Each participant joining a room establishes a mesh connection with every other existing peer in that room.
2. **Signaling Protocol Updates:**
   - On `join_room`, the server responds with a list of existing peer IDs in the room: `{ type: 'room_peers', peers: string[] }`.
   - The new participant initiates an SDP offer targeted to each existing peer.
   - Signaling messages include `from` and `target` peer IDs:
     ```json
     { "type": "sdp_offer", "from": "peer_A", "target": "peer_B", "sdp": {...} }
     ```
3. **Active Speaker & Audio Level Detection:**
   - Attach Web Audio API `AudioContext` and `ScriptProcessorNode`/`AudioWorklet` to incoming and local audio tracks.
   - Calculate RMS (Root Mean Square) volume level.
   - Emit `'volume-change'` and `'active-speaker-changed'` events.

---

### v1.2.0: P2P Data Channels, Chat & Network Resilience

#### Objectives:
Add real-time text chat, emoji reactions, and automatic recovery from network drops.

#### Technical Specifications:
1. **P2P Data Channels (`RTCDataChannel`):**
   - Create reliable, ordered data channels during peer connection negotiation:
     ```typescript
     this.dataChannel = this.pc.createDataChannel('vox-chat', { ordered: true });
     ```
   - Enable text messaging, typing indicators, and emoji reactions with zero server database load.
2. **Auto-Reconnection & ICE Restarts:**
   - Listen to `pc.oniceconnectionstatechange` for `'disconnected'` and `'failed'` states.
   - Trigger `pc.restartIce()` and negotiate new SDP without tearing down the call interface.
   - WebSocket client auto-reconnects with exponential backoff (1s, 2s, 4s, max 10s) on connection loss.
3. **Configurable TURN Relay:**
   - Built-in configuration helpers for TURN providers (e.g. Metered, Twilio, Cloudflare Calls) to guarantee 100% connectivity behind corporate/symmetric firewalls.

---

### v1.3.0: Drop-In Web Component & React/Vue Hooks

#### Objectives:
Eliminate boilerplate HTML, CSS, and DOM management for developers.

#### Technical Specifications:
1. **Zero-Code Web Component (`<vox-call-room>`):**
   - Built using standard Custom Elements and Shadow DOM (no framework dependency).
   - Usage:
     ```html
     <vox-call-room 
       room="daily-standup" 
       signaling="wss://your-signaling.com"
       theme="dark">
     </vox-call-room>
     ```
   - Includes automatic responsive grid layout (1, 2, 3, 4, 6 tiles), mute/camera buttons, screen sharing, and participant labels.
2. **Framework Adapters:**
   - React Hook: `useVoxCall({ room, signalingUrl })` returning reactive state (`peers`, `localStream`, `isMuted`, `isCameraOff`).
   - Vue 3 Composable: `useVoxCall()`.

---

### v2.0.0: Call Recording & Direct Dial Ringing System

#### Objectives:
Enable in-browser session recording and transition from room-only semantics to direct user-to-user dialing.

#### Technical Specifications:
1. **In-Browser Call Recording:**
   - Composite local and remote audio/video tracks onto an offscreen HTML Canvas + Web Audio mixer.
   - Use `MediaRecorder` API with `video/webm;codecs=vp9,opus`.
   - Methods: `startRecording()`, `pauseRecording()`, `stopRecording(): Promise<Blob>`.
2. **Direct Dial & Ringing Workflow:**
   - User identity tracking (`userId`).
   - Call states: `IDLE` → `CALLING` → `RINGING` → `CONNECTED` → `ENDED`.
   - Ringing tone audio generator (Web Audio API synthesizers, no external MP3 dependencies).
   - Methods:
     - `call.dial(recipientId)`
     - `call.on('incoming-call', ({ callerId, accept, reject }) => ...)`

---

## Proposed API Specifications

```typescript
export interface VoxCallConfig {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
  autoReconnect?: boolean;
  enableDataChannel?: boolean;
}

export interface VoxCallMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface VoxPeer {
  id: string;
  stream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isSpeaking: boolean;
}

export declare class VoxCall {
  constructor(config: VoxCallConfig);

  // Connection & Room
  initMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  join(roomId: string, userId?: string): void;
  leave(): void;

  // Media Controls
  toggleMute(): boolean;
  toggleVideo(): boolean;
  startScreenShare(): Promise<MediaStream>;
  stopScreenShare(): Promise<void>;

  // Data Channels & Messaging (v1.2.0)
  sendMessage(text: string): void;
  sendData(payload: ArrayBuffer | string): void;

  // Recording (v2.0.0)
  startRecording(): void;
  stopRecording(): Promise<Blob>;

  // Direct Dialing (v2.0.0)
  dial(targetUserId: string): Promise<void>;

  // Event Listeners
  on(event: 'local-stream', cb: (stream: MediaStream) => void): void;
  on(event: 'peer-joined', cb: (peer: VoxPeer) => void): void;
  on(event: 'peer-stream', cb: (peerId: string, stream: MediaStream) => void): void;
  on(event: 'peer-left', cb: (peerId: string) => void): void;
  on(event: 'message', cb: (msg: VoxCallMessage) => void): void;
  on(event: 'active-speaker-changed', cb: (peerId: string) => void): void;
  on(event: 'incoming-call', cb: (invitation: { from: string; accept: () => void; reject: () => void }) => void): void;
  on(event: 'call-ended', cb: () => void): void;
  on(event: 'error', cb: (error: Error) => void): void;
}
```

---

## Signaling Protocol Extensions

### Extended Message Payload Format

```typescript
export type SignalingType =
  | 'join_room'
  | 'room_peers'
  | 'peer_joined'
  | 'peer_left'
  | 'sdp_offer'
  | 'sdp_answer'
  | 'ice_candidate'
  | 'call_user'
  | 'call_accepted'
  | 'call_rejected';

export interface SignalingPayload {
  type: SignalingType;
  roomId?: string;
  from?: string;
  target?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  data?: any;
}
```

---

## Release Timeline

| Release | Milestone | Scope | Target Window |
| :--- | :--- | :--- | :--- |
| **v1.1.0** | Group Mesh Calling | Multi-peer mesh, Active speaker detection | Sprint 1 |
| **v1.2.0** | Data Channels & Chat | In-call P2P text/reactions, ICE restart & reconnect | Sprint 2 |
| **v1.3.0** | Drop-In UI Components | `<vox-call-room>` Web Component, React/Vue hooks | Sprint 3 |
| **v2.0.0** | Recording & Direct Dial | Client-side recording, WhatsApp-style ringing system | Sprint 4 |
