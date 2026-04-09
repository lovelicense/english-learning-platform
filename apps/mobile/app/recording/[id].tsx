import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function RecordingDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recording Detail</Text>
      <Text style={styles.description}>Recording id: {params.id ?? "-"}</Text>
      <Text style={styles.description}>
        This screen is reserved for STT result viewing, utterance editing, mine-speaker selection, and expression generation.
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
