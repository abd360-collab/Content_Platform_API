
import { Router } from "express";

import { requireAuth } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/role.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";

import {
    createShow,
    deleteShow,
    getAllShows,
    getShowById,
    getTrendingShows,
    updateShow,
} from "./show.controller.js";

import {
    createShowSchema,
    listShowsSchema,
    listTrendingShowsSchema,
    showIdSchema,
    updateShowSchema,
} from "./show.validator.js";

import {
    createEpisodeSchema,
    episodeParamsSchema,
    listEpisodesSchema,
    updateEpisodeSchema,
} from "../episodes/episode.validator.js";

import {
    createEpisode,
    deleteEpisode,
    getEpisodeById,
    getEpisodesByShowId,
    updateEpisode,
} from "../episodes/episode.controller.js";

import {
    followShow,
    getFollowedShows,
    unfollowShow,
} from "../follows/follow.controller.js";

const router = Router();

router.post(
    "/",
    requireAuth,
    requireRole("ADMIN"),
    validate(createShowSchema),
    createShow,
);

router.get(
    "/",
    validate(listShowsSchema, "query"),
    getAllShows,
);

router.get(
    "/trending",
    validate(listTrendingShowsSchema, "query"),
    getTrendingShows,
);

// Static route must precede /:showId.
router.get(
    "/me/following",
    requireAuth,
    validate(listShowsSchema, "query"),
    getFollowedShows,
);

router.get(
    "/:showId",
    validate(showIdSchema, "params"),
    getShowById,
);

router.patch(
    "/:showId",
    requireAuth,
    requireRole("ADMIN"),
    validate(showIdSchema, "params"),
    validate(updateShowSchema, "body"),
    updateShow,
);

router.delete(
    "/:showId",
    requireAuth,
    requireRole("ADMIN"),
    validate(showIdSchema, "params"),
    deleteShow,
);

router.post(
    "/:showId/episodes",
    requireAuth,
    requireRole("ADMIN"),
    validate(showIdSchema, "params"),
    validate(createEpisodeSchema, "body"),
    createEpisode,
);

router.get(
    "/:showId/episodes",
    validate(showIdSchema, "params"),
    validate(listEpisodesSchema, "query"),
    getEpisodesByShowId,
);

router.get(
    "/:showId/episodes/:episodeId",
    validate(episodeParamsSchema, "params"),
    getEpisodeById,
);

router.post(
    "/:showId/follow",
    requireAuth,
    validate(showIdSchema, "params"),
    followShow,
);

router.delete(
    "/:showId/follow",
    requireAuth,
    validate(showIdSchema, "params"),
    unfollowShow,
);

router.patch(
    "/:showId/episodes/:episodeId",
    requireAuth,
    requireRole("ADMIN"),
    validate(episodeParamsSchema, "params"),
    validate(updateEpisodeSchema, "body"),
    updateEpisode,
);

router.delete(
    "/:showId/episodes/:episodeId",
    requireAuth,
    requireRole("ADMIN"),
    validate(episodeParamsSchema, "params"),
    deleteEpisode,
);

export default router;
