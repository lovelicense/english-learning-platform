export class RecordingRepository {
  async findById(id: string) {
    return { id, status: "uploaded" };
  }
}
