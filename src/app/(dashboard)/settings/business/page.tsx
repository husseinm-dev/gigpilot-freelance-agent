import { db } from "@/db/client";
import { BusinessProfileForm } from "@/components/business-profile-form";

export const dynamic = "force-dynamic";

export default async function BusinessSettingsPage() {
  const profile = await db.query.businessProfiles.findFirst();
  const skills = profile
    ? await db.query.skills.findMany()
    : [];
  const portfolio = profile ? await db.query.portfolioProjects.findMany() : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business profile</h1>
        <p className="text-sm text-muted-foreground">
          This verified profile is the ONLY source of claims in generated proposals. Never add anything here
          that isn&apos;t true. Platform identity rules: where a marketplace requires your personal verified
          identity (e.g. Upwork individual accounts), proposals are written as you, the developer, referencing
          your business where branding is permitted.
        </p>
      </div>
      <BusinessProfileForm
        initial={
          profile
            ? {
                businessName: profile.businessName,
                website: profile.website,
                contactEmail: profile.contactEmail ?? "",
                biography: profile.biography ?? "",
                yearsOfExperience: profile.yearsOfExperience,
                hourlyRateUsd: profile.hourlyRateUsd ? Number(profile.hourlyRateUsd) : undefined,
                minimumProjectPriceUsd: Number(profile.minimumProjectPriceUsd),
                services: profile.services.join(", "),
                preferredIndustries: profile.preferredIndustries.join(", "),
                excludedIndustries: profile.excludedIndustries.join(", "),
                proposalSignature: profile.proposalSignature ?? "",
              }
            : undefined
        }
        skills={skills.map((s) => s.name)}
        portfolio={portfolio.map((p) => ({ title: p.title, url: p.url ?? undefined }))}
      />
    </div>
  );
}
