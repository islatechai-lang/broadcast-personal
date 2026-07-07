"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Send, 
  Mail, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Copy, 
  Download, 
  RefreshCw, 
  Eye, 
  Check, 
  Moon, 
  Sun,
  Layers,
  Sparkles,
  Info,
  FileText,
  History
} from "lucide-react";

// Email regex for client-side evaluation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DRAFT_KEY = "bulk_email_sender_draft";
const TEST_EMAILS = ["princederder44@gmail.com", "hcker474@gmail.com"];

interface RecipientAnalysis {
  raw: string[];
  valid: string[];
  invalid: string[];
  duplicates: string[];
  alreadySent: string[];
}

interface Campaign {
  id: string;
  timestamp: string;
  from: string;
  replyTo?: string;
  subject: string;
  message: string;
  results: SendResult[];
  summary: {
    total: number;
    successCount: number;
    failedCount: number;
  };
}

interface SendResult {
  email: string;
  success: boolean;
  error?: string;
  id?: string;
}

interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

// Helper to format frontend preview HTML (converting URLs to buttons and escaping HTML to prevent XSS)
const formatPreviewHtml = (text: string) => {
  if (!text) return "";
  
  // Escape HTML tags to prevent XSS in mock view
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Regex to find links (http/https)
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // Replace links with styled buttons
  const formatted = escaped.replace(urlRegex, (url) => {
    const cleanUrl = url.replace(/[.,;:!?)]+$/, "");
    let label = "Visit Link";
    if (cleanUrl.includes("whop.com")) {
      label = "Join GG33 on Whop";
    }
    return `<div style="margin: 16px 0; text-align: center;">
      <a href="${cleanUrl}" target="_blank" style="display: inline-block; background-color: #F65312; color: #ffffff; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; box-shadow: 0 4px 8px rgba(246, 83, 18, 0.25);">
        ${label}
      </a>
    </div>`;
  });

  return formatted.replace(/\n/g, '<br />');
};

