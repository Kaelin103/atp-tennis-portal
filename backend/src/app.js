import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import matchRoutes from "./routes/matchRoutes.js";
import playerRoutes from "./routes/playerRoutes.js";
import followRoutes from "./routes/followRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import predictRoutes from "./routes/predictRoutes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      // Allow local dev frontends: 5173/5174 and other 517x ports
      origin: (origin, callback) => {
        const whitelist = [
          "http://localhost:5173",
          "http://127.0.0.1:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5174",
          process.env.CLIENT_URL,
        ].filter(Boolean);
        const devRegex = /^http:\/\/(localhost|127\.0\.0\.1):51\d{2}$/;
        if (!origin || whitelist.includes(origin) || devRegex.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS blocked for origin: ${origin}`));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      // Do not explicitly restrict allowedHeaders; let CORS reflect Access-Control-Request-Headers
      preflightContinue: false,
      optionsSuccessStatus: 204,
    })
  );


  app.use(helmet());
  app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  app.use("/api/auth", authRoutes);
  app.use("/api/matches", matchRoutes);
  app.use("/api/players", playerRoutes);
  app.use("/api/follow", followRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/predict", predictRoutes);

  app.get("/health", (_, res) =>
    res.json({ ok: true, message: "✅ ATP Tennis Portal backend is alive!" })
  );

  app.use((req, res) => {
    res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
  });

  app.use((err, req, res, next) => {
    console.error("❌ [ERROR]", err);
    res
      .status(err.status || 500)
      .json({ message: err.message || "Internal Server Error" });
  });

  return app;
}
