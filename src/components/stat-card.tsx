import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {sub ? <p className="text-xs text-muted-foreground mt-1">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}
