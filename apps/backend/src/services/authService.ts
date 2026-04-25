import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, refreshTokens } from "../db/schema.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../lib/jwt.js";
import { AppError, UnauthorizedError } from "../lib/errors.js";
import { randomUUID } from "crypto";

function randomAvatarColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue} 70% 60%)`;
}

export async function register(email: string, name: string, password: string) {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError("Email already in use", 409, "EMAIL_TAKEN");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email: email.toLowerCase(),
      name,
      passwordHash,
      avatarColor: randomAvatarColor(),
    })
    .returning();

  if (!user) throw new AppError("Failed to create user", 500);

  return issueTokens(user.id, user.email);
}

export async function login(email: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  if (!user) throw new UnauthorizedError("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid credentials");

  return issueTokens(user.id, user.email);
}

export async function refresh(token: string) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token))
    .limit(1);

  if (!stored || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Refresh token expired or revoked");
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));

  return issueTokens(payload.userId, payload.email);
}

export async function logout(token: string) {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}

async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken({ userId, email });
  const refreshToken = signRefreshToken({ userId, email });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId,
    token: refreshToken,
    expiresAt,
  });

  return { accessToken, refreshToken };
}
