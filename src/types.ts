export interface VoxCallConfig {
  signalingUrl: string;
  iceServers?: RTCIceServer[];
}

export type VoxCallEvent =
  | 'local-stream'
  | 'remote-stream'
  | 'user-joined'
  | 'user-left'
  | 'call-ended'
  | 'error'
  | 'connection-state-changed';

export type EventCallback<T = any> = (data: T) => void;

export type SignalingMessageType =
  | 'join_room'
  | 'user_joined'
  | 'sdp_offer'
  | 'sdp_answer'
  | 'ice_candidate'
  | 'leave_room'
  | 'user_left';

export interface SignalingMessage {
  type: SignalingMessageType;
  roomId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  payload?: any;
}
