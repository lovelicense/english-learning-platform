import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSessionBootstrap } from "../../src/hooks/use-session-bootstrap";

export default function HomeScreen() {
  const { user, storedEmail, loading, error, reload } = useSessionBootstrap();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Mobile MVP</Text>
      <Text style={styles.title}>English Learning Mobile</Text>
      <Text style={styles.description}>
        실사용 흐름은 녹음, STT 확인, 표현 생성, 복습 순서입니다. 홈 탭에서는 오늘 바로 들어갈 작업과 현재 앱 준비 상태만 간단히 보여줍니다.
      </Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>오늘 바로 할 수 있는 것</Text>
        <Text style={styles.heroText}>1. 실제 상황을 녹음하고 STT 결과를 정리하기</Text>
        <Text style={styles.heroText}>2. 한국어 문장을 영어 표현으로 바꾸고 TTS로 듣기</Text>
        <Text style={styles.heroText}>3. 복습 카드에서 텍스트/음성으로 답해보기</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Status</Text>
        {loading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <>
            <Text style={styles.cardText}>로그인 상태: {user?.email ?? storedEmail ?? "not signed in"}</Text>
            <Text style={styles.cardText}>모바일 핵심 루프: 구현 완료 후 QA 단계</Text>
            <Text style={styles.cardText}>다음 포커스: 실기기 검증, UX 다듬기, 학습 설정 연결</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.grid}>
        <Link href="/quick-sentence" asChild>
          <Pressable style={styles.primaryCard}>
            <Text style={styles.primaryCardTitle}>Quick Save</Text>
            <Text style={styles.primaryCardText}>녹음 없이 한국어 문장을 바로 저장하고 표현으로 만들기</Text>
          </Pressable>
        </Link>
        <Link href="/ai-conversation" asChild>
          <Pressable style={styles.accentCard}>
            <Text style={styles.accentCardTitle}>AI Conversation</Text>
            <Text style={styles.accentCardText}>영어 연습 트랙과 한국어 수집 트랙으로 AI 대화 시작</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/record" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>Record</Text>
            <Text style={styles.secondaryCardText}>실제 녹음, 업로드, STT 처리까지 시작</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/reviews" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>Reviews</Text>
            <Text style={styles.secondaryCardText}>오늘 복습 카드에서 텍스트/음성 답변</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/expressions" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>Expressions</Text>
            <Text style={styles.secondaryCardText}>저장한 표현과 TTS를 다시 확인</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/settings" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>Settings</Text>
            <Text style={styles.secondaryCardText}>계정, 녹음 기본값, 학습 옵션 관리</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>실기기 테스트 전 체크</Text>
        <Text style={styles.cardText}>1. API 주소 확인</Text>
        <Text style={styles.cardText}>2. 로그인 계정 확인</Text>
        <Text style={styles.cardText}>3. 녹음 권한과 오디오 재생 확인</Text>
        <Text style={styles.cardText}>4. QA 체크리스트 순서대로 실행</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16,
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
  },
  description: {
    color: "#475569",
    lineHeight: 22,
  },
  heroCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 22,
    gap: 8,
  },
  heroTitle: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "800",
  },
  heroText: {
    color: "#cbd5e1",
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardText: {
    color: "#334155",
    lineHeight: 20,
  },
  grid: {
    gap: 12,
  },
  primaryCard: {
    backgroundColor: "#2563eb",
    borderRadius: 20,
    padding: 20,
    gap: 6,
  },
  primaryCardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  primaryCardText: {
    color: "#dbeafe",
    lineHeight: 20,
  },
  accentCard: {
    backgroundColor: "#14532d",
    borderRadius: 20,
    padding: 20,
    gap: 6,
  },
  accentCardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  accentCardText: {
    color: "#dcfce7",
    lineHeight: 20,
  },
  secondaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  secondaryCardTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryCardText: {
    color: "#475569",
    lineHeight: 20,
  },
  error: {
    color: "#dc2626",
    lineHeight: 20,
  },
});
