import { useEffect, useState } from "react";
import type { SessionWithActivities, CategoryInfo } from "../types/electron";

interface RecategorizeModalProps {
  session: SessionWithActivities;
  onClose: () => void;
  onSave: () => void;
}

// Sites where domain alone isn't enough — need domain+keyword rules
const MULTI_CONTENT_DOMAINS = [
  "youtube.com", "youtu.be", "medium.com", "dev.to",
  "reddit.com", "substack.com", "hashnode.dev",
  "claude.ai", "chat.openai.com", "chatgpt.com",
  "gemini.google.com", "perplexity.ai",
];

// Common title suffixes to strip
const TITLE_SUFFIXES = [
  / - YouTube$/i,
  / - Medium$/i,
  / \| Dev\.to$/i,
  / - DEV Community$/i,
  / : Reddit$/i,
  / - Google Chrome$/i,
  / - Mozilla Firefox$/i,
  / - Safari$/i,
  / - Brave$/i,
  / - Arc$/i,
  / - Microsoft Edge$/i,
];

function isMultiContentDomain(domain: string): boolean {
  return MULTI_CONTENT_DOMAINS.some(
    (d) => domain === d || domain.endsWith("." + d),
  );
}

function cleanTitle(title: string): string {
  let cleaned = title;
  for (const suffix of TITLE_SUFFIXES) {
    cleaned = cleaned.replace(suffix, "");
  }
  return cleaned.trim();
}

function extractKeyword(title: string): string | null {
  const cleaned = cleanTitle(title);
  if (!cleaned) return null;

  // Take the first few significant words (skip very short words)
  const words = cleaned
    .split(/[\s\-_|:]+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);

  if (words.length === 0) return null;
  return words.join(" ").toLowerCase();
}

interface SuggestedRule {
  type: string;
  pattern: string;
  description: string;
}

function suggestRule(session: SessionWithActivities): SuggestedRule {
  const activity = session.activities[0];
  const domain = activity?.domain || null;
  const title = activity?.window_title || "";
  const appName = session.app_name;

  // 1. Multi-content domain → domain_keyword
  if (domain && isMultiContentDomain(domain)) {
    const keyword = extractKeyword(title);
    if (keyword) {
      return {
        type: "domain_keyword",
        pattern: `${domain}|${keyword}`,
        description: `When on ${domain} with "${keyword}" in title`,
      };
    }
  }

  // 2. Has domain → domain rule
  if (domain) {
    return {
      type: "domain",
      pattern: domain,
      description: `All pages on ${domain}`,
    };
  }

  // 3. Desktop app → app rule
  return {
    type: "app",
    pattern: appName,
    description: `All activity in ${appName}`,
  };
}

export function RecategorizeModal({ session, onClose, onSave }: RecategorizeModalProps) {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const rule = suggestRule(session);

  useEffect(() => {
    window.electronAPI.getCategories().then((cats) => {
      setCategories(cats.filter((c) => c.name !== "uncategorized"));
    });
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    if (!selectedCategoryId) return;
    setIsSaving(true);

    try {
      // 1. Add the rule so future activities get categorized correctly
      await window.electronAPI.addCategoryRule(selectedCategoryId, rule.type, rule.pattern);

      // 2. Recategorize ALL existing sessions/activities matching this rule pattern
      await window.electronAPI.recategorizeByRule(rule.type, rule.pattern, selectedCategoryId);

      // 3. Reload categorizer so new rule takes effect immediately
      await window.electronAPI.reloadCategories();

      onSave();
    } catch (err) {
      console.error("Failed to recategorize:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const activity = session.activities[0];
  const title = activity?.window_title || session.app_name;
  const domain = activity?.domain || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#111113] border border-white/[0.06] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white mb-2">Recategorize</h3>
          <div className="space-y-1">
            <p className="text-xs text-grey-300 truncate">{title}</p>
            {domain && (
              <p className="text-xs text-info truncate">{domain}</p>
            )}
            <p className="text-[10px] text-grey-500">{session.app_name}</p>
          </div>
        </div>

        {/* Category Grid */}
        <div className="px-5 py-4">
          <p className="text-[11px] uppercase tracking-wider text-grey-500 mb-3">
            Pick the correct category
          </p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-xs ${
                    isSelected
                      ? "bg-white/10 ring-1 ring-white/20"
                      : "bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className={isSelected ? "text-white" : "text-grey-400"}>
                    {cat.name.replace(/_/g, " ")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rule Preview */}
        {selectedCategoryId && (
          <div className="px-5 pb-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-grey-500 mb-1">
                Rule that will be created
              </p>
              <p className="text-xs text-grey-300">{rule.description}</p>
              <p className="text-[10px] text-grey-600 mt-1 font-mono">
                {rule.type}: {rule.pattern}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-grey-400 hover:text-white rounded-md hover:bg-white/5 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedCategoryId || isSaving}
            className="px-4 py-1.5 text-xs rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-primary text-white hover:bg-primary-dark"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
