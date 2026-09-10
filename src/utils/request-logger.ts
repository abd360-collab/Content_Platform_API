import { logger } from "../config/logger.js";
import { requestContext } from "./request-context.js";

export function getRequestLogger() {
    return requestContext.getStore()?.logger ?? logger;
}