import { RecordingDetailClient } from "./recording-detail-client";

type Props = { params: Promise<{ id: string }> };

export default async function RecordingDetailPage({ params }: Props) {
  const { id } = await params;

  return <RecordingDetailClient recordingId={id} />;
}
