import { Router } from "express";

import { checkAuth, requireRole } from "../../middleware/checkAuth";

import { validate } from "../../middleware/validate";

import { getUsersQuerySchema, updateMeSchema } from "./user.validation";

import { UserController } from "./user.controller";

const router = Router();

router.get("/me", checkAuth, UserController.getMe);

router.patch("/me", checkAuth, validate(updateMeSchema), UserController.updateMe);

router.get("/", checkAuth, requireRole("ADMIN"), validate(getUsersQuerySchema), UserController.getAllUsers);

export const userRoutes = router;