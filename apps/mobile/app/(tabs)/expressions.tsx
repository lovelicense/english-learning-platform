import { useCallback, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { listExpressions, type ExpressionResponse } from "../../src/lib/api/expressions";

export default function ExpressionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expressions, setExpressions] = useState<ExpressionResponse[]>([]);

  const filteredExpressions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return expressions;
    return expressions.filter((item) =>
      [
        item.koreanText,
        item.englishBase,
        item.englishEasy,
        item.englishNatural,
        item.note ?? "",
        item.userMemo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [expressions, query]);

  const loadExpressions = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const list = await listExpressions();
      setExpressions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "표현 목록 조회에 실패했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExpressions();
    }, [loadExpressions]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.description}>표현 목록을 불러오는 중입니다.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Expressions</Text>
      <Text style={styles.description}>저장한 영어 표현을 다시 찾아 듣고, 상세 화면에서 메모와 TTS를 관리합니다.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>검색 / 새로고침</Text>
        <TextInput
          style={styles.input}
          placeholder="한글, 영어 표현, 메모로 검색"
          value={query}
          onChangeText={setQuery}
        />
        <Pressable style={[styles.secondaryButton, refreshing && styles.buttonDisabled]} onPress={() => void loadExpressions(true)} disabled={refreshing}>
          {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>목록 새로고침</Text>}
        </Pressable>
        <Text style={styles.metaText}>총 {expressions.length}개 · 현재 {filteredExpressions.length}개 표시</Text>
      </View>

      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>표현 목록</Text>
        {filteredExpressions.length > 0 ? (
          filteredExpressions.map((expression) => (
            <Link key={expression.id} href={`/expression/${expression.id}`} asChild>
              <Pressable style={styles.expressionCard}>
                <Text style={styles.expressionKorean}>{expression.koreanText}</Text>
                <Text style={styles.expressionBase}>{expression.englishBase}</Text>
                <Text style={styles.expressionSub}>easy: {expression.englishEasy}</Text>
                <Text style={styles.expressionSub}>natural: {expression.englishNatural}</Text>
                <Text style={styles.metaText}>
                  TTS: {expression.ttsUrl ? "있음" : "없음"} · 연습 {expression.practiceCount ?? 0}회 · 최근 점수 {expression.latestPracticeScore ?? "-"}
                </Text>
                {expression.userMemo ? <Text style={styles.memoText}>memo: {expression.userMemo}</Text> : null}
              </Pressable>
            </Link>
          ))
        ) : (
          <Text style={styles.metaText}>조건에 맞는 표현이 없습니다.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    padding: 24,
    gap: 12
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a"
  },
  description: {
    color: "#475569",
    lineHeight: 22
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    gap: 10
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  buttonDisabled: {
    opacity: 0.6
  },
  expressionCard: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: "#f8fbff"
  },
  expressionKorean: {
    color: "#475569",
    lineHeight: 20
  },
  expressionBase: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 16,
    lineHeight: 24
  },
  expressionSub: {
    color: "#334155",
    lineHeight: 20
  },
  metaText: {
    color: "#64748b",
    lineHeight: 20
  },
  memoText: {
    color: "#0f172a",
    lineHeight: 20
  },
  error: {
    color: "#dc2626",
    lineHeight: 20
  }
});
