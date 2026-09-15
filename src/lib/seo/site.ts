import { env } from "@/env";

export const PRODUCT_NAME = "Watchily";

export const DEFAULT_DESCRIPTION =
  "Descubre dónde ver películas y series en streaming: plataformas, suscripción, alquiler y compra por región.";

export const DEFAULT_OG_IMAGE_PATH = "/window.svg";

export function getSiteUrl(): string {
  const configured = env.NEXT_PUBLIC_SITE_URL || env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercel = env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "https://watchily.wayool.com";
}

const PRODUCTION_GIT_BRANCHES = new Set(["main", "master"]);

export function isPreviewDeployment(): boolean {
  if (env.VERCEL_ENV === "preview") return true;

  const branch = env.VERCEL_GIT_COMMIT_REF;
  if (branch && !PRODUCTION_GIT_BRANCHES.has(branch)) return true;

  return false;
}

/** Block indexing on preview deployments unless explicitly overridden. */
export function allowSearchIndexing(): boolean {
  if (env.OMNI_ALLOW_PREVIEW_INDEX === "true") return true;
  return !isPreviewDeployment();
}
