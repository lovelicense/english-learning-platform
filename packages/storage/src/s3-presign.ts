export function buildAudioObjectKey(fileName: string) {
  return `recordings/raw/${Date.now()}-${fileName}`;
}
