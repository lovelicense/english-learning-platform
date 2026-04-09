import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function ExpressionDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expression Detail</Text>
      <Text style={styles.description}>Expression id: {params.id ?? "-"}</Text>
      <Text style={styles.description}>
        This screen will later contain English variants, TTS playback, speaking test entry, and memo editing.
      </Text>
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
  }
});
