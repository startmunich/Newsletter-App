"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  previewKey: string;
  testEmailSent: boolean;
  approvalVersion: number;
  status: string;
  hideTestEmail?: boolean;
}

export function ActionBar({ previewKey, testEmailSent, approvalVersion, status, hideTestEmail = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [revising, setRevising] = useState(false);
  const [approving, setApproving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const isSent = status === "sent";

  const handleSendTest = async () => {
    if (!email.trim()) return;
    setSendingTest(true);
    setMessage(null);

    try {
      const res = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: previewKey, email: email.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: "success", text: `Test email sent to ${data.email}` });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send test email",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleRevise = async () => {
    if (!feedback.trim()) return;
    setRevising(true);
    setMessage(null);

    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: previewKey, feedback: feedback.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: "success", text: "Revision complete! Redirecting..." });
      setTimeout(() => router.push(`/review/${data.newKey}`), 1000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to revise",
      });
    } finally {
      setRevising(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: previewKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({
        type: "success",
        text: `Newsletter sent! Campaign ID: ${data.brevoCampaignId}`,
      });
      setShowConfirm(false);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to approve",
      });
    } finally {
      setApproving(false);
    }
  };

  const inputClass = "flex-1 rounded-lg border border-[#2a2a42] bg-[#0a0a14] px-3 py-2 text-sm text-[#f1f1f5] placeholder-[#3a3a57] focus:outline-none focus:ring-1 focus:ring-magenta/40 focus:border-magenta/60 transition-colors disabled:opacity-40";

  return (
    <div className="border-t border-[#2a2a42] bg-[#111124] px-6 py-4">
      {message && (
        <div
          className={`mb-3 px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              : "bg-red-500/10 text-red-400 border border-red-500/30"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {/* Test email */}
        {!hideTestEmail && (
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-1.5">
              Send test email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                disabled={isSent}
                className={inputClass}
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !email.trim() || isSent}
                className="px-4 py-2 bg-[#1a1a2e] border border-[#2a2a42] text-[#f1f1f5] text-sm rounded-lg hover:border-[#3a3a57] disabled:opacity-40 whitespace-nowrap transition-colors"
              >
                {sendingTest ? "Sending..." : "Send test"}
              </button>
            </div>
          </div>
        )}

        {/* Revision */}
        {!hideTestEmail && (
          <div className="flex-1 min-w-[250px]">
            <label className="block text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-1.5">
              AI revision
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g., Make the intro shorter..."
                disabled={isSent}
                className={inputClass}
              />
              <button
                onClick={handleRevise}
                disabled={revising || !feedback.trim() || isSent}
                className="px-4 py-2 bg-[#1a1a2e] border border-[#2a2a42] text-[#f1f1f5] text-sm rounded-lg hover:border-[#3a3a57] disabled:opacity-40 whitespace-nowrap transition-colors"
              >
                {revising ? "Revising..." : "Revise"}
              </button>
            </div>
          </div>
        )}

        {/* Approve */}
        <div className="flex items-end gap-2">
          {showConfirm ? (
            <>
              <span className="text-sm text-[#a0a0b8] font-medium">Confirm send?</span>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 bg-red-600/80 border border-red-500/50 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                {approving ? "Sending..." : "Yes, send now"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-[#1a1a2e] border border-[#2a2a42] text-[#a0a0b8] text-sm rounded-lg hover:border-[#3a3a57] transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!testEmailSent || isSent}
              className="px-6 py-2 bg-magenta text-white text-sm font-semibold rounded-lg hover:bg-magenta-light disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
              title={
                !testEmailSent
                  ? "Send a test email first"
                  : isSent
                    ? "Already sent"
                    : ""
              }
            >
              {isSent ? "✓ Sent" : "Approve & Send"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
