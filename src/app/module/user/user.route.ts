import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth.js";

import { validate } from "../../middleware/validate.js";

import { getUsersQuerySchema, updateMeSchema } from "./user.validation.js";

import { UserController } from "./user.controller.js";

const router = Router();

router.get("/me", checkAuth, UserController.getMe);

router.patch("/me", checkAuth, validate(updateMeSchema), UserController.updateMe);

router.get("/", checkAuth, requireRole("ADMIN"), validate(getUsersQuerySchema), UserController.getAllUsers);

export const userRoutes = router;