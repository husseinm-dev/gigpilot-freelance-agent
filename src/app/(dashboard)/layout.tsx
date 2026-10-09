import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/proposals", label: "Proposals" },
  { href: "/approvals", label: "Approvals" },
  { href: "/submissions", label: "Submissions" },
  { href: "/responses", label: "Responses" },
  { href: "/analytics", label: "Analytics" },
  { href: "/automation", label: "Automation" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        <div className="px-5 py-5 border-b">
          <Link href="/dashboard" className="font-bold text-lg tracking-tight">
            GigPilot
          </Link>
          <p className="text-xs text-muted-foreground">Client acquisition autopilot</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground truncate mb-2">{session.email}</p>
          <LogoutButton />
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8 max-w-7xl">{children}</main>
    </div>
  );
}
