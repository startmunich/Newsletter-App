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
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs">
          ✓
        </span>
      );
    case "running":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-magenta/60">
          <span className="h-3 w-3 rounded-full bg-magenta animate-pulse" />
        </span>
      );
    case "error":
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 border border-red-500/50 text-red-400 text-xs">
          ✕
        </span>
      );
    default:
      return (
        <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#2a2a42]">
          <span className="h-2 w-2 rounded-full bg-[#2a2a42]" />
        </span>
      );
  }
}

export function GenerationProgress({ steps, status }: Props) {
  return (
    <div className="bg-[#111124] rounded-2xl border border-[#2a2a42] p-6">
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.name} className="flex items-start gap-3">
            <StepIcon stepStatus={step.status} />
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  step.status === "running"
                    ? "text-[#f1f1f5]"
                    : step.status === "done"
                      ? "text-[#a0a0b8]"
                      : step.status === "error"
                        ? "text-red-400"
                        : "text-[#3a3a57]"
                }`}
              >
                {step.name}
              </p>
              {step.message && (
                <p className="text-xs text-[#5c5c7a] mt-0.5">{step.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {status === "running" && (
        <div className="mt-6 pt-4 border-t border-[#1f1f36]">
          <div className="h-1 bg-[#1a1a2e] rounded-full overflow-hidden">
            <div className="h-full bg-magenta rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}
    </div>
  );
}
