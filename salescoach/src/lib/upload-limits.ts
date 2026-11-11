export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARS = 250_000;
export const MAX_CALL_DURATION_SECONDS = 4 * 60 * 60;

export const AUDIO_TYPES: Record<string, string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/m4a"],
  webm: ["audio/webm"],
};

export function audioExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return extension in AUDIO_TYPES ? extension : null;
}

export function validAudioType(extension: string, mimeType: string) {
  return Boolean(AUDIO_TYPES[extension]?.includes(mimeType.toLowerCase()));
}

export function validAudioSignature(buffer: Uint8Array, extension: string) {
  if (extension === "wav") {
    return matches(buffer, 0, [0x52, 0x49, 0x46, 0x46]) && matches(buffer, 8, [0x57, 0x41, 0x56, 0x45]);
  }
  if (extension === "m4a") {
    return matches(buffer, 4, [0x66, 0x74, 0x79, 0x70]);
  }
  if (extension === "webm") {
    return matches(buffer, 0, [0x1a, 0x45, 0xdf, 0xa3]);
  }
  if (extension === "mp3") {
    return (
      matches(buffer, 0, [0x49, 0x44, 0x33]) ||
      (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    );
  }
  return false;
}

function matches(buffer: Uint8Array, offset: number, bytes: number[]) {
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

export function audioLimitLabel() {
  return `${Math.round(MAX_AUDIO_BYTES / 1024 / 1024)} MB`;
}
