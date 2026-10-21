import {
  VoxCallConfig,
  VoxCallEvent,
  EventCallback,
  SignalingMessage,
} from './types';
import {
  getLocalUserMedia,
  getScreenDisplayMedia,
  stopMediaStream,
  toggleAudioTrack,
  toggleVideoTrack,
  replaceVideoTrackOnPeerConnection,
} from './media';
import { SignalingClient } from './signaling';

export * from './types';
export * from './media';
export * from './signaling';

export class VoxCall {
  private pc: RTCPeerConnection | null = null;
  private signaling: SignalingClient | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private events: Map<string, EventCallback[]> = new Map();
  private roomId: string = '';
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private defaultIceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  constructor(private config: VoxCallConfig) {
    if (!this.config.iceServers || this.config.iceServers.length === 0) {
      this.config.iceServers = this.defaultIceServers;
    }
  }

  /**
   * Acquire local camera and microphone stream
   */
  async initMedia(
    constraints: MediaStreamConstraints = { audio: true, video: true }
  ): Promise<MediaStream> {
    try {
      this.localStream = await getLocalUserMedia(constraints);
      this.emit('local-stream', this.localStream);
      return this.localStream;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Connect to signaling server and join a calling room
   */
  join(roomId: string): void {
    this.roomId = roomId;
    this.signaling = new SignalingClient(this.config.signalingUrl);

    this.signaling.onMessage(async (msg: SignalingMessage) => {
      try {
        await this.handleSignalingMessage(msg);
      } catch (err) {
        this.emit('error', err);
      }
    });

    this.signaling.onError((err) => {
      this.emit('error', err);
    });

    this.signaling.onClose(() => {
      // Handle signaling disconnect if needed
    });

    this.signaling.connect(() => {
      this.signaling?.send({
        type: 'join_room',
        roomId: this.roomId,
      });
    });
  }

  private async createPeerConnection(isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.pendingCandidates = [];
    this.pc = new RTCPeerConnection({ iceServers: this.config.iceServers });

    // 1. Add local media tracks to connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.pc?.addTrack(track, this.localStream!);
      });
    }

    // 2. Handle remote media streams
    this.pc.ontrack = (event: RTCTrackEvent) => {
      const [stream] = event.streams;
      if (stream) {
        this.remoteStream = stream;
        this.emit('remote-stream', stream);
      }
    };

    // 3. Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.emit('connection-state-changed', this.pc.connectionState);
      }
    };

    // 4. Handle ICE candidates
    this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate && this.signaling?.isConnected()) {
        this.signaling.send({
          type: 'ice_candidate',
          roomId: this.roomId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // 5. If we initiated the call, create and send SDP offer
    if (isInitiator) {
      try {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.signaling?.send({
          type: 'sdp_offer',
          roomId: this.roomId,
          sdp: offer,
        });
      } catch (err) {
        this.emit('error', err);
      }
    }

    return this.pc;
  }

  private async handleSignalingMessage(msg: SignalingMessage): Promise<void> {
    switch (msg.type) {
      case 'user_joined':
        this.emit('user-joined', null);
        await this.createPeerConnection(true);
        break;

      case 'sdp_offer':
        if (msg.sdp) {
          await this.createPeerConnection(false);
          await this.pc?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          
          // Process any queued candidates
          while (this.pendingCandidates.length > 0) {
            const cand = this.pendingCandidates.shift();
            if (cand && this.pc) {
              await this.pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }

          const answer = await this.pc?.createAnswer();
          if (answer) {
            await this.pc?.setLocalDescription(answer);
            this.signaling?.send({
              type: 'sdp_answer',
              roomId: this.roomId,
              sdp: answer,
            });
          }
        }
        break;

      case 'sdp_answer':
        if (msg.sdp && this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          
          // Process any queued candidates
          while (this.pendingCandidates.length > 0) {
            const cand = this.pendingCandidates.shift();
            if (cand && this.pc) {
              await this.pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          }
        }
        break;

      case 'ice_candidate':
        if (msg.candidate) {
          if (this.pc && this.pc.remoteDescription) {
            await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } else {
            this.pendingCandidates.push(msg.candidate);
          }
        }
        break;

      case 'user_left':
        this.emit('user-left', null);
        this.remoteStream = null;
        if (this.pc) {
          this.pc.close();
          this.pc = null;
        }
        break;
    }
  }

  /**
   * Toggle Audio Mute / Unmute
   * @returns true if muted, false if unmuted
   */
  toggleMute(): boolean {
    return toggleAudioTrack(this.localStream);
  }

  /**
   * Toggle Video On / Off
   * @returns true if camera off, false if camera on
   */
  toggleVideo(): boolean {
    return toggleVideoTrack(this.localStream);
  }

  /**
   * Start Screen Sharing and replace existing video track in connection
   */
  async startScreenShare(): Promise<MediaStream> {
    try {
      this.screenStream = await getScreenDisplayMedia({ video: true });
      const screenTrack = this.screenStream.getVideoTracks()[0];

      if (!screenTrack) {
        throw new Error('No video track found in screen stream');
      }

      // Replace current video track in the WebRTC peer connection
      await replaceVideoTrackOnPeerConnection(this.pc, screenTrack);

      // Revert back to camera when screen sharing stops
      screenTrack.onended = async () => {
        const cameraTrack = this.localStream?.getVideoTracks()[0] ?? null;
        await replaceVideoTrackOnPeerConnection(this.pc, cameraTrack);
        this.screenStream = null;
      };

      return this.screenStream;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Hang up and leave the call
   */
  leave(): void {
    // Stop local media
    stopMediaStream(this.localStream);
    stopMediaStream(this.screenStream);
    this.localStream = null;
    this.screenStream = null;
    this.remoteStream = null;

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Notify signaling and close WebSocket
    if (this.signaling && this.signaling.isConnected()) {
      this.signaling.send({ type: 'leave_room', roomId: this.roomId });
      this.signaling.close();
    }
    this.signaling = null;

    this.emit('call-ended', null);
  }

  /**
   * Event listener subscription
   */
  on(event: VoxCallEvent, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: VoxCallEvent, callback: EventCallback): void {
    const listeners = this.events.get(event);
    if (!listeners) return;
    this.events.set(
      event,
      listeners.filter((cb) => cb !== callback)
    );
  }

  /**
   * Emit event to registered listeners
   */
  private emit(event: VoxCallEvent, data: any): void {
    const listeners = this.events.get(event) || [];
    listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in VoxCall '${event}' event listener:`, err);
      }
    });
  }

  /**
   * Get active local media stream
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Get active remote media stream
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Get underlying RTCPeerConnection instance for advanced usage
   */
  getPeerConnection(): RTCPeerConnection | null {
    return this.pc;
  }
}
