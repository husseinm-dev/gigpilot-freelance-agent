/** Profile types and defaults with no database dependency (safe for tests/workers). */

export interface ProfileContext {
  businessName: string;
  website: string;
  contactEmail?: string;
  biography?: string;
  yearsOfExperience: number;
  hourlyRateUsd?: number;
  minimumProjectPriceUsd: number;
  services: string[];
  preferredIndustries: string[];
  excludedIndustries: string[];
  proposalSignature?: string;
  skills: { name: string; aliases: string[] }[];
  portfolio: { title: string; description?: string; url?: string; technologies: string[] }[];
}

export const DEFAULT_SKILLS: { name: string; aliases: string[] }[] = [
  { name: "React", aliases: ["react.js", "reactjs"] },
  { name: "Next.js", aliases: ["nextjs", "next js"] },
  { name: "TypeScript", aliases: ["ts"] },
  { name: "JavaScript", aliases: ["js", "es6", "ecmascript"] },
  { name: "Vue", aliases: ["vue.js", "vuejs", "vue3"] },
  { name: "Nuxt", aliases: ["nuxt.js", "nuxtjs"] },
  { name: "Node.js", aliases: ["node", "nodejs", "express"] },
  { name: "PHP", aliases: ["laravel"] },
  { name: "WordPress", aliases: ["wp", "woocommerce", "elementor"] },
  { name: "Python", aliases: ["django", "flask", "fastapi"] },
  { name: ".NET", aliases: ["dotnet", "c#", "csharp", "asp.net"] },
  { name: "HTML", aliases: ["html5"] },
  { name: "CSS", aliases: ["css3"] },
  { name: "Sass", aliases: ["scss"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss"] },
  { name: "REST APIs", aliases: ["rest", "api integration", "api development"] },
];
