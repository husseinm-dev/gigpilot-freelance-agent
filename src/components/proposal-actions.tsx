"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveProposal,
  rejectProposal,
  updateProposalText,
  markManuallySubmitted,
} from "@/lib/actions";

export function ProposalActions({
  proposal,
  jobUrl,
  connectsRequired,
}: {
  proposal: { id: string; status: string; coverLetter: string; bidAmountUsd?: number };
  jobUrl?: string;
  connectsRequired?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(proposal.coverLetter);
  const [bid, setBid] = useState(proposal.bidAmountUsd?.toString() ?? "");
  const [confirmUrl, setConfirmUrl] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [pending, startTransition] = useTransition();

  const wordCount = text.trim().split(/\s+/).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Cover letter ({wordCount} words)</CardTitle>
        {!editing && !["submitted"].includes(proposal.status) ? (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <>
            <Textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center gap-2">
              <Input className="w-36" type="number" placeholder="Bid $" value={bid} onChange={(e) => setBid(e.target.value)} />
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await updateProposalText(proposal.id, text, bid ? Number(bid) : undefined);
                    setEditing(false);
                  })
                }
              >
                Save changes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setText(proposal.coverLetter); }}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{text}</p>
        )}

        {connectsRequired ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Submitting on Upwork costs ~{connectsRequired} Connects (~${(connectsRequired * 0.15).toFixed(2)}).
            GigPilot never buys Connects automatically.
          </p>
        ) : null}

        {proposal.status === "awaiting_approval" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending}
              onClick={() => startTransition(() => approveProposal(proposal.id))}
            >
              ✓ Approve
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setShowReject(!showReject)}>
              ✕ Reject
            </Button>
          </div>
        ) : null}

        {showReject ? (
          <div className="flex gap-2">
            <Input placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => startTransition(() => rejectProposal(proposal.id, rejectReason))}
            >
              Confirm reject
            </Button>
          </div>
        ) : null}

        {proposal.status === "ready_for_manual_submission" ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium">Submit manually, then record it:</p>
            {jobUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={jobUrl} target="_blank" rel="noopener noreferrer">Open listing & submit ↗</a>
              </Button>
            ) : null}
            <div className="flex gap-2">
              <Input
                placeholder="Confirmation URL (optional)"
                value={confirmUrl}
                onChange={(e) => setConfirmUrl(e.target.value)}
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={() => startTransition(() => markManuallySubmitted(proposal.id, confirmUrl || undefined))}
              >
                Mark as submitted
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
