import { z } from "zod";
import {
  requiredIdentifierInputSchema,
  periodInputSchema,
} from "./common.js";

export const getMaterialDownloadSummaryInputSchema = z
  .object({
    company_id: requiredIdentifierInputSchema.optional(),
    period: periodInputSchema.optional(),
  })
  .strict();

export const materialDownloadSummaryResponseSchema = z
  .object({
    data: z
      .object({
        total_downloads: z.number().int().nonnegative(),
        unique_leads: z.number().int().nonnegative(),
        top_materials: z.array(
          z.object({
            title: z.string(),
            slug: z.string().optional(),
            download_count: z.number().int().nonnegative(),
            conversion_to_lead_rate: z.coerce.number().min(0).max(1).optional(),
          }),
        ),
      })
      .strip(),
  })
  .strip();
