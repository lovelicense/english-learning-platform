export function getDbClient() {
  return {
    recording: { findUnique: async () => null },
  };
}
