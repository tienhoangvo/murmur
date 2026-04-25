import { apiClient } from "./client";
import type { Team, Role } from "@murmur/shared";

export interface CreateTeamPayload {
  name: string;
}

export interface UpdateMemberRolePayload {
  userId: string;
  role: Role;
}

export async function getTeams() {
  const { data } =
    await apiClient.get<Array<{ team: Team; role: Role }>>("/teams");
  return data;
}

export async function getTeam(teamId: string) {
  const { data } = await apiClient.get<Team>(`/teams/${teamId}`);
  return data;
}

export async function createTeam(payload: CreateTeamPayload) {
  const { data } = await apiClient.post<Team>("/teams", payload);
  return data;
}

export async function updateMemberRole(
  teamId: string,
  payload: UpdateMemberRolePayload,
) {
  const { data } = await apiClient.patch<{ role: Role }>(
    `/teams/${teamId}/members`,
    payload,
  );
  return data;
}

export async function removeMember(teamId: string, userId: string) {
  await apiClient.delete(`/teams/${teamId}/members/${userId}`);
}
