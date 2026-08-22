"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOrg } from "../actions";

export function DeleteOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = () => {
    if (confirm !== orgName) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteOrg(orgId);
      if (!res.ok) {
        setError(res.error);
      } else {
        router.push("/orgs");
      }
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
      >
        Delete org
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div>
          <h3 className="font-semibold text-lg">Delete &ldquo;{orgName}&rdquo;?</h3>
          <p className="text-sm text-gray-500 mt-1">
            This will permanently delete the org, all its meetings, members, and speak requests. This cannot be undone.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="delete-org-confirm" className="text-sm text-gray-600">
            Type <span className="font-mono font-medium text-gray-900">{orgName}</span> to confirm
          </label>
          <input
            id="delete-org-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            placeholder={orgName}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            disabled={confirm !== orgName || pending}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {pending ? "Deleting…" : "Delete permanently"}
          </button>
          <button
            onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
            disabled={pending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
