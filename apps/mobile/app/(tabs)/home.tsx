import { useCallback } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSessionBootstrap } from "../../src/hooks/use-session-bootstrap";

export default function HomeScreen() {
  const { user, storedEmail, loading, error, reload, logout } = useSessionBootstrap();

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Android MVP</Text>
      <Text style={styles.title}>English Learning Mobile</Text>
      <Text style={styles.description}>
        Start with login, recording, session upload, and STT result confirmation. Reuse the current API and worker flow.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session Status</Text>
        {loading ? (
          <ActivityIndicator color="#2563eb" style={styles.loader} />
        ) : (
          <>
            <Text style={styles.cardText}>stored: {storedEmail || "-"}</Text>
            <Text style={styles.cardText}>server: {user?.email ?? "not signed in"}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
        <View style={styles.row}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{user ? "계정 전환" : "로그인"}</Text>
            </Pressable>
          </Link>
          <Pressable style={styles.secondaryButton} onPress={() => void reload()}>
            <Text style={styles.secondaryButtonText}>세션 새로고침</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void logout()}>
            <Text style={styles.secondaryButtonText}>로그아웃</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recommended build order</Text>
        <Text style={styles.cardText}>1. Login and token storage</Text>
        <Text style={styles.cardText}>2. Recording session creation</Text>
        <Text style={styles.cardText}>3. Part upload and finalize</Text>
        <Text style={styles.cardText}>4. STT result screen</Text>
      </View>

      <Link href="/(tabs)/record" asChild>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open Recording MVP</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
    gap: 16
  },
  eyebrow: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1
  },
  title: {
    fontSize: 30,
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
    gap: 8
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a"
  },
  cardText: {
    color: "#334155"
  },
  loader: {
    marginTop: 8,
    marginBottom: 8
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700"
  },
  error: {
    marginTop: 8,
    color: "#dc2626"
  }
});
