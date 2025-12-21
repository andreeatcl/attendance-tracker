const express = require("express");
const { authRequired } = require("../middleware/auth");
const { requireRole } = require("../middleware/requireRole");
const {
  listGroups,
  createGroup,
  updateGroupSettings,
  deleteGroup,
} = require("../controllers/groupController");
const {
  listEventsForGroup,
  createEvent,
} = require("../controllers/eventController");

const router = express.Router();

router.use(authRequired);
router.use(requireRole("organizer"));

router.get("/", listGroups);
router.post("/", createGroup);

router.patch("/:groupId/settings", updateGroupSettings);

router.delete("/:groupId", deleteGroup);

router.get("/:groupId/events", listEventsForGroup);
router.post("/:groupId/events", createEvent);

module.exports = router;
