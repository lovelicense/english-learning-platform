type Props = { params: { id: string } };

export default function RecordingDetailPage({ params }: Props) {
  return (
    <main className="p-8">
      <h1 className="text-xl font-semibold">Recording #{params.id}</h1>
      <p className="text-sm text-gray-500">화자 선택, 문장 추출, 표현 생성을 여기에 붙입니다.</p>
    </main>
  );
}
