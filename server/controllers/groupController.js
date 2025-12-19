const { EventGroup } = require("../models");

async function listGroups(req, res) {
  const groups = await EventGroup.findAll({
    where: { organizerId: req.user.id },
    order: [["id", "DESC"]],
  });

  return res.json({ groups });
}

async function createGroup(req, res) {
  const { name } = req.body || {};
  if (!name) {
    return res.status(400).json({ message: "name is required" });
  }

  const group = await EventGroup.create({
    name,
    organizerId: req.user.id,
  });

  return res.status(201).json({ group });
}

module.exports = {
  listGroups,
  createGroup,
};
