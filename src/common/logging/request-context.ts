import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";

interface RequestContext {
    requestId: string;
    logger: Logger;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();