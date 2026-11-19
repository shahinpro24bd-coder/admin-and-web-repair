import { createFileRoute } from "@tanstack/react-router";

/** Home page — rendered from the database copy of the original markup. */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dr. Lama Ghassan | Cosmetic Dentist in Muscat, Oman" },
      { name: "description", content: "Cosmetic and restorative dentist in Muscat: porcelain veneers, Hollywood smile, Lumineers, bonding and whitening at NHC — Dr. Nael Al Hazeem Medical Center." },
      { property: "og:title", content: "Dr. Lama Ghassan | Cosmetic Dentist in Muscat, Oman" },
      { property: "og:description", content: "Cosmetic and restorative dentist in Muscat: porcelain veneers, Hollywood smile, Lumineers, bonding and whitening at NHC — Dr. Nael Al Hazeem Medical Center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { renderSitePage } = await import("@/lib/site-content/render.server");
        return renderSitePage(request, "index");
      },
    },
  },
});
