/**
 * Media management utilities for audio, video, and screen capture.
 */

export async function getLocalUserMedia(
  constraints: MediaStreamConstraints = { audio: true, video: true }
): Promise<MediaStream> {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported in this browser or context.');
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function getScreenDisplayMedia(
  options: DisplayMediaStreamOptions = { video: true, audio: true }
): Promise<MediaStream> {
  if (!navigator?.mediaDevices?.getDisplayMedia) {
    throw new Error('getDisplayMedia is not supported in this browser or context.');
  }
  return navigator.mediaDevices.getDisplayMedia(options);
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore if already stopped
    }
  });
}

export function toggleAudioTrack(stream: MediaStream | null): boolean {
  const track = stream?.getAudioTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    return !track.enabled; // true = muted
  }
  return false;
}

export function toggleVideoTrack(stream: MediaStream | null): boolean {
  const track = stream?.getVideoTracks()[0];
  if (track) {
    track.enabled = !track.enabled;
    return !track.enabled; // true = camera disabled
  }
  return false;
}

export async function replaceVideoTrackOnPeerConnection(
  pc: RTCPeerConnection | null,
  newTrack: MediaStreamTrack | null
): Promise<void> {
  if (!pc) return;
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (sender) {
    await sender.replaceTrack(newTrack);
  }
}

export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator?.mediaDevices?.enumerateDevices) {
    return [];
  }
  return navigator.mediaDevices.enumerateDevices();
}
