import { useState } from "react";
import { Image as ImageIcon, Smile, Calendar } from "lucide-react";
import { useTenant } from "../TenantContext";

const DEFAULT_PLACEHOLDERS = {
  breedz: "What's on your mind?",
  helptruth: "Hva skjer?",
};

/**
 * @param {{
 *   onPost: (content: string) => void | Promise<void>,
 *   placeholder?: string,
 *   maxLength?: number,
 * }} props
 */
export default function ComposeBox({ onPost, placeholder, maxLength = 500 }) {
  const tenant = useTenant();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resolvedPlaceholder =
    placeholder ?? DEFAULT_PLACEHOLDERS[tenant.id] ?? DEFAULT_PLACEHOLDERS.breedz;
  const remaining = maxLength - content.length;
  const canSubmit = content.trim().length > 0 && content.length <= maxLength && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onPost(content);
      setContent("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="breedz-glass p-5 mb-6">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={resolvedPlaceholder}
        className="w-full bg-transparent text-text placeholder-text-faint resize-none outline-none text-lg min-h-[80px]"
        maxLength={maxLength}
      />
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
        <div className="flex gap-3 text-accent">
          <button type="button" className="hover:bg-white/5 p-2 rounded-full transition-colors" aria-label="Attach image">
            <ImageIcon size={18} />
          </button>
          <button type="button" className="hover:bg-white/5 p-2 rounded-full transition-colors" aria-label="Emoji">
            <Smile size={18} />
          </button>
          <button type="button" className="hover:bg-white/5 p-2 rounded-full transition-colors" aria-label="Schedule">
            <Calendar size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${remaining < 50 ? "text-danger" : "text-text-muted"}`}>
            {remaining}
          </span>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-full font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
            style={{
              background: "linear-gradient(to right, var(--accent), var(--accent-glow))",
              boxShadow: canSubmit ? "0 0 20px var(--border-glow)" : undefined,
            }}
          >
            {submitting ? "…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
