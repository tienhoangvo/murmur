import { tokenStorage } from "./client";

interface TokenPayload {
  userId: string;
  email: string;
}

export function getCurrentUser(): TokenPayload | null {
  const token = tokenStorage.getAccess();
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return { userId: decoded.userId, email: decoded.email };
  } catch {
    return null;
  }
}
