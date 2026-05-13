import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  createPersonProfile,
  deletePersonProfile,
  listPersonProfiles,
  updatePersonProfile,
} from "../src/lib/api/person-profiles";
import type { PersonProfileResponse } from "../src/lib/api/recordings";
import { mobileTheme } from "../src/theme/colors";

type PersonProfileDraft = {
  name: string;
  roleLabel: string;
  relationshipToMe: string;
  aliases: string;
  notes: string;
  isMe: boolean;
};

const EMPTY_DRAFT: PersonProfileDraft = {
  name: "",
  roleLabel: "",
  relationshipToMe: "",
  aliases: "",
  notes: "",
  isMe: false,
};

const theme = mobileTheme.colors;

function toDraft(profile?: PersonProfileResponse | null): PersonProfileDraft {
  if (!profile) return EMPTY_DRAFT;
  return {
    name: profile.name,
    roleLabel: profile.roleLabel ?? "",
    relationshipToMe: profile.relationshipToMe ?? "",
    aliases: profile.aliases ?? "",
    notes: profile.notes ?? "",
    isMe: Boolean(profile.isMe),
  };
}

export default function PersonProfilesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [profiles, setProfiles] = useState<PersonProfileResponse[]>([]);
  const [query, setQuery] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [draft, setDraft] = useState<PersonProfileDraft>(EMPTY_DRAFT);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );
  const filteredProfiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return profiles;
    return profiles.filter((profile) =>
      [profile.name, profile.roleLabel, profile.relationshipToMe, profile.aliases]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [profiles, query]);

  const loadProfiles = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    try {
      const next = await listPersonProfiles();
      setProfiles(next);
      setSelectedProfileId((current) => (current && next.some((profile) => profile.id === current) ? current : ""));
      setDraft((currentDraft) => {
        if (!selectedProfileId) return currentDraft;
        const matched = next.find((profile) => profile.id === selectedProfileId);
        return matched ? toDraft(matched) : currentDraft;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "개인 인물 사전을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProfileId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfiles();
    }, [loadProfiles]),
  );

  function handleSelectProfile(profile: PersonProfileResponse) {
    setSelectedProfileId(profile.id);
    setDraft(toDraft(profile));
    setError("");
    setMessage("");
  }

  function handleCreateNew() {
    setSelectedProfileId("");
    setDraft(EMPTY_DRAFT);
    setError("");
    setMessage("");
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: draft.name.trim(),
      ...(draft.roleLabel.trim() ? { roleLabel: draft.roleLabel.trim() } : {}),
      ...(draft.relationshipToMe.trim() ? { relationshipToMe: draft.relationshipToMe.trim() } : {}),
      ...(draft.aliases.trim() ? { aliases: draft.aliases.trim() } : {}),
      ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
      isMe: draft.isMe,
    };

    try {
      const saved = selectedProfileId
        ? await updatePersonProfile(selectedProfileId, payload)
        : await createPersonProfile(payload);

      setProfiles((current) => {
        if (selectedProfileId) {
          return current.map((profile) => (profile.id === saved.id ? saved : profile));
        }
        return [saved, ...current];
      });
      setSelectedProfileId(saved.id);
      setDraft(toDraft(saved));
      setMessage(selectedProfileId ? "인물 정보를 저장했습니다." : "새 인물을 추가했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인물 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function runDeleteProfile(profile: PersonProfileResponse) {
    setDeletingId(profile.id);
    setError("");
    setMessage("");
    try {
      await deletePersonProfile(profile.id);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      if (selectedProfileId === profile.id) {
        setSelectedProfileId("");
        setDraft(EMPTY_DRAFT);
      }
      setMessage("인물을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "인물 삭제에 실패했습니다.");
    } finally {
      setDeletingId("");
    }
  }

  function handleDeleteProfile(profile: PersonProfileResponse) {
    const confirmMessage = `"${profile.name}" 인물을 삭제할까요? 녹음 상세에서 연결은 다시 설정해야 합니다.`;

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(confirmMessage)) {
        void runDeleteProfile(profile);
      }
      return;
    }

    Alert.alert("인물 삭제", confirmMessage, [
      { text: "취소", style: "cancel" },
      { text: "삭제", style: "destructive", onPress: () => void runDeleteProfile(profile) },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>개인 인물 사전</Text>
      <Text style={styles.description}>
        자주 등장하는 가족, 친구, 선생님 같은 인물을 미리 등록해 두면 녹음 상세에서 관련 인물 선택과 화자 연결이 빨라집니다.
      </Text>

      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>등록된 인물</Text>
          <Pressable
            style={[styles.secondaryButton, refreshing && styles.buttonDisabled]}
            onPress={() => void loadProfiles(true)}
            disabled={refreshing}
          >
            {refreshing ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.secondaryButtonText}>새로고침</Text>}
          </Pressable>
        </View>
        <TextInput
          style={styles.input}
          placeholder="이름, 역할, 관계, 별칭 검색"
          value={query}
          onChangeText={setQuery}
        />
        <Pressable style={styles.secondaryButton} onPress={handleCreateNew}>
          <Text style={styles.secondaryButtonText}>새 인물 추가</Text>
        </Pressable>
        {loading ? (
          <ActivityIndicator color={theme.brand} />
        ) : filteredProfiles.length > 0 ? (
          filteredProfiles.map((profile) => {
            const selected = selectedProfileId === profile.id;
            return (
              <Pressable
                key={profile.id}
                style={[styles.profileCard, selected && styles.profileCardSelected]}
                onPress={() => handleSelectProfile(profile)}
              >
                <View style={styles.profileHead}>
                  <View style={styles.profileTitleWrap}>
                    <Text style={styles.profileName}>
                      {profile.name}
                      {profile.isMe ? " · 나" : ""}
                    </Text>
                    <Text style={styles.profileMeta}>
                      {[profile.roleLabel, profile.relationshipToMe].filter(Boolean).join(" / ") || "역할/관계 없음"}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.dangerButtonSmall, deletingId === profile.id && styles.buttonDisabled]}
                    onPress={() => handleDeleteProfile(profile)}
                    disabled={deletingId === profile.id}
                  >
                    {deletingId === profile.id ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.dangerButtonText}>삭제</Text>
                    )}
                  </Pressable>
                </View>
                {profile.aliases ? <Text style={styles.profileMeta}>별칭: {profile.aliases}</Text> : null}
                {profile.notes ? <Text style={styles.profileMeta}>메모: {profile.notes}</Text> : null}
              </Pressable>
            );
          })
        ) : (
          <Text style={styles.helperText}>
            {profiles.length === 0 ? "아직 등록된 인물이 없습니다." : "검색 조건에 맞는 인물이 없습니다."}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{selectedProfile ? "인물 수정" : "새 인물 추가"}</Text>
        <Text style={styles.fieldLabel}>이름</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 엄마, 민지 선생님"
          value={draft.name}
          onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
        />

        <Text style={styles.fieldLabel}>역할</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 엄마, 선생님, 친구"
          value={draft.roleLabel}
          onChangeText={(value) => setDraft((current) => ({ ...current, roleLabel: value }))}
        />

        <Text style={styles.fieldLabel}>나와의 관계</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 어머니, 아이 담임"
          value={draft.relationshipToMe}
          onChangeText={(value) => setDraft((current) => ({ ...current, relationshipToMe: value }))}
        />

        <Text style={styles.fieldLabel}>별칭</Text>
        <TextInput
          style={styles.input}
          placeholder="예: 엄마, mother / 미나쌤"
          value={draft.aliases}
          onChangeText={(value) => setDraft((current) => ({ ...current, aliases: value }))}
        />

        <Text style={styles.fieldLabel}>메모</Text>
        <TextInput
          style={styles.multilineInput}
          multiline
          value={draft.notes}
          onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
          placeholder="상황 설명이나 말투 힌트를 적어둘 수 있습니다."
        />

        <View style={styles.switchRow}>
          <View style={styles.switchTextBlock}>
            <Text style={styles.switchTitle}>이 인물을 나로 표시</Text>
            <Text style={styles.helperText}>녹음 맥락 추론에서 사용자 본인으로 다룹니다.</Text>
          </View>
          <Switch value={draft.isMe} onValueChange={(value) => setDraft((current) => ({ ...current, isMe: value }))} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.primaryButton, saving && styles.buttonDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>{selectedProfile ? "인물 저장" : "인물 추가"}</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleCreateNew}>
            <Text style={styles.secondaryButtonText}>입력 초기화</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.background,
    padding: 24,
    gap: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
  },
  description: {
    color: theme.textSoft,
    lineHeight: 22,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.text,
  },
  headRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: theme.text,
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 100,
    color: theme.text,
    textAlignVertical: "top",
  },
  fieldLabel: {
    color: theme.text,
    fontWeight: "700",
  },
  helperText: {
    color: theme.textMuted,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: theme.brand,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.textOnBrand,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: theme.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: theme.text,
    fontWeight: "800",
  },
  dangerButtonSmall: {
    backgroundColor: theme.danger,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    color: theme.textOnDark,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  profileCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
    backgroundColor: theme.surface,
  },
  profileCardSelected: {
    borderColor: theme.brand,
    backgroundColor: theme.surfaceBrand,
  },
  profileHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  profileTitleWrap: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: theme.text,
    fontWeight: "800",
    fontSize: 16,
  },
  profileMeta: {
    color: theme.textSoft,
    lineHeight: 20,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    paddingVertical: 4,
  },
  switchTextBlock: {
    flex: 1,
    gap: 4,
  },
  switchTitle: {
    color: theme.text,
    fontWeight: "700",
  },
  error: {
    color: theme.danger,
    lineHeight: 20,
  },
  success: {
    color: theme.success,
    lineHeight: 20,
  },
});
