const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  listProjects,
  createProject,
  getProject,
  getProjectStatus,
  updateProject,
  saveFile,
  importFiles,
  removeFile,
  addCollaborator,
  removeCollaborator
} = require("../controllers/projectController");

const router = express.Router();
router.use(authMiddleware);
router.get("/", listProjects);
router.post("/", createProject);
router.get("/:projectId/status", getProjectStatus);
router.get("/:projectId", getProject);
router.patch("/:projectId", updateProject);
router.put("/:projectId/files", saveFile);
router.post("/:projectId/files/import", importFiles);
router.delete("/:projectId/files", removeFile);
router.post("/:projectId/collaborators", addCollaborator);
router.delete("/:projectId/collaborators/:userId", removeCollaborator);

module.exports = router;
