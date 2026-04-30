import { apiFetch } from "./client";
import type { PersonProfileResponse } from "./recordings";

export async function listPersonProfiles() {
  return apiFetch<PersonProfileResponse[]>("/person-profiles");
}

export async function createPersonProfile(input: {
  name: string;
  roleLabel?: string;
  relationshipToMe?: string;
  aliases?: string;
  notes?: string;
  isMe?: boolean;
}) {
  return apiFetch<PersonProfileResponse>("/person-profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updatePersonProfile(
  personProfileId: string,
  input: {
    name: string;
    roleLabel?: string;
    relationshipToMe?: string;
    aliases?: string;
    notes?: string;
    isMe?: boolean;
  },
) {
  return apiFetch<PersonProfileResponse>(`/person-profiles/${personProfileId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deletePersonProfile(personProfileId: string) {
  return apiFetch<{ success: boolean }>(`/person-profiles/${personProfileId}`, {
    method: "DELETE",
  });
}
