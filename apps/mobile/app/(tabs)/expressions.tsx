import { StyleSheet, Text, View } from "react-native";

export default function ExpressionsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Expressions</Text>
      <Text style={styles.description}>
        This tab will reuse the current expression, TTS, and practice APIs after recording detail is connected.
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
