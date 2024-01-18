import { Router } from "express";
import { registerUser } from "../controllers/user.controllers.js";

const router= Router()

Router.route("/register").post(registerUser)

export default router