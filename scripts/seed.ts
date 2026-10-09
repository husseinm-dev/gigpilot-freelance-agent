import "dotenv/config";
import { db, schema, sql } from "@/db/client";
import { allAdapters } from "@/worker/sources/registry";
import { DEFAULT_SKILLS } from "@/lib/profile";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "@/lib/settings-schema";

/**
 * Idempotent seed: job sources from the adapter registry, default settings,
 * a default business profile, and default skills.
 * Run: npm run db:seed
 */
async function main() {
  // Sources
  for (const adapter of allAdapters()) {
    const caps = adapter.capabilities();
    await db
      .insert(schema.jobSources)
      .values({
        key: caps.key,
        name: caps.name,
        enabled: ["remoteok", "remotive", "weworkremotely"].includes(caps.key),
        integrationStatus: caps.integrationStatus,
        discoverySupported: caps.discoverySupported,
        authRequired: caps.authRequired,
        officialApi: caps.officialApi,
        submissionSupported: caps.submissionSupported,
        humanConfirmationRequired: caps.humanConfirmationRequired,
        tested: false,
        applicationCostModel: caps.applicationCostModel,
      })
      .onConflictDoUpdate({
        target: schema.jobSources.key,
        set: {
          name: caps.name,
          integrationStatus: caps.integrationStatus,
          discoverySupported: caps.discoverySupported,
          authRequired: caps.authRequired,
          officialApi: caps.officialApi,
          submissionSupported: caps.submissionSupported,
          humanConfirmationRequired: caps.humanConfirmationRequired,
          applicationCostModel: caps.applicationCostModel,
          updatedAt: new Date(),
        },
      });
  }
  console.log("✅ Job sources seeded");

  // Settings
  await db
    .insert(schema.settings)
    .values({ key: SETTINGS_KEY, value: DEFAULT_SETTINGS, description: "Automation settings" })
    .onConflictDoNothing();
  console.log("✅ Default settings seeded");

  // Business profile
  const existingProfile = await db.query.businessProfiles.findFirst();
  let profileId = existingProfile?.id;
  if (!existingProfile) {
    const [profile] = await db
      .insert(schema.businessProfiles)
      .values({
        businessName: "Your Business",
        website: "https://example.com",
        services: ["Web development", "Web applications", "WordPress development", "API integrations"],
        biography:
          "Web developer with ~8 years of professional experience building sites and applications with React, Next.js, Vue, Node.js, PHP/WordPress, Python, and .NET. Extensive experience developing healthcare and pharmaceutical digital experiences.",
        yearsOfExperience: 8,
        minimumProjectPriceUsd: "300",
        preferredIndustries: ["healthcare", "pharmaceutical", "saas", "small business"],
      })
      .returning({ id: schema.businessProfiles.id });
    profileId = profile.id;
    console.log("✅ Business profile created");
  }

  // Skills
  if (profileId) {
    for (const skill of DEFAULT_SKILLS) {
      await db
        .insert(schema.skills)
        .values({ profileId, name: skill.name, aliases: skill.aliases })
        .onConflictDoNothing();
    }
    console.log("✅ Skills seeded");
  }

  await sql.end({ timeout: 5 });
  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
