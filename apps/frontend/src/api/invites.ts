import { apiClient } from "./client";
import type { Role } from "@murmur/shared";

export interface CreateInvitePayload {
  teamId: string;
  email: string;
  role?: Role;
}

export interface Invite {
  id: string;
  teamId: string;
  email: string;
  role: Role;
  token: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export async function getInvites(teamId: string) {
  const { data } = await apiClient.get<Invite[]>("/invites", {
    params: { teamId },
  });
  return data;
}

export async function createInvite(payload: CreateInvitePayload) {
  const { data } = await apiClient.post<Invite>("/invites", payload);
  return data;
}

export async function acceptInvite(token: string) {
  const { data } = await apiClient.post<{ teamId: string; role: Role }>(
    `/invites/${token}/accept`,
  );
  return data;
}

export async function revokeInvite(inviteId: string) {
  await apiClient.delete(`/invites/${inviteId}`);
}
