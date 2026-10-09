import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { DEFAULT_SKILLS, type ProfileContext } from "@/lib/profile-context";

export { DEFAULT_SKILLS, type ProfileContext };

export async function getProfileContext(): Promise<ProfileContext> {
  const profile = await db.query.businessProfiles.findFirst();
  const skillRows = profile
    ? await db.query.skills.findMany({ where: eq(schema.skills.profileId, profile.id) })
    : [];
  const portfolioRows = profile
    ? await db.query.portfolioProjects.findMany({
        where: eq(schema.portfolioProjects.profileId, profile.id),
      })
    : [];

  return {
    businessName: profile?.businessName ?? "Your Business",
    website: profile?.website ?? "https://example.com",
    contactEmail: profile?.contactEmail ?? undefined,
    biography:
      profile?.biography ??
      "Web developer with ~8 years of professional experience building sites and applications with React, Next.js, Vue, Node.js, PHP/WordPress, Python, and .NET. Extensive experience developing healthcare and pharmaceutical digital experiences.",
    yearsOfExperience: profile?.yearsOfExperience ?? 8,
    hourlyRateUsd: profile?.hourlyRateUsd ? Number(profile.hourlyRateUsd) : undefined,
    minimumProjectPriceUsd: profile ? Number(profile.minimumProjectPriceUsd) : 300,
    services: profile?.services ?? ["Web development", "Web applications", "WordPress development"],
    preferredIndustries: profile?.preferredIndustries ?? ["healthcare", "pharmaceutical"],
    excludedIndustries: profile?.excludedIndustries ?? [],
    proposalSignature: profile?.proposalSignature ?? undefined,
    skills: skillRows.length
      ? skillRows.map((s) => ({ name: s.name, aliases: s.aliases }))
      : DEFAULT_SKILLS,
    portfolio: portfolioRows
      .filter((p) => p.verified)
      .map((p) => ({
        title: p.title,
        description: p.description ?? undefined,
        url: p.url ?? undefined,
        technologies: p.technologies,
      })),
  };
}
