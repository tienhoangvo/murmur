import { apiClient } from "./client";
import type { Board, CanvasElement } from "@murmur/shared";

export interface CreateBoardPayload {
  teamId: string;
  name?: string;
}

export async function getBoards(teamId: string) {
  const { data } = await apiClient.get<Board[]>("/boards", {
    params: { teamId },
  });
  return data;
}

export async function getBoard(boardId: string) {
  const { data } = await apiClient.get<{ board: Board; role: string }>(
    `/boards/${boardId}`,
  );
  return data;
}

export async function createBoard(payload: CreateBoardPayload) {
  const { data } = await apiClient.post<Board>("/boards", payload);
  return data;
}

export async function getBoardSnapshot(boardId: string) {
  const { data } = await apiClient.get<CanvasElement[]>(
    `/boards/${boardId}/snapshot`,
  );
  return data;
}

export async function deleteBoard(boardId: string) {
  await apiClient.delete(`/boards/${boardId}`);
}
