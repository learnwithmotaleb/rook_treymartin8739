import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { publicLegalRouter } from "./routes/legal";
import { logger } from "./lib/logger";

// Strict rate limiter for public unauthenticated endpoints (waitlist signup, etc.)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later." },
});

const app: Express = express();

// Replit (and most cloud hosts) sit behind a reverse proxy that sets
// X-Forwarded-For. Trust the first hop so express-rate-limit can correctly
// identify client IPs instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Restrict CORS to known origins. Replit preview and dev domains are allowed
// during development; production locks to the canonical getrook.app domain.
const ALLOWED_ORIGINS = new Set([
  "https://getrook.app",
  "https://tryrook.app",
]);
const REPLIT_ORIGIN_RE = /^https:\/\/[a-z0-9-]+\.(replit\.dev|replit\.app|janeway\.replit\.dev)$/;

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(origin) || REPLIT_ORIGIN_RE.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin not allowed — ${origin}`));
    },
  })
);

app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey:
      publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ) ?? process.env.CLERK_PUBLISHABLE_KEY ?? "",
  })),
);

app.use("/api/waitlist", publicLimiter);
app.use("/api/oauth/state", publicLimiter);

app.use("/", publicLegalRouter);
app.use("/api", router);

export default app;
