import "dotenv/config"
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

const PORT = Number(env.PORT) || 3000;


app.listen(PORT, () => {
    logger.info(
        { port: PORT },
        "Server started",
    );
});