"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addClientResponse } from "@/lib/actions";

const TYPES = [
  ["question", "Question"],
  ["interview_invitation", "Interview invitation"],
  ["project_discussion", "Project discussion"],
  ["offer", "Offer"],
  ["rejection", "Rejection"],
  ["other", "Other"],
] as const;

export function AddResponseForm({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("question");
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Record client response
      </Button>
    );
  }

  return (
    <div className="border rounded-md p-3 space-y-3">
      <select
        className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        {TYPES.map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <Textarea rows={3} placeholder="What did the client say?" value={content} onChange={(e) => setContent(e.target.value)} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await addClientResponse({ jobId, type, content });
              setOpen(false);
              setContent("");
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
