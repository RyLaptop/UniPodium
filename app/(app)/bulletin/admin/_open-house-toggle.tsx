"use client";

import { useState, useTransition } from "react";
import { Wrench } from "lucide-react";
import { toggleOpenHouse, toggleTestMode } from "@/app/(app)/open-house/actions";

type Props = {
  university: string;
  isActive: boolean;
  isTestMode: boolean;
};

export function OpenHouseToggle({ university, isActive, isTestMode }: Props) {
  const [active, setActive] = useState(isActive);
  const [testMode, setTestMode] = useState(isTestMode);
  const [pending, startTransition] = useTransition();

  const handleToggleActive = () => {
    startTransition(async () => {
      const res = await toggleOpenHouse(university, !active);
      if (res.ok) setActive((v) => !v);
      else alert(res.error);
    });
  };

  const handleToggleTest = () => {
    startTransition(async () => {
      const res = await toggleTestMode(university, !testMode);
      if (res.ok) setTestMode((v) => !v);
      else alert(res.error);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
        <div>
          <p className="font-medium text-sm flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${active ? "bg-green-500" : "bg-gray-300"}`} />
            {active ? "Open House is LIVE" : "Open House is OFF"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {active ? "All students can see and browse booths." : "Page is hidden from students."}
          </p>
        </div>
        <button
          onClick={handleToggleActive}
          disabled={pending}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            active
              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              : "bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {active ? "Deactivate" : "Activate"}
        </button>
      </div>

      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
        <div>
          <p className="font-medium text-sm flex items-center gap-1.5">
            {testMode && <Wrench className="w-3.5 h-3.5" strokeWidth={2.5} />}
            {testMode ? "Test Mode ON" : "Test Mode OFF"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {testMode
              ? "Admins can preview open house with 20 fake orgs, even while inactive."
              : "Enable to preview with fake orgs before going live."}
          </p>
        </div>
        <button
          onClick={handleToggleTest}
          disabled={pending}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            testMode
              ? "bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {testMode ? "Disable" : "Enable test mode"}
        </button>
      </div>
    </div>
  );
}
