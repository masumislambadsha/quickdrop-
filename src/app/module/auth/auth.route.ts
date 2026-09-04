import { Router } from "express";

import { authRateLimiter } from "../../middleware/rateLimiter";

import { checkAuth } from "../../middleware/checkAuth";

import { validate } from "../../middleware/validate";

import {
	changePasswordSchema,
	googleLoginSchema,
	loginSchema,
	refreshTokenSchema,
	registerSchema,
} from "./auth.validation";

import { AuthController } from "./auth.controller";

import { GoogleAuthController } from "./auth.google.controller";

const router = Router();

router.post("/register", authRateLimiter, validate(registerSchema), AuthController.registerUser);

router.post("/login", authRateLimiter, validate(loginSchema), AuthController.loginUser);

router.post("/google/login", authRateLimiter, validate(googleLoginSchema), GoogleAuthController.googleLogin);

router.get("/google/callback", GoogleAuthController.googleCallback);

router.post("/refresh-token", validate(refreshTokenSchema), AuthController.refreshToken);

router.post("/logout", checkAuth, AuthController.logout);

router.post("/change-password", checkAuth, validate(changePasswordSchema), AuthController.changePassword);

export const authRoutes = router;