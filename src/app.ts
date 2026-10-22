import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import authRoutes from "./modules/auth/authRoutes";
import { meRouter } from "./modules/users/user.routes";
import userAdminRoutes from "./modules/users/userAdmin.routes";
import deviceRoutes from "./modules/users/device.routes";
import { API_PREFIX } from "./modules/users/user.constants";
import hospitalRoutes from "./modules/hospitals/hospital.routes";
import hospitalAdminRoutes from "./modules/hospitals/hospitalAdmin.routes";
import doctorRoutes from "./modules/doctors/doctor.routes";
import doctorAdminRoutes from "./modules/doctors/doctorAdmin.routes";
import {
  specializationAdminRouter,
  specializationsRouter,
} from "./modules/specializations/specializations.routes";
import { notificationRouter } from "./modules/notifications/notification.routes";
import { searchRouter } from "./modules/search/search.routes";
import { geoRouter } from "./modules/geo/geo.routes";
import { bookingIntentRouter } from "./modules/booking_intents/booking_intent.routes";
import { reviewRouter } from "./modules/reviews/review.routes";
import reviewAdminRoutes from "./modules/reviews/reviewAdmin.routes";
import adminRoutes from "./modules/admin/admin.routes";
import { createBloodDonorRoutes } from "./modules/blood_donor/blood_donor.routes";
import { getRedisClient } from "./db/redis";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { responseFormatter } from "./middleware/responseFormatter";
import { localizationMiddleware } from "./middleware/localizationMiddleware";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);

  // Serve uploads BEFORE helmet so we can set cross-origin headers without
  // helmet overriding them with same-origin policy (which blocks image loads
  // from different origins / the frontend dev server).
  app.use(
    "/uploads",
    (_req: Request, res: Response, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");
      next();
    },
    express.static(path.join(process.cwd(), "uploads")),
  );

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));
  app.use(localizationMiddleware);
  app.use(responseFormatter);

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "Hospital Discovery Platform API",
      baseRoute: API_PREFIX,
      supportedLocales: ["en", "hi", "or"],
      localizationInfo: {
        description: "Use 'x-locale' header to set language",
        supportedValues: {
          en: "English",
          hi: "हिन्दी (Hindi)",
          or: "ଓଡ଼ିଆ (Odia)",
        },
        defaultLocale: "en",
        example: "x-locale: hi",
      },
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", locale: ((_req as any).locale || "en") });
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", locale: ((_req as any).locale || "en") });
  });

  // Routes
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/me`, meRouter);
  app.use(`${API_PREFIX}/devices`, deviceRoutes);
  app.use(`${API_PREFIX}/admin/users`, userAdminRoutes);
  app.use(`${API_PREFIX}/hospitals`, hospitalRoutes);
  app.use(`${API_PREFIX}/admin/hospitals`, hospitalAdminRoutes);
  app.use(`${API_PREFIX}/doctors`, doctorRoutes);
  app.use(`${API_PREFIX}/admin/doctors`, doctorAdminRoutes);
  app.use(`${API_PREFIX}/specializations`, specializationsRouter);
  app.use(`${API_PREFIX}/admin/specializations`, specializationAdminRouter);
  app.use(`${API_PREFIX}/notifications`, notificationRouter);
  app.use(`${API_PREFIX}/search`, searchRouter);
  app.use(`${API_PREFIX}/geo`, geoRouter);
  app.use(`${API_PREFIX}/booking-intents`, bookingIntentRouter);
  app.use(`${API_PREFIX}/reviews`, reviewRouter);
  app.use(`${API_PREFIX}/admin/booking-intents`, bookingIntentRouter);
  app.use(`${API_PREFIX}/admin/reviews`, reviewAdminRoutes);

  // Blood Donor Routes
  const redisClient = getRedisClient();
  if (!redisClient) {
    console.warn(
      "Redis client not available. Blood donor contact rate limiting will use an in-memory fallback.",
    );
  }
  app.use(`${API_PREFIX}`, createBloodDonorRoutes(redisClient));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
