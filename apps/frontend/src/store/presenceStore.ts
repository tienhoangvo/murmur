import { create } from "zustand";
import type { Presence } from "@murmur/shared";

interface PresenceState {
  members: Record<string, Presence>;

  setAllMembers: (members: Presence[]) => void;
  updateMember: (presence: Presence) => void;
  removeMember: (userId: string) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  members: {},

  setAllMembers: (members) =>
    set(() => ({
      members: Object.fromEntries(members.map((m) => [m.userId, m])),
    })),

  updateMember: (presence) =>
    set((state) => ({
      members: { ...state.members, [presence.userId]: presence },
    })),

  removeMember: (userId) =>
    set((state) => {
      const next = { ...state.members };
      delete next[userId];
      return { members: next };
    }),

  reset: () => set(() => ({ members: {} })),
}));

export const getPresenceState = () => usePresenceStore.getState();
