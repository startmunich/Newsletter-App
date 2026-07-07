"use client";

import { GenerationStep } from "@/lib/types";

interface Props {
  steps: GenerationStep[];
  status: string;
}

function StepIcon({ stepStatus }: { stepStatus: string }) {
  switch (stepStatus) {
    case "done":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-white text-xs">
          ✓
        </span>
      );
    case "running":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-magenta">
          <span className="h-3 w-3 rounded-full bg-magenta animate-pulse" />
        </span>
      );
    case "error":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs">
          ✕
        </span>
      );
    default:
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-300">
          <span className="h-2 w-2 rounded-full bg-gray-300" />
        </span>
      );
  }
}

export function GenerationProgress({ steps, status }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.name} className="flex items-start gap-3">
            <StepIcon stepStatus={step.status} />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.status === "running"
                    ? "text-navy"
                    : step.status === "done"
                      ? "text-gray-600"
                      : step.status === "error"
                        ? "text-red-600"
                        : "text-gray-400"
                }`}
              >
                {step.name}
              </p>
              {step.message && (
                <p className="text-xs text-gray-500 mt-0.5">{step.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {status === "running" && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-magenta rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}
    </div>
  );
}
