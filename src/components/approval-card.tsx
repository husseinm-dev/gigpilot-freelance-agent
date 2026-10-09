"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { approveProposal, rejectProposal, markManuallySubmitted } from "@/lib/actions";

export function ApprovalCard({
  proposal,
  job,
  aiScore,
}: {
  proposal: {
    id: string;
    status: string;
    coverLetter: string;
    bidAmountUsd?: number;
    estimatedDays?: number;
  };
  job?: {
    id: string;
    title: string;
    sourceKey: string;
    url?: string;
    budgetMin?: number;
    budgetMax?: number;
    connectsRequired?: number;
  };
  aiScore?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmUrl, setConfirmUrl] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={job ? `/jobs/${job.id}` : "#"} className="font-medium hover:underline">
              {job?.title ?? "Unknown job"}
            </Link>
            <p className="text-xs text-muted-foreground mt-0.5">
              {job?.sourceKey}
              {job?.budgetMin || job?.budgetMax
                ? ` · client budget $${job.budgetMin ?? "?"}–$${job.budgetMax ?? "?"}`
                : ""}
              {aiScore != null ? ` · AI score ${aiScore}/100` : ""}
              {proposal.bidAmountUsd != null ? ` · your bid $${proposal.bidAmountUsd}` : ""}
              {proposal.estimatedDays ? ` · ${proposal.estimatedDays} days` : ""}
            </p>
            {job?.connectsRequired ? (
              <p className="text-xs text-amber-700 mt-1">
                ⚡ Costs ~{job.connectsRequired} Connects (~${(job.connectsRequired * 0.15).toFixed(2)}) to submit
              </p>
            ) : null}
          </div>
          <StatusBadge status={proposal.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`text-sm whitespace-pre-wrap ${expanded ? "" : "line-clamp-3"}`}>{proposal.coverLetter}</p>
        <button className="text-xs text-muted-foreground underline" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "Show full proposal"}
        </button>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {proposal.status === "awaiting_approval" ? (
            <>
              <Button size="sm" disabled={pending} onClick={() => startTransition(() => approveProposal(proposal.id))}>
                ✓ Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => startTransition(() => rejectProposal(proposal.id, "Rejected from approvals queue"))}
              >
                ✕ Reject
              </Button>
            </>
          ) : null}
          {proposal.status === "ready_for_manual_submission" ? (
            <>
              {job?.url ? (
                <Button asChild size="sm" variant="outline">
                  <a href={job.url} target="_blank" rel="noopener noreferrer">Open & submit ↗</a>
                </Button>
              ) : null}
              <Input
                className="h-8 w-56"
                placeholder="Confirmation URL (optional)"
                value={confirmUrl}
                onChange={(e) => setConfirmUrl(e.target.value)}
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => markManuallySubmitted(proposal.id, confirmUrl || undefined))}
              >
                Mark submitted
              </Button>
            </>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/proposals/${proposal.id}`}>Edit / details</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
