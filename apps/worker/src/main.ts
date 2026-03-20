function generateExpressions(koreanText: string) {
  if (koreanText.includes("데리러")) {
    return "I'm on my way to pick up my kid.";
  }
  return "Sample worker result";
}

console.log("Worker started.");
console.log("Sample job result:", generateExpressions("나 지금 애 데리러 가는 중이야"));

setInterval(() => {
  console.log(`[worker] heartbeat ${new Date().toISOString()}`);
}, 10000);
