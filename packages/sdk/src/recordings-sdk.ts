export async function processRecording(apiUrl: string, recordingId: string) {
  const response = await fetch(`${apiUrl}/recordings/${recordingId}/process`, { method: "POST" });
  return response.json();
}
