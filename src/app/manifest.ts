import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gems — Private Music Circles",
    short_name: "Gems",
    description: "Share one song each, listen together, and find new favorites.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#174f3d",
    orientation: "portrait-primary",
  };
}
