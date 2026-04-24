import { Router } from "express";
import {
  createScheduledSupervision,
  getAllScheduledSupervisions,
  getMyScheduledSupervisions,
  updateScheduledSupervision,
  deleteScheduledSupervision,
} from "../controllers/supervisionSchedule.controller";
import { requireAuth, requireRole } from "../middleware/authMiddleware";

const router = Router();

// ADMIN
router.post(
  "/admin/supervision-schedule",
  requireAuth,
  requireRole("admin"),
  createScheduledSupervision
);

router.get(
  "/admin/supervision-schedule",
  requireAuth,
  requireRole("admin"),
  getAllScheduledSupervisions
);

router.put(
  "/admin/supervision-schedule/:id",
  requireAuth,
  requireRole("admin"),
  updateScheduledSupervision
);

router.delete(
  "/admin/supervision-schedule/:id",
  requireAuth,
  requireRole("admin"),
  deleteScheduledSupervision
);

// SUPERVISOR
router.get(
  "/supervision/my-schedule",
  requireAuth,
  requireRole("supervisor", "admin"),
  getMyScheduledSupervisions
);

export default router;