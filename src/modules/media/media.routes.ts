
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";

import {
    generateUploadSignature,
    verifyUpload,
} from "./media.controller.js";

import {
    generateUploadSignatureSchema,
    verifyUploadSchema,
} from "./media.validator.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.post(
    "/upload-signature",
    validate(generateUploadSignatureSchema, "body"),
    generateUploadSignature,
);

router.post(
    "/verify-upload",
    validate(verifyUploadSchema, "body"),
    verifyUpload,
);

export default router;