export default function Home() {
  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Form states
  const [from, setFrom] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Campaign History & Real-time Tracking States
  const HISTORY_KEY = "bulk_email_sender_history";
  const [campaignHistory, setCampaignHistory] = useState<Campaign[]>([]);
  const [sendingProgress, setSendingProgress] = useState<Record<string, "idle" | "sending" | "success" | "failed">>({});
  const [sendingErrors, setSendingErrors] = useState<Record<string, string>>({});

  // UI state
  const [activeTab, setActiveTab] = useState<"preview" | "logs" | "history">("preview");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<{
    successCount: number;
    failedCount: number;
    results: SendResult[];
  } | null>(null);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // 1. Initialize theme and load draft / history from localStorage
  useEffect(() => {
    // Theme sync
    const savedTheme = localStorage.getItem("theme");
    const preferDark = savedTheme ? savedTheme === "dark" : true;
    setIsDark(preferDark);
    if (preferDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Load draft
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const data = JSON.parse(savedDraft);
        if (data.from) setFrom(data.from);
        if (data.replyTo) setReplyTo(data.replyTo);
        if (data.recipientsText) setRecipientsText(data.recipientsText);
        if (data.subject) setSubject(data.subject);
        if (data.message) setMessage(data.message);
        addToast("Draft restored from your last session", "info");
      } catch (err) {
        console.error("Failed to restore draft:", err);
      }
    }

    // Load history
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try {
        setCampaignHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error("Failed to restore history:", err);
      }
    }
  }, []);

  // 2. Save draft automatically to localStorage on input changes
  useEffect(() => {
    const draft = { from, replyTo, recipientsText, subject, message };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [from, replyTo, recipientsText, subject, message]);

  // Toast helper
  const addToast = (message: string, type: ToastMessage["type"] = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Toggle Theme
  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    localStorage.setItem("theme", newDark ? "dark" : "light");
    if (newDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Memoized set of all successfully sent emails in history
  const successfullySentEmails = useMemo(() => {
    const set = new Set<string>();
    campaignHistory.forEach((c) => {
      c.results.forEach((r) => {
        if (r.success) {
          const emailLower = r.email.toLowerCase();
          if (!TEST_EMAILS.includes(emailLower)) {
            set.add(emailLower);
          }
        }
      });
    });
    return set;
  }, [campaignHistory]);

  // Calculate successfully sent emails today
  const successfullySentToday = useMemo(() => {
    let count = 0;
    const todayStr = new Date().toDateString();
    campaignHistory.forEach((c) => {
      try {
        const campDate = new Date(c.timestamp);
        if (campDate.toDateString() === todayStr) {
          count += c.results.filter((r) => r.success).length;
        }
      } catch {
        // ignore date parse errors
      }
    });
    return count;
  }, [campaignHistory]);

  // Exclude previously sent helper
  const excludeAlreadySent = () => {
    const rawLines = recipientsText.split("\n");
    const remainingLines = rawLines.filter((line) => {
      const trimmed = line.trim().toLowerCase();
      if (!EMAIL_REGEX.test(trimmed)) return true; // keep invalid lines so user can fix
      return !successfullySentEmails.has(trimmed);
    });
    setRecipientsText(remainingLines.join("\n"));
    addToast(`Filtered out successfully sent emails!`, "success");
  };

  // History action helpers
  const loadCampaignDraft = (camp: Campaign) => {
    setFrom(camp.from);
    setReplyTo(camp.replyTo || "");
    setSubject(camp.subject);
    setMessage(camp.message);
    addToast("Campaign template loaded back into form!", "success");
  };

  const deleteCampaign = (id: string) => {
    if (confirm("Are you sure you want to delete this campaign from history?")) {
      setCampaignHistory((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
      addToast("Campaign deleted", "info");
    }
  };

  const clearAllHistory = () => {
    if (confirm("Are you sure you want to clear the entire campaign history? This cannot be undone.")) {
      setCampaignHistory([]);
      localStorage.removeItem(HISTORY_KEY);
      addToast("History cleared", "info");
    }
  };

  // 3. Live analysis of recipients
  const analysis = useMemo<RecipientAnalysis>(() => {
    if (!recipientsText.trim()) {
      return { raw: [], valid: [], invalid: [], duplicates: [], alreadySent: [] };
    }

    const rawLines = recipientsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const validEmails: string[] = [];
    const invalidEmails: string[] = [];
    const duplicateEmails: string[] = [];
    const alreadySentEmails: string[] = [];
    const seen = new Set<string>();

    rawLines.forEach((email) => {
      const lowerEmail = email.toLowerCase();
      if (!EMAIL_REGEX.test(email)) {
        invalidEmails.push(email);
      } else if (seen.has(lowerEmail)) {
        duplicateEmails.push(email);
      } else {
        seen.add(lowerEmail);
        validEmails.push(email);
        if (successfullySentEmails.has(lowerEmail)) {
          alreadySentEmails.push(email);
        }
      }
    });

    return {
      raw: rawLines,
      valid: validEmails,
      invalid: invalidEmails,
      duplicates: duplicateEmails,
      alreadySent: alreadySentEmails,
    };
  }, [recipientsText, successfullySentEmails]);

  // Copy helper
  const copyToClipboard = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text);
    addToast(successMessage, "success");
  };

  // Copy all valid recipients
  const copyAllRecipients = () => {
    if (analysis.valid.length === 0) {
      addToast("No valid recipients to copy", "warning");
      return;
    }
    copyToClipboard(analysis.valid.join("\n"), "All valid recipients copied to clipboard!");
  };

  // Export failed emails as CSV
  const exportFailedAsCSV = () => {
    if (!sendResults || sendResults.failedCount === 0) {
      addToast("No failed emails to export", "warning");
      return;
    }

    const failed = sendResults.results.filter((r) => !r.success);
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Email,Error\n" 
      + failed.map((r) => `"${r.email}","${r.error || 'Unknown'}"`).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `failed_emails_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Failed emails exported successfully", "success");
  };

  // Clear Form
  const clearForm = () => {
    if (confirm("Are you sure you want to clear all form fields? This will reset your current draft.")) {
      setFrom("");
      setReplyTo("");
      setRecipientsText("");
      setSubject("");
      setMessage("");
      setSendResults(null);
      localStorage.removeItem(DRAFT_KEY);
      addToast("Form cleared and draft reset", "info");
    }
  };

  // Handle Send action
  const handleSendTrigger = (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      addToast("Subject cannot be empty", "error");
      return;
    }
    if (!message.trim()) {
      addToast("Message content cannot be empty", "error");
      return;
    }
    if (analysis.valid.length === 0) {
      addToast("No valid recipients to send to", "error");
      return;
    }
    if (analysis.valid.length > 100) {
      addToast("Limit exceeded: You can only send to a maximum of 100 recipients.", "error");
      return;
    }

    // Validate From Email format if provided
    if (from.trim() && !/^(?:[^<]+<)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/.test(from.trim())) {
      addToast('Invalid "From Email" — use a full address like noreply@yourdomain.com or Name <noreply@yourdomain.com>', "error");
      return;
    }

    setShowConfirmModal(true);
  };

  const executeSend = async () => {
    setShowConfirmModal(false);
    setIsSending(true);
    setActiveTab("logs");
    setSendResults(null);
    
    // Reset individual email trackers
    const initialProgress: Record<string, "idle" | "sending" | "success" | "failed"> = {};
    analysis.valid.forEach(email => {
      initialProgress[email] = "idle";
    });
    setSendingProgress(initialProgress);
    setSendingErrors({});

    addToast("Starting real-time broadcast...", "info");

    const total = analysis.valid.length;
    const tempResults: SendResult[] = [];
    
    // Concurrency limit of 2 parallel requests
    const concurrencyLimit = 2;
    
    for (let i = 0; i < total; i += concurrencyLimit) {
      const chunk = analysis.valid.slice(i, i + concurrencyLimit);
      
      // Update state for chunk to 'sending'
      setSendingProgress(prev => {
        const next = { ...prev };
        chunk.forEach(email => {
          next[email] = "sending";
        });
        return next;
      });
      
      const chunkPromises = chunk.map(async (email) => {
        try {
          const response = await fetch("/api/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              from,
              replyTo,
              subject,
              message,
              recipient: email,
            }),
          });
          
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error || "Delivery failed");
          }
          
          setSendingProgress(prev => ({ ...prev, [email]: "success" }));
          return { email, success: true, id: data.id };
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          setSendingProgress(prev => ({ ...prev, [email]: "failed" }));
          setSendingErrors(prev => ({ ...prev, [email]: errorMsg }));
          return { email, success: false, error: errorMsg };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      tempResults.push(...chunkResults);
      
      // Update intermediate send results
      setSendResults({
        successCount: tempResults.filter(r => r.success).length,
        failedCount: tempResults.filter(r => !r.success).length,
        results: [...tempResults],
      });
      
      // Wait 1 second (1000ms) between batches to stay comfortably within rate limits
      if (i + concurrencyLimit < total) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    
    // Save to history on completion
    const finalSuccessCount = tempResults.filter(r => r.success).length;
    const finalFailedCount = tempResults.filter(r => !r.success).length;
    
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      from: from || "Default (Onboarding)",
      replyTo: replyTo || undefined,
      subject: subject,
      message: message,
      results: tempResults,
      summary: {
        total,
        successCount: finalSuccessCount,
        failedCount: finalFailedCount,
      }
    };
    
    setCampaignHistory(prev => {
      const updated = [newCampaign, ...prev];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    
    setIsSending(false);
    if (finalFailedCount === 0) {
      addToast(`Successfully broadcasted emails to all ${finalSuccessCount} recipients!`, "success");
    } else {
      addToast(`Broadcast complete: ${finalSuccessCount} sent, ${finalFailedCount} failed.`, "warning");
    }
  };

  return (
    <div className="relative min-h-screen transition-colors duration-300 pb-16">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none animate-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none animate-glow" />

      {/* Floating Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl flex items-start gap-3 border animate-toast ${
              toast.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : toast.type === "error"
                ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                : toast.type === "warning"
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-slate-800/90 border-slate-700/60 text-slate-300"
            }`}
          >
            <div className="mt-0.5">
              {toast.type === "success" && <CheckCircle2 size={18} />}
              {toast.type === "error" && <AlertCircle size={18} />}
              {toast.type === "warning" && <AlertCircle size={18} />}
              {toast.type === "info" && <Info size={18} />}
            </div>
            <div className="flex-1 text-sm font-medium leading-tight">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
          <div className="max-w-md w-full rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-slate-100 transition-all animate-glow">
            <div className="flex items-center gap-3 text-indigo-500 dark:text-indigo-400 mb-4">
              <Layers size={24} />
              <h3 className="text-xl font-bold font-display">Confirm Email Broadcast</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              You are about to launch a bulk email campaign. Review details below:
            </p>
            <div className="space-y-3 bg-slate-100 dark:bg-slate-950/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">From Address:</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{from || "Default (Onboarding)"}</span>
              </div>
              {replyTo && (
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Reply-To:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{replyTo}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Subject:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{subject}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                <span className="text-slate-500 dark:text-slate-400 font-semibold">Valid Recipients:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-display text-base">
                  {analysis.valid.length} emails
                </span>
              </div>
            </div>
            <div className="flex gap-3 justify-end text-sm">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSend}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center gap-2"
              >
                <Send size={16} />
                Yes, Send Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="glass-panel sticky top-0 z-40 border-b border-slate-200/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-600/35">
            <Mail className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
              Broadcast.io
            </h1>
            <p className="text-xs text-slate-400">Bulk Email Delivery Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Daily Limit Badge */}
          <div 
            className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 px-3 py-1 rounded-full text-xs text-indigo-400 font-medium"
            title="Resend free tier limit is 100 emails/day. This count is based on emails sent today from your local history."
          >
            Daily Limit: {Math.max(0, 100 - successfullySentToday)} / 100 left
          </div>

          {/* Status Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-full text-xs text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Resend Connected
          </div>

          {/* Theme Button */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-850 bg-slate-900/60 text-slate-400 hover:text-white hover:border-slate-700 transition-all shadow-md"
            title="Toggle theme"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Form Fields (8 Cols on large screens) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            <form onSubmit={handleSendTrigger} className="space-y-6">
              
              {/* Sender Details Panel */}
              <div className="glass-panel rounded-2xl p-6 border-slate-200/10 shadow-lg relative overflow-hidden">
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4 mb-4">
                  <Layers size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-bold font-display text-slate-100">1. Sender Information</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      From Email
                    </label>
                    <input
                      type="text"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      placeholder="noreply@send.gg33core.space"
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:ring-2"
                    />
                    <span className="block text-[10px] text-slate-500 mt-1">
                      Must be a full email address (e.g. noreply@yourdomain.com). Leave empty for Resend&apos;s default.
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Reply-To Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={replyTo}
                      onChange={(e) => setReplyTo(e.target.value)}
                      placeholder="reply@yourdomain.com"
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:ring-2"
                    />
                  </div>
                </div>
              </div>

              {/* Recipients Selection Panel */}
              <div className="glass-panel rounded-2xl p-6 border-slate-200/10 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 mb-4 gap-2">
                  <div className="flex items-center gap-2.5">
                    <Users size={18} className="text-indigo-400" />
                    <h2 className="text-lg font-bold font-display text-slate-100">2. Recipients</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyAllRecipients}
                      disabled={analysis.valid.length === 0}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1 transition-colors"
                    >
                      <Copy size={12} />
                      Copy Valid
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    value={recipientsText}
                    onChange={(e) => setRecipientsText(e.target.value)}
                    placeholder="Enter email addresses here, one per line (max 100).&#10;example1@domain.com&#10;example2@domain.com"
                    className="glass-input w-full p-4 rounded-xl text-sm font-mono transition-all focus:ring-2 placeholder:text-slate-650 leading-relaxed"
                  />
                  {analysis.raw.length > 100 && (
                    <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg flex items-center gap-2">
                      <AlertCircle size={14} />
                      Warning: 100 recipient limit exceeded (Current: {analysis.raw.length})
                    </div>
                  )}

                  {analysis.alreadySent.length > 0 && (
                    <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>
                          {analysis.alreadySent.length} recipient{analysis.alreadySent.length > 1 ? 's' : ''} have already been successfully emailed in past campaigns.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={excludeAlreadySent}
                        className="self-end sm:self-auto px-2 py-1 text-[10px] font-bold rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1"
                      >
                        <Trash2 size={10} />
                        Filter Out Already Sent
                      </button>
                    </div>
                  )}
                </div>

                {/* Email Analytics Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-center">
                  <div className="bg-slate-900/40 border border-slate-800/60 p-2.5 rounded-xl">
                    <div className="text-xs text-slate-400 font-medium">Entered</div>
                    <div className="text-lg font-bold font-display text-slate-200 mt-0.5">
                      {analysis.raw.length}
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-2.5 rounded-xl">
                    <div className="text-xs text-emerald-400/80 font-medium">Valid (Deduplicated)</div>
                    <div className="text-lg font-bold font-display text-emerald-400 mt-0.5">
                      {analysis.valid.length}
                    </div>
                  </div>
                  <div className="bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-xl">
                    <div className="text-xs text-rose-400/80 font-medium">Invalid Formats</div>
                    <div className="text-lg font-bold font-display text-rose-400 mt-0.5">
                      {analysis.invalid.length}
                    </div>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl">
                    <div className="text-xs text-amber-400/80 font-medium">Duplicates</div>
                    <div className="text-lg font-bold font-display text-amber-400 mt-0.5">
                      {analysis.duplicates.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Content Section */}
              <div className="glass-panel rounded-2xl p-6 border-slate-200/10 shadow-lg">
                <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4 mb-4">
                  <FileText size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-bold font-display text-slate-100">3. Email Message</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Product Launch Announcement"
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:ring-2"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Message Content (Text/HTML supported)
                      </label>
                      <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-900 border border-slate-850 rounded">
                        {message.length} chars
                      </span>
                    </div>
                    <textarea
                      rows={10}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Hi there,&#10;&#10;Write your email copy here. We support spacing, multiple lines, and layout structures."
                      className="glass-input w-full p-4 rounded-xl text-sm transition-all focus:ring-2 leading-relaxed"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-850">
                <button
                  type="button"
                  onClick={clearForm}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-950/20 hover:bg-rose-500/5 transition-all flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  Clear Form & Draft
                </button>

                <button
                  type="submit"
                  disabled={isSending || analysis.valid.length === 0}
                  className="px-6 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Broadcast to {analysis.valid.length} Recipient{analysis.valid.length !== 1 && "s"}
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* Right Column: Live Preview & Results (4 or 5 Cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-8">
            
            {/* Tabs for Live Preview & Send Log */}
            <div className="glass-panel rounded-2xl border-slate-200/10 overflow-hidden shadow-lg">
              <div className="flex border-b border-slate-800 bg-slate-900/40 p-1.5 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("preview")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "preview"
                      ? "bg-slate-800 text-slate-100 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Eye size={13} />
                  Live Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("logs")}
                  disabled={!sendResults && !isSending}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 ${
                    activeTab === "logs"
                      ? "bg-slate-800 text-slate-100 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 size={13} />
                  Delivery Log
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === "history"
                      ? "bg-slate-800 text-slate-100 shadow"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <History size={13} />
                  History
                </button>
              </div>

              {activeTab === "preview" && (
                /* Interactive Email Preview Window */
                <div className="p-4 bg-slate-900/10">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold mb-3">
                    <Sparkles size={12} className="text-yellow-400" />
                    Recipient&apos;s Inbox Mockup
                  </div>
                  
                  <div className="border border-slate-850 rounded-xl bg-white text-slate-850 shadow-inner overflow-hidden max-w-full">
                    {/* Mock Headers */}
                    <div className="bg-slate-50 border-b border-slate-100 p-3.5 space-y-2 text-xs text-slate-600">
                      <div className="flex">
                        <span className="w-14 font-semibold text-slate-400">From:</span>
                        <span className="font-mono text-slate-700 truncate">
                          {from || "onboarding@resend.dev"}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="w-14 font-semibold text-slate-400">To:</span>
                        <span className="text-indigo-600 italic font-mono">
                          {analysis.valid.length > 0 ? analysis.valid[0] : "recipient@example.com"}
                          {analysis.valid.length > 1 && ` (+${analysis.valid.length - 1} more)`}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="w-14 font-semibold text-slate-400">Subject:</span>
                        <span className="font-bold text-slate-800 truncate">
                          {subject || "(No Subject)"}
                        </span>
                      </div>
                    </div>

                    {/* Mock Body */}
                    <div className="p-4 min-h-[160px] text-sm text-slate-700 font-sans leading-relaxed overflow-y-auto max-h-[300px]">
                      {message ? (
                        <div dangerouslySetInnerHTML={{ __html: message.trim().startsWith('<') ? message : formatPreviewHtml(message) }} />
                      ) : (
                        <span className="text-slate-400 italic">
                          No body content yet. As you type in the message text box, it will show up here.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "logs" && (
                /* Delivery Logs and Statistics */
                <div className="p-4 space-y-4">
                  {(sendResults || isSending) && (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <div className="text-xs text-slate-400">
                            {isSending ? "Sending Broadcast..." : "Delivery Status"}
                          </div>
                          <div className="text-base font-bold font-display text-slate-200 mt-0.5">
                            {sendResults ? `${sendResults.successCount} Successful, ${sendResults.failedCount} Failed` : "Initializing..."}
                          </div>
                        </div>
                        {sendResults && sendResults.failedCount > 0 && !isSending && (
                          <button
                            onClick={exportFailedAsCSV}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-amber-400 flex items-center gap-1 transition-all"
                          >
                            <Download size={11} />
                            Export CSV
                          </button>
                        )}
                      </div>

                      {/* Live Progress Bar */}
                      {isSending && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                            <span>Progress</span>
                            <span>{sendResults?.results?.length || 0} / {analysis.valid.length}</span>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800/40">
                            <div
                              className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 h-full transition-all duration-300 animate-progress"
                              style={{ width: `${((sendResults?.results?.length || 0) / analysis.valid.length) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Recipient breakdown logs */}
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {analysis.valid.map((email) => {
                          const status = sendingProgress[email] || "idle";
                          const error = sendingErrors[email];
                          
                          return (
                            <div
                              key={email}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                                status === "success"
                                  ? "bg-emerald-500/5 border-emerald-500/10 text-slate-300"
                                  : status === "failed"
                                  ? "bg-rose-500/5 border-rose-500/10 text-rose-300"
                                  : status === "sending"
                                  ? "bg-indigo-500/5 border-indigo-500/15 text-indigo-300"
                                  : "bg-slate-900/30 border-slate-850 text-slate-500"
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-mono font-medium truncate">{email}</div>
                                {status === "failed" && error && (
                                  <div className="text-[10px] text-rose-400/80 mt-0.5">
                                    {error}
                                  </div>
                                )}
                              </div>
                              <div>
                                {status === "success" && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    <Check size={9} /> Sent
                                  </span>
                                )}
                                {status === "failed" && (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-0.5">
                                    Failed
                                  </span>
                                )}
                                {status === "sending" && (
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                    <RefreshCw size={9} className="animate-spin" /> Sending
                                  </span>
                                )}
                                {status === "idle" && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                    Queued
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                /* Campaign History Window */
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-xs text-slate-400">Broadcast History</div>
                      <div className="text-base font-bold font-display text-slate-200 mt-0.5">
                        {campaignHistory.length} Campaigns Saved
                      </div>
                    </div>
                    {campaignHistory.length > 0 && (
                      <button
                        onClick={clearAllHistory}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center gap-1 transition-all"
                      >
                        <Trash2 size={11} />
                        Clear All
                      </button>
                    )}
                  </div>

                  {campaignHistory.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 italic">
                      No broadcast campaigns in history yet.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                      {campaignHistory.map((camp) => (
                        <div key={camp.id} className="border border-slate-850 bg-slate-900/40 rounded-xl p-3.5 space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-slate-200 truncate" title={camp.subject}>
                                {camp.subject}
                              </h4>
                              <div className="text-[10px] text-slate-500 mt-0.5">{camp.timestamp}</div>
                            </div>
                            <button
                              onClick={() => deleteCampaign(camp.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Delete campaign"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-slate-950/40 p-1.5 rounded-lg">
                              <div className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">Total</div>
                              <div className="font-semibold text-slate-200 mt-0.5">{camp.summary.total}</div>
                            </div>
                            <div className="bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/10">
                              <div className="text-[9px] text-emerald-400/80 uppercase tracking-wider font-semibold">Sent</div>
                              <div className="font-semibold text-emerald-400 mt-0.5">{camp.summary.successCount}</div>
                            </div>
                            <div className="bg-rose-500/5 p-1.5 rounded-lg border border-rose-500/10">
                              <div className="text-[9px] text-rose-400/80 uppercase tracking-wider font-semibold">Failed</div>
                              <div className="font-semibold text-rose-400 mt-0.5">{camp.summary.failedCount}</div>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 text-xs pt-1">
                            <button
                              onClick={() => loadCampaignDraft(camp)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 flex items-center gap-1 transition-all"
                            >
                              Reuse Template
                            </button>
                            <button
                              onClick={() => {
                                setSendResults({
                                  successCount: camp.summary.successCount,
                                  failedCount: camp.summary.failedCount,
                                  results: camp.results,
                                });
                                // Synthesize sendingProgress for visual render in logs tab
                                const prog: Record<string, "idle" | "sending" | "success" | "failed"> = {};
                                const errs: Record<string, string> = {};
                                camp.results.forEach((r) => {
                                  prog[r.email] = r.success ? "success" : "failed";
                                  if (!r.success && r.error) {
                                    errs[r.email] = r.error;
                                  }
                                });
                                setSendingProgress(prog);
                                setSendingErrors(errs);
                                setActiveTab("logs");
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 flex items-center gap-1 transition-all"
                            >
                              View logs
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* General Results Summary Card */}
            {sendResults && (
              <div className={`glass-panel rounded-2xl p-5 border shadow-lg ${
                sendResults.failedCount === 0
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-slate-800 bg-slate-900/30"
              }`}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={15} className={sendResults.failedCount === 0 ? "text-emerald-400" : "text-amber-400"} />
                  Delivery Statistics Summary
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Valid Recipients:</span>
                    <span className="font-semibold text-slate-200">
                      {sendResults.successCount + sendResults.failedCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-400/80">Success Rate:</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {Math.round(
                        (sendResults.successCount / (sendResults.successCount + sendResults.failedCount)) * 100
                      )}%
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800/80 pt-2 mt-2">
                    <span className="text-slate-400">Succeeded:</span>
                    <span className="font-semibold text-emerald-400">{sendResults.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Failed:</span>
                    <span className="font-semibold text-rose-400">{sendResults.failedCount}</span>
                  </div>
                </div>

                {sendResults.failedCount > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex justify-end">
                    <button
                      onClick={() => {
                        const failed = sendResults.results.filter((r) => !r.success).map((r) => r.email).join("\n");
                        copyToClipboard(failed, "Failed email addresses copied to clipboard!");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-400 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy size={12} />
                      Copy Failed Emails
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Tips & Help Info Panel */}
            <div className="glass-panel rounded-2xl p-5 border-slate-200/10 shadow-lg bg-slate-900/20 text-xs leading-relaxed text-slate-400">
              <h4 className="font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Info size={14} className="text-indigo-400" />
                Operational Instructions
              </h4>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Make sure to use domains verified in your Resend account if using custom <span className="font-mono text-slate-300">From</span> emails.</li>
                <li>Recipients are validated and duplicates are filtered out automatically before transmission.</li>
                <li>Emails are dispatched in throttled concurrent chunks on the backend to safeguard API limits.</li>
                <li>You can save a message draft offline — drafts autosave locally on typing changes.</li>
              </ul>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
