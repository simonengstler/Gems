import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gems — Music Discovery Circles",
    short_name: "Gems",
    description: "Trade songs and find gems with people you trust.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#174f3d",
    orientation: "portrait-primary",
  };
}
