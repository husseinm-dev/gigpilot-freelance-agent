"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveBusinessProfile } from "@/lib/actions";

interface ProfileFormData {
  businessName: string;
  website: string;
  contactEmail: string;
  biography: string;
  yearsOfExperience: number;
  hourlyRateUsd?: number;
  minimumProjectPriceUsd: number;
  services: string;
  preferredIndustries: string;
  excludedIndustries: string;
  proposalSignature: string;
}

const DEFAULTS: ProfileFormData = {
  businessName: "Your Business",
  website: "https://example.com",
  contactEmail: "",
  biography: "",
  yearsOfExperience: 8,
  minimumProjectPriceUsd: 300,
  services: "",
  preferredIndustries: "",
  excludedIndustries: "",
  proposalSignature: "",
};

export function BusinessProfileForm({
  initial,
  skills,
  portfolio,
}: {
  initial?: ProfileFormData;
  skills: string[];
  portfolio: { title: string; url?: string }[];
}) {
  const [form, setForm] = useState<ProfileFormData>(initial ?? DEFAULTS);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function set<K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Business name</Label>
              <Input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Years of experience</Label>
              <Input
                type="number"
                value={form.yearsOfExperience}
                onChange={(e) => set("yearsOfExperience", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hourly rate ($)</Label>
              <Input
                type="number"
                value={form.hourlyRateUsd ?? ""}
                onChange={(e) => set("hourlyRateUsd", e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Minimum project price ($)</Label>
              <Input
                type="number"
                value={form.minimumProjectPriceUsd}
                onChange={(e) => set("minimumProjectPriceUsd", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Professional biography</Label>
            <Textarea rows={4} value={form.biography} onChange={(e) => set("biography", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Positioning</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Services (comma-separated)</Label>
            <Input value={form.services} onChange={(e) => set("services", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Preferred industries</Label>
              <Input value={form.preferredIndustries} onChange={(e) => set("preferredIndustries", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Excluded industries</Label>
              <Input value={form.excludedIndustries} onChange={(e) => set("excludedIndustries", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Proposal signature</Label>
            <Textarea rows={2} value={form.proposalSignature} onChange={(e) => set("proposalSignature", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Skills & portfolio</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>Skills:</strong> {skills.length ? skills.join(", ") : "Seeded defaults in use (run npm run db:seed)"}</p>
          <p>
            <strong>Portfolio ({portfolio.length}):</strong>{" "}
            {portfolio.length
              ? portfolio.map((p) => p.title).join(", ")
              : "None yet — proposals will not claim any past projects until you add verified ones here (via DB or future UI)."}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await saveBusinessProfile(form);
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : "Save profile"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
      </div>
    </div>
  );
}
