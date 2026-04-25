import { Router } from "express";
import { z } from "zod";
import * as authService from "../services/authService.js";
import { AppError } from "../lib/errors.js";
import type { Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/register", async (req, res, next) => {
  try {
    const { email, name, password } = registerSchema.parse(req.body);
    const tokens = await authService.register(email, name, password);
    res.status(201).json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const tokens = await authService.login(email, password);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.body?.refreshToken as string | undefined;
    if (!token) throw new AppError("Refresh token required", 400);
    const tokens = await authService.refresh(token);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.body?.refreshToken as string | undefined;
    if (token) await authService.logout(token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
