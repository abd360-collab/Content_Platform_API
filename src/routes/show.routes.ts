import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRole } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import { createShow, deleteShow, getAllShows, getShowById, updateShow } from "../controllers/show.controller.js";
import { createShowSchema, listShowsSchema, showIdSchema, updateShowSchema } from "../validators/show.validator.js";
import { createEpisodeSchema, episodeParamsSchema, listEpisodesSchema } from "../validators/episode.validator.js";
import { createEpisode, getEpisodeById, getEpisodesByShowId } from "../controllers/episode.controller.js";
import { followShow, getFollowedShows, unfollowShow } from "../controllers/follow.controller.js";

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


router.get(
    "/me/following",
    requireAuth,
    validate(listShowsSchema, "query"),
    getFollowedShows,
);


export default router;