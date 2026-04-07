import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { pool } from "./db";
import authRoutes from "./routes/auth";
import timeclockRoutes from "./routes/timeclock";
import adminRoutes from "./routes/admin";
import servicesRoutes from "./routes/services";
import supervisionRoutes from "./routes/supervision";
import unitInspectionRoutes from "./routes/unitInspection";
import { requireAuth } from "./middleware/authMiddleware";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/ping", (_req, res) => {
  res.json({ success: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/timeclock", requireAuth, timeclockRoutes);
app.use("/api/unit-inspection", requireAuth, unitInspectionRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", servicesRoutes);
app.use("/api", supervisionRoutes);

app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({
      success: true,
      rows,
      db_type: "MySQL",
    });
  } catch (error) {
    console.error("[HEALTH ERROR]", error);
    res.status(500).json({
      success: false,
      error: "No conecta a MySQL",
    });
  }
});

const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`API lista en http://0.0.0.0:${port}`);
});