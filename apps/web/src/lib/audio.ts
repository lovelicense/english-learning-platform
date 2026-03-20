export async function createAudioBlob(chunks: BlobPart[]): Promise<Blob> {
  return new Blob(chunks, { type: "audio/webm" });
}
