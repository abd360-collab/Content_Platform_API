import express from "express";
import authRoutes from "./modules/auth/auth.routes.js"
import { errorHandler } from "./middleware/error.middleware.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import userRoutes from "./modules/users/user.routes.js";
import showRoutes from "./modules/shows/show.routes.js";
import progressRoutes from "./modules/progress/progress.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";


const app = express();

app.use(requestId);
app.use(requestLogger);
app.use(express.json());

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/shows", showRoutes);
app.use("/api/v1/episodes", progressRoutes);
app.use("/api/v1/admin", adminRoutes);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

app.use(errorHandler);

export default app;