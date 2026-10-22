import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { searchHandler } from "./search.controller";

const router = Router();

router.get("/", asyncHandler(searchHandler));

export const searchRouter = router;
