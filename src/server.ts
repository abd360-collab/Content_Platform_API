
import "dotenv/config";

import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { MediaCleanupService } from "./modules/media/media-cleanup.service.js";

const PORT = Number(env.PORT) || 3000;

const mediaCleanupService = new MediaCleanupService();

app.listen(PORT, () => {
    logger.info(
        { port: PORT },
        "Server started",
    );

    // Run media recovery without blocking HTTP server startup.
    void mediaCleanupService.run().catch((error: unknown) => {
        logger.error(
            { err: error },
            "Media cleanup failed during startup",
        );
    });
});
