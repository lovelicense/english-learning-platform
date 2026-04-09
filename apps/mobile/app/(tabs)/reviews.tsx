import { StyleSheet, Text, View } from "react-native";

export default function ReviewsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reviews</Text>
      <Text style={styles.description}>
        Planned for phase 2 after recording upload, STT, expression generation, and TTS playback are stable.
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
