import type { Response } from "express";
import type Redis from "ioredis";
import { asyncHandler } from "../../middleware/asyncHandler";
import type { AuthenticatedRequest } from "../../middleware/requireAuth";
import { BloodDonorService } from "./blood_donor.service";
import {
  adminCreateDonorSchema,
  adminDonorListSchema,
  adminUpdateDonorSchema,
  csvImportSchema,
  donorSearchSchema,
  updateMyDonorSchema,
} from "./blood_donor.validation";

const param = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] : (value ?? "");

export class BloodDonorController {
  private service: BloodDonorService;

  constructor(redis?: Redis | null) {
    this.service = new BloodDonorService(redis);
  }

  getMyProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        data: await this.service.getMyProfile(req.user!.id),
      });
    },
  );

  updateMyProfile = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const data = updateMyDonorSchema.parse(req.body);
      res.json({
        success: true,
        data: await this.service.updateMyProfile(req.user!.id, data),
      });
    },
  );

  unregisterSelf = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      await this.service.unregisterSelf(req.user!.id);
      res
        .status(200)
        .json({ message: "Blood donor profile unregistered successfully" });
    },
  );

  search = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = donorSearchSchema.parse(req.query);
    res.json(await this.service.search(query));
  });

  detail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await this.service.getPublicDetail(param(req.params.id)),
    });
  });

  contactLink = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        data: await this.service.createContactLink(
          param(req.params.id),
          req.user!.id,
        ),
      });
    },
  );

  adminCreate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const data = adminCreateDonorSchema.parse(req.body);
      res
        .status(200)
        .json({
          success: true,
          data: await this.service.createAdminDonor(data),
        });
    },
  );

  adminList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const query = adminDonorListSchema.parse(req.query);
    res.json(await this.service.listAdmin(query));
  });

  adminDetail = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        data: await this.service.getAdminDonor(param(req.params.id)),
      });
    },
  );

  adminUpdate = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const data = adminUpdateDonorSchema.parse(req.body);
      res.json({
        success: true,
        data: await this.service.updateAdminDonor(param(req.params.id), data),
      });
    },
  );

  adminDelete = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      await this.service.deleteAdminDonor(param(req.params.id));
      res.status(200).json({ message: "Blood donor deleted successfully" });
    },
  );

  adminVerify = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        data: await this.service.verifyAdminDonor(param(req.params.id)),
      });
    },
  );

  adminSuspend = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      res.json({
        success: true,
        data: await this.service.suspendAdminDonor(param(req.params.id)),
      });
    },
  );

  adminAnalytics = asyncHandler(
    async (_req: AuthenticatedRequest, res: Response) => {
      res.json({ success: true, data: await this.service.analytics() });
    },
  );

  adminImport = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const data = csvImportSchema.parse(req.body);
      res
        .status(200)
        .json({
          success: true,
          data: await this.service.importCsv(data.csvContent),
        });
    },
  );
}
