import express from "express";
import authRoutes from "./routes/auth.routes.js"
import { errorHandler } from "./middleware/error.middleware.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";

const app = express();

app.use(requestId);
app.use(requestLogger);
app.use(express.json());

app.use("/api/v1/auth", authRoutes);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
    });
});

app.use(errorHandler);

export default app;