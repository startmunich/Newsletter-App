"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  previewKey: string;
  testEmailSent: boolean;
  approvalVersion: number;
  status: string;
}

export function ActionBar({ previewKey, testEmailSent, approvalVersion, status }: Props) {
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

  return (
    <div className="border-t border-gray-200 bg-white px-6 py-4">
      {message && (
        <div
          className={`mb-3 px-4 py-2 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        {/* Test email */}
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Send test email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={isSent}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-magenta disabled:opacity-50"
            />
            <button
              onClick={handleSendTest}
              disabled={sendingTest || !email.trim() || isSent}
              className="px-4 py-2 bg-navy text-white text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {sendingTest ? "Sending..." : "Send test"}
            </button>
          </div>
        </div>

        {/* Revision */}
        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            AI revision
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., Make the intro shorter..."
              disabled={isSent}
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-magenta disabled:opacity-50"
            />
            <button
              onClick={handleRevise}
              disabled={revising || !feedback.trim() || isSent}
              className="px-4 py-2 bg-navy text-white text-sm rounded hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            >
              {revising ? "Revising..." : "Revise"}
            </button>
          </div>
        </div>

        {/* Approve */}
        <div className="flex items-end gap-2">
          {showConfirm ? (
            <>
              <span className="text-sm text-red-600 font-medium">Confirm send?</span>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50"
              >
                {approving ? "Sending..." : "Yes, send now"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!testEmailSent || isSent}
              className="px-6 py-2 bg-magenta text-white text-sm font-semibold rounded hover:bg-magenta-light disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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

      <div className="mt-2 text-xs text-gray-400">
        Version {approvalVersion} {testEmailSent && "• Test email sent"}
      </div>
    </div>
  );
}
