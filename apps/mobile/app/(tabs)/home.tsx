import { Link, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSessionBootstrap } from "../../src/hooks/use-session-bootstrap";
import { mobileTheme } from "../../src/theme/colors";

const theme = mobileTheme.colors;

export default function HomeScreen() {
  const { user, storedEmail, loading, error, reload } = useSessionBootstrap();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>내말영어</Text>
      <Text style={styles.description}>
        내 말로 배우는 영어학습
      </Text>
      {loading ? (
        <ActivityIndicator color={theme.brand} />
      ) : (
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>로그인 상태: {user?.email ?? storedEmail ?? "로그인되지 않음"}</Text>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>오늘 바로 할 수 있는 것</Text>
        <Text style={styles.heroText}>1. 실제 상황을 녹음하고 STT 결과를 정리하기</Text>
        <Text style={styles.heroText}>2. 한국어 문장을 영어 표현으로 바꾸고 TTS로 듣기</Text>
        <Text style={styles.heroText}>3. 복습 카드에서 텍스트/음성으로 답해보기</Text>
      </View>

      <View style={styles.grid}>
        <Link href="/quick-sentence" asChild>
          <Pressable style={styles.primaryCard}>
            <Text style={styles.primaryCardTitle}>빠른 저장</Text>
            <Text style={styles.primaryCardText}>녹음 없이 한국어 문장을 바로 저장하고 표현으로 만들기</Text>
          </Pressable>
        </Link>
        <Link href="/ai-conversation" asChild>
          <Pressable style={styles.accentCard}>
            <Text style={styles.accentCardTitle}>AI 대화</Text>
            <Text style={styles.accentCardText}>영어 연습 트랙과 한국어 수집 트랙으로 AI 대화 시작</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/record" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>녹음</Text>
            <Text style={styles.secondaryCardText}>실제 녹음, 업로드, STT 처리까지 시작</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/reviews" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>복습</Text>
            <Text style={styles.secondaryCardText}>오늘 복습 카드에서 텍스트/음성 답변</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/expressions" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>표현</Text>
            <Text style={styles.secondaryCardText}>저장한 표현과 TTS를 다시 확인</Text>
          </Pressable>
        </Link>
        <Link href="/learning-assets" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>학습 자산</Text>
            <Text style={styles.secondaryCardText}>패턴/단어 진도와 약한 유형, 연결된 표현 확인</Text>
          </Pressable>
        </Link>
        <Link href="/(tabs)/settings" asChild>
          <Pressable style={styles.secondaryCard}>
            <Text style={styles.secondaryCardTitle}>설정</Text>
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
    backgroundColor: theme.background,
    gap: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.text,
  },
  description: {
    color: theme.textSoft,
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: theme.surfaceMuted,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusPillText: {
    color: theme.textSoft,
    fontWeight: "700",
  },
  heroCard: {
    backgroundColor: theme.brandStrong,
    borderRadius: 24,
    padding: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: "#1f8f85",
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTitle: {
    color: theme.textOnDark,
    fontSize: 20,
    fontWeight: "800",
  },
  heroText: {
    color: "#dcece7",
    lineHeight: 20,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOpacity: 1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
  },
  cardText: {
    color: theme.textSoft,
    lineHeight: 20,
  },
  grid: {
    gap: 12,
  },
  primaryCard: {
    backgroundColor: theme.brand,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.brandStrong,
    shadowColor: theme.shadowStrong,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryCardTitle: {
    color: theme.textOnBrand,
    fontSize: 20,
    fontWeight: "800",
  },
  primaryCardText: {
    color: "#d5ebe4",
    lineHeight: 20,
  },
  accentCard: {
    backgroundColor: theme.accent,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.accentStrong,
  },
  accentCardTitle: {
    color: theme.textOnDark,
    fontSize: 20,
    fontWeight: "800",
  },
  accentCardText: {
    color: "#fff1df",
    lineHeight: 20,
  },
  secondaryCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryCardTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryCardText: {
    color: theme.textSoft,
    lineHeight: 20,
  },
  error: {
    color: theme.danger,
    lineHeight: 20,
  },
});
