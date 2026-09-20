import type { MetadataRoute } from "next";
import { siteConfig } from "./site-config";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteConfig.url,
      lastModified: "2026-09-20",
      changeFrequency: "monthly",
      priority: 1,
      images: siteConfig.galleryImageUrls,
    },
  ];
}
