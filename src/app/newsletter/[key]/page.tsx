"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PreviewState } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import Link from "next/link";

export default function NewsletterDetailPage() {
  const params = useParams();
  const key = params.key as string;

  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailMode, setEmailMode] = useState<"test" | "general">("test");
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const response = await fetch(`/api/preview-data/${key}`);
        if (response.ok) {
          const data = await response.json();
          setPreview(data);
        }
      } catch (error) {
        console.error("Failed to fetch preview:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [key]);

  const handleSendTest = async () => {
    if (!testEmail.trim()) return;

    setSending(true);
    try {
      const response = await fetch("/api/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewKey: key,
          testEmail,
        }),
      });

      if (response.ok) {
        alert("Test email sent successfully!");
        setShowEmailModal(false);
        setTestEmail("");
      } else {
        alert("Failed to send test email");
      }
    } catch (error) {
      console.error("Failed to send test email:", error);
      alert("Error sending test email");
    } finally {
      setSending(false);
    }
  };

  const handleSendGeneral = async () => {
    setSending(true);
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewKey: key,
        }),
      });

      if (response.ok) {
        alert("Newsletter sent successfully!");
        setShowEmailModal(false);
        // Refresh preview to update status
        const refreshRes = await fetch(`/api/preview-data/${key}`);
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setPreview(data);
        }
      } else {
        alert("Failed to send newsletter");
      }
    } catch (error) {
      console.error("Failed to send newsletter:", error);
      alert("Error sending newsletter");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen bg-navy">
      <Sidebar activeKey={key} />

      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#a0a0b8]">Loading newsletter...</p>
          </div>
        ) : !preview ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[#a0a0b8]">Newsletter not found</p>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-6">
                  <Link
                    href="/"
                    className="text-magenta hover:text-[#ff4db8] text-sm font-medium"
                  >
                    ← Back
                  </Link>
                </div>

                <h1 className="text-3xl font-bold text-[#f1f1f5] mb-2">
                  {preview.monthGenerated || preview.structured.month}
                </h1>
                <p className="text-[#a0a0b8]">{preview.structured.subject}</p>
              </div>

              {/* Status and Metadata */}
              <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl">
                <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                  <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">Status</div>
                  <div className="text-lg font-bold text-[#f1f1f5]">
                    {preview.status === "sent" ? "✓ Sent" : "◦ Draft"}
                  </div>
                </div>

                <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                  <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                    Created
                  </div>
                  <div className="text-lg font-bold text-[#f1f1f5]">
                    {new Date(preview.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {preview.status === "sent" && (
                  <>
                    <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                      <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                        Sent At
                      </div>
                      <div className="text-lg font-bold text-[#f1f1f5]">
                        {preview.sentAt ? new Date(preview.sentAt).toLocaleDateString() : "—"}
                      </div>
                    </div>

                    <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                      <div className="text-xs font-semibold text-[#a0a0b8] uppercase tracking-wider mb-2">
                        Recipients
                      </div>
                      <div className="text-lg font-bold text-[#f1f1f5]">
                        {preview.sentRecipientCount || "—"}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Recipients List */}
              {preview.sentTo && preview.sentTo.length > 0 && (
                <div className="mb-8 max-w-2xl">
                  <h2 className="text-lg font-bold text-[#f1f1f5] mb-4">Sent To</h2>
                  <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-4">
                    <div className="space-y-2">
                      {preview.sentTo.map((email) => (
                        <div key={email} className="text-[#a0a0b8]">
                          • {email}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4 mb-8 max-w-2xl">
                <button
                  onClick={() => {
                    setEmailMode("test");
                    setShowEmailModal(true);
                  }}
                  className="px-6 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
                >
                  Send Test Mail
                </button>

                <button
                  onClick={() => {
                    setEmailMode("general");
                    setShowEmailModal(true);
                  }}
                  className="px-6 py-2 bg-magenta text-white font-medium rounded-lg hover:bg-[#ff4db8] transition-colors"
                >
                  Send General Mail
                </button>

                <Link
                  href={`/review/${key}`}
                  className="px-6 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
                >
                  Edit & Preview
                </Link>
              </div>
            </div>

            {/* Right: Newsletter Preview */}
            <div className="w-1/2 border-l border-[#2a2a42] overflow-y-auto p-8 bg-[#0a0a14]">
              <h2 className="text-lg font-bold text-[#f1f1f5] mb-4">Preview (Click to edit)</h2>
              <div className="bg-white rounded-lg overflow-hidden shadow-lg p-6 prose prose-sm max-w-none h-[calc(100vh-140px)] overflow-y-auto"
                style={{
                  userSelect: "text",
                  WebkitUserSelect: "text",
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a2e] border border-[#2a2a42] rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-bold text-[#f1f1f5] mb-4">
              {emailMode === "test" ? "Send Test Email" : "Send Newsletter"}
            </h3>

            {emailMode === "test" && (
              <>
                <p className="text-[#a0a0b8] text-sm mb-4">
                  Send a test email to verify the newsletter looks correct.
                </p>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-[#2a2a42] border border-[#3a3a52] rounded-lg text-[#f1f1f5] placeholder-[#606078] focus:outline-none focus:border-magenta mb-4"
                />
              </>
            )}

            {emailMode === "general" && (
              <p className="text-[#a0a0b8] text-sm mb-4">
                Send this newsletter to all subscribers. This will mark the draft as sent.
              </p>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setShowEmailModal(false)}
                className="flex-1 px-4 py-2 bg-[#2a2a42] text-[#f1f1f5] font-medium rounded-lg hover:bg-[#3a3a52] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={emailMode === "test" ? handleSendTest : handleSendGeneral}
                disabled={sending || (emailMode === "test" && !testEmail.trim())}
                className="flex-1 px-4 py-2 bg-magenta text-white font-medium rounded-lg hover:bg-[#ff4db8] disabled:opacity-50 transition-colors"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
