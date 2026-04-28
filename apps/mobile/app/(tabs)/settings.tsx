import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE_URL, API_BASE_URL_SOURCE } from "../../src/lib/config";

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.description}>
        Add API environment, account information, recording options, and mobile analysis preferences here.
      </Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>API Base URL</Text>
        <Text style={styles.cardValue}>{API_BASE_URL}</Text>
        <Text style={styles.description}>
          source: {API_BASE_URL_SOURCE}
        </Text>
      </View>
      <Link href="/(auth)/login" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Open Login Placeholder</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 16,
    padding: 16,
    gap: 8
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a"
  },
  cardValue: {
    color: "#334155"
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "700"
  }
});
