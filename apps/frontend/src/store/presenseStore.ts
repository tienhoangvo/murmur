import { create } from "zustand";
import type { Presence } from "@murmur/shared";

interface PresenceState {
  members: Map<string, Presence>;

  // actions
  setAllMembers: (members: Presence[]) => void;
  updateMember: (presence: Presence) => void;
  removeMember: (userId: string) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  members: new Map(),

  setAllMembers: (members) =>
    set(() => ({
      members: new Map(members.map((m) => [m.userId, m])),
    })),

  updateMember: (presence) =>
    set((state) => {
      const next = new Map(state.members);
      next.set(presence.userId, presence);
      return { members: next };
    }),

  removeMember: (userId) =>
    set((state) => {
      const next = new Map(state.members);
      next.delete(userId);
      return { members: next };
    }),

  reset: () =>
    set(() => ({
      members: new Map(),
    })),
}));

export const getPresenceState = () => usePresenceStore.getState();
