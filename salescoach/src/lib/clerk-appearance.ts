/** Appearance shared by every Clerk surface (app-wide provider and the header-only one). */
export const clerkAppearance = {
  layout: {
    logoImageUrl: "/brand/erota-mark.png",
    logoPlacement: "inside" as const,
    termsPageUrl: "/terms",
    privacyPageUrl: "/privacy",
  },
  variables: { colorPrimary: "#0091ae" },
};
