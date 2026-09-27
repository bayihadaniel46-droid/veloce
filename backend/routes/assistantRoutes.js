const express=require("express");
const auth=require("../middleware/authMiddleware");
const c=require("../controllers/assistantController");
const r=express.Router();r.use(auth);
r.get("/profile",c.getProfile);r.put("/profile",c.updateProfile);r.get("/drafts",c.getDrafts);
r.post("/generate",c.generate);r.post("/drafts/:id/publish",c.publish);r.delete("/drafts/:id",c.dismiss);
module.exports=r;
