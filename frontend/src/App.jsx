// App.jsx
// HelpTruth v2 — Komplett Twitter-kopi med alle features

import { useState, useEffect, useRef, useCallback } from "react";
import { Home, Compass, Bell, Mail, Bookmark, User as UserIcon, Settings } from "lucide-react";
import { useTenant } from "./TenantContext";

// ─── API-LAG ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

function getToken() { return localStorage.getItem("helptruth_token"); }
function saveToken(t) { localStorage.setItem("helptruth_token", t); }
function removeToken() { localStorage.removeItem("helptruth_token"); }

async function api(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Noe gikk galt");
  return data;
}

async function uploadFile(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${BASE_URL}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Opplasting feilet");
  return data.url;
}

async function uploadAvatar(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append("image", file);
  const res = await fetch(`${BASE_URL}/upload/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Opplasting feilet");
  return data.url;
}

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
let socket = null;
function connectSocket(token) {
  if (socket) return socket;
  // Dynamic import — socket.io-client must be installed
  const io = require("socket.io-client");
  const wsUrl = BASE_URL.replace("/api", "");
  socket = io(wsUrl, { auth: { token } });
  return socket;
}
function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}

// ─── KONSTANTER ───────────────────────────────────────────────────────────────
const NAV_BY_TENANT = {
  breedz: [
    { Icon: Home,     label: "Home",          key: "home" },
    { Icon: Compass,  label: "Explore",       key: "explore" },
    { Icon: Bell,     label: "Notifications", key: "notifications" },
    { Icon: Mail,     label: "Messages",      key: "messages" },
    { Icon: Bookmark, label: "Bookmarks",     key: "bookmarks" },
    { Icon: UserIcon, label: "Profile",       key: "profile" },
  ],
  helptruth: [
    { Icon: Home,     label: "Hjem",      key: "home" },
    { Icon: Compass,  label: "Utforsk",   key: "explore" },
    { Icon: Bell,     label: "Varsler",   key: "notifications" },
    { Icon: Mail,     label: "Meldinger", key: "messages" },
    { Icon: Bookmark, label: "Bokmerker", key: "bookmarks" },
    { Icon: UserIcon, label: "Profil",    key: "profile" },
  ],
};
const MOBILE_NAV = [
  { Icon: Home,     key: "home" },
  { Icon: Compass,  key: "explore" },
  { Icon: Bell,     key: "notifications" },
  { Icon: Mail,     key: "messages" },
  { Icon: UserIcon, key: "profile" },
];
const TRENDING_TITLE = { breedz: "Trending on Breedz", helptruth: "Trending i Norge" };
const FOLLOW_TITLE   = { breedz: "Who to follow",      helptruth: "Hvem å følge" };
const POST_CTA       = { breedz: "Post",                helptruth: "Skriv innlegg" };
const POST_CTA_SHORT = { breedz: "+",                   helptruth: "+" };
const ADMIN_LABEL    = { breedz: "Admin",               helptruth: "Admin" };
const LOGOUT_LABEL   = { breedz: "Log out",             helptruth: "Logg ut" };

const TRENDING = [
  { tag: "#StartCoin",    posts: "12.4K innlegg", category: "Fintech" },
  { tag: "#Crowdlending", posts: "8.9K innlegg",  category: "Finans" },
  { tag: "#NorskFintech", posts: "6.2K innlegg",  category: "Teknologi" },
  { tag: "#Tokenisering", posts: "4.1K innlegg",  category: "Blockchain" },
  { tag: "#ECSP",         posts: "2.8K innlegg",  category: "Regulering" },
];

const NOTIF_ICONS = { like: "❤️", repost: "🔁", reply: "💬", follow: "👤", quote: "🔗" };
const NOTIF_TEXT = {
  like: "likte innlegget ditt",
  repost: "repostet innlegget ditt",
  reply: "svarte på innlegget ditt",
  follow: "begynte å følge deg",
  quote: "siterte innlegget ditt",
};

function formatCount(n) {
  if (!n && n !== 0) return 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "K";
  return n;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "nå";
  if (m < 60)  return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}t`;
  return `${Math.floor(m / 1440)}d`;
}

// ─── GJENBRUKBARE KOMPONENTER ────────────────────────────────────────────────

function ProfileImage({ src, initials, color, size = 40, onClick }) {
  if (src) {
    return (
      <img src={src} alt="" onClick={onClick} style={{
        width: size, height: size, borderRadius: "50%", objectFit: "cover",
        flexShrink: 0, cursor: onClick ? "pointer" : "default",
        border: `2px solid ${color ? color + "44" : "var(--border-glow)"}`,
      }} />
    );
  }
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, ${color}, ${color}bb)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontWeight: 700, fontSize: size * 0.35,
      flexShrink: 0, cursor: onClick ? "pointer" : "default",
      border: `2px solid ${color}44`, boxShadow: `0 0 8px ${color}33`,
      userSelect: "none",
    }}>
      {initials}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--accent)" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: "3px solid var(--border)", borderTopColor: "var(--accent)",
        animation: "spin 0.8s linear infinite", margin: "0 auto",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function Toast({ message, type = "success" }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "var(--danger)" : "var(--accent)",
      color: "#fff", padding: "12px 24px", borderRadius: 24,
      fontSize: 14, fontFamily: "var(--font-sans)",
      boxShadow: "0 4px 20px #000a", zIndex: 9999,
      animation: "fadeIn 0.2s ease",
    }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform: translate(-50%,10px) } to { opacity:1; transform: translate(-50%,0) } }`}</style>
      {message}
    </div>
  );
}

function ActionBtn({ icon, count, active, activeColor, label, onClick, loading }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!loading) onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        background: hovered ? `${activeColor}18` : "transparent",
        border: "none", cursor: loading ? "wait" : "pointer",
        color: active ? activeColor : hovered ? activeColor : "var(--text-muted)",
        display: "flex", alignItems: "center", gap: 5,
        fontSize: 13, fontFamily: "var(--font-sans)",
        padding: "4px 8px", borderRadius: 20, transition: "all 0.15s",
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 16, transition: "transform 0.1s", transform: active ? "scale(1.15)" : "scale(1)" }}>
        {icon}
      </span>
      {count !== null && count !== undefined && (
        <span style={{ fontWeight: active ? 700 : 400 }}>{formatCount(count)}</span>
      )}
    </button>
  );
}

// ─── POLL KOMPONENT ──────────────────────────────────────────────────────────

function PollDisplay({ post, onVote }) {
  if (!post.poll_id) return null;

  const options = typeof post.poll_options === "string" ? JSON.parse(post.poll_options) : post.poll_options;
  const votes = typeof post.poll_votes === "string" ? JSON.parse(post.poll_votes) : (post.poll_votes || {});
  const userVote = post.poll_user_vote;
  const hasVoted = userVote !== null && userVote !== undefined;
  const ended = new Date(post.poll_ends_at) < new Date();
  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
  const showResults = hasVoted || ended;

  const remaining = new Date(post.poll_ends_at) - new Date();
  const hoursLeft = Math.max(0, Math.floor(remaining / 3600000));
  const minsLeft = Math.max(0, Math.floor((remaining % 3600000) / 60000));

  return (
    <div style={{ marginTop: 12 }}>
      {options.map((opt, i) => {
        const count = votes[i] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isWinner = showResults && count === Math.max(...Object.values(votes));
        const isMyVote = userVote === i;

        return (
          <button key={i} disabled={showResults}
            onClick={e => { e.stopPropagation(); onVote(post.id, i); }}
            style={{
              width: "100%", position: "relative", overflow: "hidden",
              background: showResults ? "transparent" : "var(--bg-subtle)",
              border: `1px solid ${isMyVote ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 6,
              cursor: showResults ? "default" : "pointer",
              color: "var(--text)", fontSize: 14, fontFamily: "var(--font-sans)",
              textAlign: "left", transition: "all 0.2s",
            }}
          >
            {showResults && (
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${pct}%`, background: isWinner ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.06)",
                transition: "width 0.5s ease",
              }} />
            )}
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
              <span>{opt} {isMyVote && "✓"}</span>
              {showResults && <span style={{ fontWeight: 700 }}>{pct}%</span>}
            </div>
          </button>
        );
      })}
      <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
        {totalVotes} stemmer · {ended ? "Avsluttet" : `${hoursLeft}t ${minsLeft}m igjen`}
      </div>
    </div>
  );
}

// ─── QUOTE EMBED ─────────────────────────────────────────────────────────────

function QuoteEmbed({ post }) {
  if (!post.quote_id) return null;
  return (
    <div style={{
      marginTop: 10, border: "1px solid var(--border)", borderRadius: 12,
      padding: "10px 14px", background: "var(--bg-elevated)", cursor: "pointer",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <ProfileImage src={post.quote_user_profile_image} initials={post.quote_user_avatar}
          color={post.quote_user_avatar_color} size={18} />
        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{post.quote_user_name}</span>
        {post.quote_user_verified && <span style={{ color: "var(--accent)", fontSize: 12 }}>✓</span>}
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>@{post.quote_user_handle}</span>
        <span style={{ color: "var(--border)" }}>·</span>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{timeAgo(post.quote_created_at)}</span>
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 13, lineHeight: 1.5 }}>{post.quote_content}</p>
      {post.quote_image_url && (
        <img src={post.quote_image_url} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 8, maxHeight: 200, objectFit: "cover" }} />
      )}
    </div>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────

function PostCard({ post, onLike, onRepost, onBookmark, onDelete, onReply, onVote, onQuote, onClickPost, onClickUser, isOwn, currentUser }) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyText, setReplyText]       = useState("");
  const [showMenu, setShowMenu]         = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const menuRef = useRef();

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  async function handleAction(action, fn) {
    setLoadingAction(action);
    try { await fn(); } finally { setLoadingAction(null); }
  }

  const p = post;

  return (
    <div style={{
      borderBottom: "1px solid var(--border)", padding: "16px 20px",
      transition: "background 0.15s", cursor: onClickPost ? "pointer" : "default",
    }}
      onClick={() => onClickPost && onClickPost(p.id)}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(53,109,255,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <ProfileImage
          src={p.user_profile_image} initials={p.user_avatar || p.avatar}
          color={p.user_avatar_color || p.avatarColor} size={40}
          onClick={e => { e.stopPropagation(); onClickUser && onClickUser(p.user_handle); }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span
                onClick={e => { e.stopPropagation(); onClickUser && onClickUser(p.user_handle); }}
                style={{ fontWeight: 700, color: "var(--text)", fontSize: 15, fontFamily: "var(--font-serif)", cursor: "pointer" }}
              >
                {p.user_name || p.user}
              </span>
              {(p.user_verified || p.verified) && <span style={{ color: "var(--accent)" }}>✓</span>}
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>@{p.user_handle || p.handle?.replace("@","")}</span>
              <span style={{ color: "var(--border)" }}>·</span>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                {p.created_at ? timeAgo(p.created_at) : p.time}
              </span>
            </div>

            {/* Meny */}
            <div style={{ position: "relative" }} ref={menuRef}>
              <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: "2px 8px", borderRadius: "50%" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(53,109,255,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >···</button>
              {showMenu && (
                <div style={{
                  position: "absolute", right: 0, top: "100%", zIndex: 100,
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 12, minWidth: 180, boxShadow: "0 8px 32px #000a",
                }}>
                  {[
                    { icon: "🔖", label: p.bookmarked ? "Fjern bokmerke" : "Bokmerk", action: () => onBookmark(p.id) },
                    { icon: "🔗", label: "Siter innlegg", action: () => onQuote && onQuote(p) },
                    { icon: "📋", label: "Kopier lenke", action: () => navigator.clipboard?.writeText(window.location.href) },
                    isOwn && { icon: "🗑️", label: "Slett", action: () => onDelete(p.id), danger: true },
                  ].filter(Boolean).map((item, i) => (
                    <button key={i} onClick={e => { e.stopPropagation(); item.action(); setShowMenu(false); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, width: "100%",
                        background: "none", border: "none", padding: "12px 16px",
                        color: item.danger ? "var(--danger)" : "var(--text)",
                        cursor: "pointer", fontSize: 14, fontFamily: "var(--font-sans)",
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(53,109,255,0.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <span>{item.icon}</span>{item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Innhold */}
          <p style={{ color: "var(--text)", fontSize: 15, lineHeight: 1.6, margin: "6px 0 0", wordBreak: "break-word", fontFamily: "var(--font-sans)" }}>
            {p.content.split(/(@\w+|#\w+)/g).map((part, i) =>
              part.startsWith("#")
                ? <span key={i} style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); onClickUser && onClickUser(null, part.slice(1)); }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >{part}</span>
                : part.startsWith("@")
                ? <span key={i} style={{ color: "var(--accent)", cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); onClickUser && onClickUser(part.slice(1)); }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >{part}</span>
                : part
            )}
          </p>

          {/* Bilde */}
          {p.image_url && (
            <img src={p.image_url} alt="" onClick={e => e.stopPropagation()} style={{
              width: "100%", borderRadius: 12, marginTop: 10,
              maxHeight: 400, objectFit: "cover", border: "1px solid var(--border)",
            }} />
          )}

          {/* Sitatinnlegg */}
          <QuoteEmbed post={p} />

          {/* Poll */}
          <PollDisplay post={p} onVote={onVote} />

          {/* Aksjoner */}
          <div style={{ display: "flex", gap: 4, marginTop: 12, marginLeft: -8 }}>
            <ActionBtn icon="💬" count={p.replies_count ?? p.replies} active={false} activeColor="#1d9bf0"
              label="Svar" loading={loadingAction === "reply"}
              onClick={() => setShowReplyBox(!showReplyBox)} />
            <ActionBtn icon="🔁" count={p.reposts_count ?? p.reposts} active={!!p.reposted} activeColor="var(--accent)"
              label="Repost" loading={loadingAction === "repost"}
              onClick={() => handleAction("repost", () => onRepost(p.id))} />
            <ActionBtn icon="❤️" count={p.likes_count ?? p.likes} active={!!p.liked} activeColor="var(--danger)"
              label="Lik" loading={loadingAction === "like"}
              onClick={() => handleAction("like", () => onLike(p.id))} />
            <ActionBtn icon="👁️" count={p.views_count ?? p.views ?? 0} active={false} activeColor="var(--text-muted)"
              label="Visninger" onClick={() => {}} />
            <ActionBtn icon="🔖" count={null} active={!!p.bookmarked} activeColor="var(--accent)"
              label="Bokmerk" loading={loadingAction === "bookmark"}
              onClick={() => handleAction("bookmark", () => onBookmark(p.id))} />
          </div>

          {/* Svar-boks */}
          {showReplyBox && (
            <div style={{ marginTop: 12, padding: 12, background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border)" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", gap: 10 }}>
                <ProfileImage src={currentUser?.profile_image} initials={currentUser?.avatar || "DU"} color={currentUser?.avatar_color || "var(--accent)"} size={32} />
                <div style={{ flex: 1 }}>
                  <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder={`Svar @${p.user_handle || p.handle?.replace("@","")}...`}
                    autoFocus
                    style={{
                      width: "100%", background: "transparent", border: "none", outline: "none",
                      color: "var(--text)", fontFamily: "var(--font-sans)", fontSize: 14,
                      resize: "none", minHeight: 60,
                    }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{280 - replyText.length}</span>
                    <button
                      disabled={!replyText.trim()}
                      onClick={async () => {
                        await onReply(p.id, replyText);
                        setReplyText(""); setShowReplyBox(false);
                      }}
                      style={{
                        background: replyText.trim() ? "linear-gradient(135deg,var(--accent),var(--accent-glow))" : "var(--border)",
                        color: replyText.trim() ? "#fff" : "var(--border)",
                        border: "none", borderRadius: 20, padding: "6px 18px",
                        fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "var(--font-serif)",
                      }}
                    >Svar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN / REGISTER SIDE ────────────────────────────────────────────────────

function AuthPage({ onLogin }) {
  const tenant = useTenant();
  const [mode, setMode]         = useState("login");
  const [form, setForm]         = useState({ name: "", handle: "", email: "", password: "", invite_code: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit() {
    setError("");
    setLoading(true);
    try {
      let result;
      if (mode === "login") {
        result = await api("/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
        saveToken(result.token);
        onLogin(result.user);
      } else {
        result = await api("/auth/register", { method: "POST", body: form });
        setError("");
        setMode("login");
        alert(result.message || "Konto opprettet! Sjekk e-posten din.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inp = (field, placeholder, type = "text") => (
    <input type={type} placeholder={placeholder} value={form[field]}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      onKeyDown={e => e.key === "Enter" && handleSubmit()}
      style={{
        width: "100%", background: "var(--bg-elevated)", border: "1px solid var(--border)",
        borderRadius: 10, padding: "12px 16px", color: "var(--text)",
        fontSize: 15, fontFamily: "var(--font-sans)", outline: "none",
        marginBottom: 12, transition: "border-color 0.2s",
      }}
      onFocus={e => e.target.style.borderColor = "var(--accent)"}
      onBlur={e => e.target.style.borderColor = "var(--border)"}
    />
  );

  const isBreedz = tenant.id === "breedz";
  const headline = isBreedz ? {
    lead: "Where ",
    gradient: "investors talk.",
  } : {
    lead: "Si det som er ",
    gradient: "sant.",
  };
  const subtext = isBreedz
    ? "Twitter-style platform for European investors, founders, and builders."
    : "Norsk mikroblogg — rett på sak, uten filter.";
  const joinCta = isBreedz ? "Join the feed" : "Registrer deg";
  const signInCta = isBreedz ? "Sign in" : "Logg inn";
  const emailLabel = isBreedz ? "Email address" : "E-postadresse";
  const passwordLabel = isBreedz ? "Password" : "Passord";
  const nameLabel = isBreedz ? "Full name" : "Fullt navn";
  const handleLabel = isBreedz ? "Username (no @)" : "Brukernavn (uten @)";
  const inviteLabel = isBreedz ? "Invitation code" : "Invitasjonskode";
  const switchToRegister = isBreedz ? "No account yet? " : "Har du ikke konto? ";
  const switchToLogin = isBreedz ? "Already on BREEDZ? " : "Har du allerede konto? ";

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--page-gradient, var(--bg-subtle))",
      backgroundAttachment: "fixed",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)",
      padding: "40px 20px",
    }}>
      <style>{`* { box-sizing: border-box; } @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>

      <div style={{ width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <img src={tenant.logoSrc} alt={tenant.brandName} style={{ height: 44, objectFit: "contain" }} />
          <h1 className="font-serif" style={{
            fontSize: "clamp(36px, 6vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.015em",
            color: "var(--text)", fontWeight: 600, margin: 0,
          }}>
            {headline.lead}<span className="headline-gradient">{headline.gradient}</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--text-muted)", margin: 0, maxWidth: 420 }}>
            {subtext}
          </p>
        </div>

        <div className="glass-card glow-border" style={{ padding: 32 }}>
          {mode === "register" && inp("name", nameLabel)}
          {mode === "register" && inp("handle", handleLabel)}
          {mode === "register" && inp("invite_code", inviteLabel)}
          {inp("email", emailLabel, "email")}
          {inp("password", passwordLabel, "password")}

          {error && (
            <div style={{
              background: "color-mix(in srgb, var(--danger) 9%, transparent)",
              border: "1px solid var(--danger)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: "var(--danger)", fontSize: 14,
            }}>
              {error}
            </div>
          )}

          <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ width: "100%", marginTop: 4 }}>
            {loading ? "…" : mode === "login" ? signInCta : `${joinCta} →`}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-muted)", fontSize: 14 }}>
            {mode === "login" ? switchToRegister : switchToLogin}
            <span onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}
            >
              {mode === "login" ? joinCta : signInCta}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HOVED-APP ────────────────────────────────────────────────────────────────

export default function HelpTruth() {
  const tenant = useTenant();
  const isBreedz = tenant.id === "breedz";
  const navItems = NAV_BY_TENANT[tenant.id] || NAV_BY_TENANT.breedz;
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [posts, setPosts]             = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [newPost, setNewPost]         = useState("");
  const [charCount, setCharCount]     = useState(0);
  const [activePage, setActivePage]   = useState("home");
  const [activeTab, setActiveTab]     = useState("forDeg");
  const [following, setFollowing]     = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast]             = useState(null);
  const [posting, setPosting]         = useState(false);
  const textareaRef = useRef();

  // Bilde-opplasting state
  const [imageFile, setImageFile]     = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading]     = useState(false);
  const imageInputRef = useRef();

  // Sitatinnlegg state
  const [quotingPost, setQuotingPost] = useState(null);

  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollOptions, setPollOptions]         = useState(["", ""]);
  const [pollDuration, setPollDuration]       = useState(24);

  // Meldinger state
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [chatMessages, setChatMessages]   = useState([]);
  const [messageText, setMessageText]     = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [unreadMessages, setUnreadMessages]   = useState(0);
  const chatEndRef = useRef();

  // Admin state
  const [adminLogs, setAdminLogs] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Responsive state
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth <= 1024;

  // Varsler state
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifs, setUnreadNotifs]     = useState(0);
  const [loadingNotifs, setLoadingNotifs]   = useState(false);

  // Tråd-visning state
  const [threadPost, setThreadPost]       = useState(null);
  const [threadReplies, setThreadReplies] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  // Profil-visning for andre brukere
  const [viewProfile, setViewProfile]     = useState(null);
  const [viewProfilePosts, setViewProfilePosts] = useState([]);

  // Hashtag-visning
  const [hashtagView, setHashtagView]     = useState(null);
  const [hashtagPosts, setHashtagPosts]   = useState([]);

  // Søkeresultater
  const [searchResults, setSearchResults] = useState(null);

  // Profilbilde-opplasting
  const avatarInputRef = useRef();

  function showToast(message, type = "success") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }

  // ── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (token) {
      api("/auth/me")
        .then(user => setCurrentUser(user))
        .catch(() => removeToken())
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // ── Socket.io setup ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    const token = getToken();
    let sock;
    try {
      sock = connectSocket(token);
      sock.on("new_post", (post) => {
        if (post.user_id !== currentUser.id) {
          setPosts(prev => [post, ...prev]);
        }
      });
      sock.on("post_liked", ({ postId, liked }) => {
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, likes_count: (p.likes_count ?? 0) + (liked ? 1 : -1) } : p
        ));
      });
      sock.on("post_reposted", ({ postId, reposted }) => {
        setPosts(prev => prev.map(p =>
          p.id === postId ? { ...p, reposts_count: (p.reposts_count ?? 0) + (reposted ? 1 : -1) } : p
        ));
      });
      sock.on("new_notification", (notif) => {
        setNotifications(prev => [notif, ...prev]);
        setUnreadNotifs(prev => prev + 1);
      });
      sock.on("new_message", (msg) => {
        if (activeConversation && msg.sender_id === activeConversation.other_user_id) {
          setChatMessages(prev => [...prev, msg]);
        }
        setUnreadMessages(prev => prev + 1);
        // Oppdater samtale-liste
        setConversations(prev => {
          const existing = prev.find(c => c.other_user_id === msg.sender_id);
          if (existing) {
            return prev.map(c => c.other_user_id === msg.sender_id
              ? { ...c, last_message: msg.content, last_message_at: msg.created_at, unread_count: (c.unread_count || 0) + 1 }
              : c
            ).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
          }
          return prev;
        });
      });
    } catch (e) {
      // Socket.io ikke tilgjengelig - fortsett uten sanntid
    }

    return () => disconnectSocket();
  }, [currentUser]); // eslint-disable-line

  // ── Hent badge counts ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    api("/notifications/unread/count").then(d => setUnreadNotifs(d.count)).catch(() => {});
    api("/messages/unread/count").then(d => setUnreadMessages(d.count)).catch(() => {});
  }, [currentUser]);

  // ── Hent innlegg ────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!currentUser) return;
    setLoadingPosts(true);
    try {
      let data;
      if (activePage === "bookmarks") {
        data = await api("/posts/bookmarks/all");
      } else if (activePage === "profile") {
        data = await api(`/users/${currentUser.handle}/posts`);
      } else if (activeTab === "følger" && activePage === "home") {
        data = await api("/posts/following");
      } else {
        data = await api("/posts");
      }
      setPosts(data);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoadingPosts(false);
    }
  }, [currentUser, activePage, activeTab]);

  useEffect(() => {
    if (["home", "bookmarks", "profile"].includes(activePage)) {
      fetchPosts();
    }
  }, [fetchPosts, activePage]);

  // ── Hent varsler ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePage === "notifications" && currentUser) {
      setLoadingNotifs(true);
      api("/notifications")
        .then(data => { setNotifications(data); setUnreadNotifs(0); api("/notifications/read-all", { method: "PUT" }).catch(() => {}); })
        .catch(() => {})
        .finally(() => setLoadingNotifs(false));
    }
  }, [activePage, currentUser]);

  // ── Hent samtaler ───────────────────────────────────────────────────────
  useEffect(() => {
    if (activePage === "messages" && currentUser) {
      setLoadingMessages(true);
      api("/messages/conversations")
        .then(data => setConversations(data))
        .catch(() => {})
        .finally(() => setLoadingMessages(false));
    }
  }, [activePage, currentUser]);

  // ── Hent chat-meldinger ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeConversation) {
      setLoadingMessages(true);
      api(`/messages/${activeConversation.other_user_id}`)
        .then(data => {
          setChatMessages(data);
          setUnreadMessages(prev => Math.max(0, prev - (activeConversation.unread_count || 0)));
        })
        .catch(() => {})
        .finally(() => setLoadingMessages(false));
    }
  }, [activeConversation]);

  // Scroll til bunnen av chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── AKSJONER ──────────────────────────────────────────────────────────────

  async function handlePost() {
    if (!newPost.trim() || newPost.length > 280 || posting) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        setUploading(true);
        imageUrl = await uploadFile(imageFile);
        setUploading(false);
      }

      const body = { content: newPost.trim() };
      if (imageUrl) body.image_url = imageUrl;
      if (quotingPost) body.quote_post_id = quotingPost.id;
      if (showPollCreator && pollOptions.filter(o => o.trim()).length >= 2) {
        body.poll = {
          options: pollOptions.filter(o => o.trim()),
          duration_hours: pollDuration,
        };
      }

      const post = await api("/posts", { method: "POST", body });
      setPosts(prev => [post, ...prev]);
      setNewPost(""); setCharCount(0);
      setImageFile(null); setImagePreview(null);
      setQuotingPost(null);
      setShowPollCreator(false); setPollOptions(["", ""]);
      showToast("Innlegg publisert!");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setPosting(false); setUploading(false);
    }
  }

  async function handleLike(id) {
    try {
      const { liked } = await api(`/posts/${id}/like`, { method: "POST" });
      const updatePost = p => p.id === id ? { ...p, liked, likes_count: (p.likes_count ?? 0) + (liked ? 1 : -1) } : p;
      setPosts(prev => prev.map(updatePost));
      if (threadPost?.id === id) setThreadPost(prev => updatePost(prev));
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleRepost(id) {
    try {
      const { reposted } = await api(`/posts/${id}/repost`, { method: "POST" });
      const updatePost = p => p.id === id ? { ...p, reposted, reposts_count: (p.reposts_count ?? 0) + (reposted ? 1 : -1) } : p;
      setPosts(prev => prev.map(updatePost));
      if (threadPost?.id === id) setThreadPost(prev => updatePost(prev));
      showToast(reposted ? "Repostet" : "Repost fjernet");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleBookmark(id) {
    try {
      const { bookmarked } = await api(`/posts/${id}/bookmark`, { method: "POST" });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, bookmarked } : p));
      showToast(bookmarked ? "Bokmerket" : "Bokmerke fjernet");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleDelete(id) {
    try {
      await api(`/posts/${id}`, { method: "DELETE" });
      setPosts(prev => prev.filter(p => p.id !== id));
      showToast("Innlegg slettet");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleReply(id, content) {
    try {
      const reply = await api(`/posts/${id}/reply`, { method: "POST", body: { content } });
      setPosts(prev => prev.map(p =>
        p.id === id ? { ...p, replies_count: (p.replies_count ?? 0) + 1 } : p
      ));
      if (threadPost?.id === id) {
        setThreadReplies(prev => [...prev, reply]);
        setThreadPost(prev => ({ ...prev, replies_count: (prev.replies_count ?? 0) + 1 }));
      }
      showToast("Svar sendt");
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleVote(postId, optionIndex) {
    try {
      const { votes, user_vote } = await api(`/posts/${postId}/vote`, { method: "POST", body: { option_index: optionIndex } });
      const updatePost = p => p.id === postId ? { ...p, poll_votes: votes, poll_user_vote: user_vote } : p;
      setPosts(prev => prev.map(updatePost));
      if (threadPost?.id === postId) setThreadPost(prev => updatePost(prev));
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleFollow(handle) {
    try {
      const { following: isFollowing } = await api(`/users/${handle}/follow`, { method: "POST" });
      setFollowing(prev => ({ ...prev, [`@${handle}`]: isFollowing }));
      if (viewProfile?.handle === handle) {
        setViewProfile(prev => ({
          ...prev,
          is_following: isFollowing,
          followers_count: (prev.followers_count || 0) + (isFollowing ? 1 : -1),
        }));
      }
      showToast(isFollowing ? `Følger @${handle}` : `Avfulgte @${handle}`);
    } catch (err) { showToast(err.message, "error"); }
  }

  async function handleSendMessage() {
    if (!messageText.trim() || !activeConversation) return;
    try {
      const msg = await api("/messages", {
        method: "POST",
        body: { receiver_id: activeConversation.other_user_id, content: messageText.trim() },
      });
      setChatMessages(prev => [...prev, msg]);
      setMessageText("");
      // Oppdater samtale-liste
      setConversations(prev => prev.map(c =>
        c.other_user_id === activeConversation.other_user_id
          ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
          : c
      ));
    } catch (err) { showToast(err.message, "error"); }
  }

  // Åpne tråd
  async function openThread(postId) {
    setLoadingThread(true);
    setActivePage("thread");
    try {
      const [post, replies] = await Promise.all([
        api(`/posts/${postId}`),
        api(`/posts/${postId}/replies`),
      ]);
      setThreadPost(post);
      setThreadReplies(replies);
    } catch (err) {
      showToast(err.message, "error");
      setActivePage("home");
    } finally {
      setLoadingThread(false);
    }
  }

  // Åpne brukerprofil eller hashtag
  function handleClickUser(handle, hashtag) {
    if (hashtag) {
      setHashtagView(hashtag);
      setActivePage("hashtag");
      api(`/search/hashtag/${encodeURIComponent(hashtag)}`)
        .then(data => setHashtagPosts(data))
        .catch(() => {});
      return;
    }
    if (!handle) return;
    if (handle === currentUser.handle) {
      setActivePage("profile");
      return;
    }
    setActivePage("userProfile");
    setViewProfile(null);
    setViewProfilePosts([]);
    Promise.all([
      api(`/users/${handle}`),
      api(`/users/${handle}/posts`),
    ]).then(([user, posts]) => {
      setViewProfile(user);
      setViewProfilePosts(posts);
    }).catch(err => { showToast(err.message, "error"); setActivePage("home"); });
  }

  // Bilde-valg
  function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Bilde kan ikke være over 5MB", "error");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  // Avatar-opplasting
  async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      setCurrentUser(prev => ({ ...prev, profile_image: url }));
      showToast("Profilbilde oppdatert!");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Søk
  async function handleSearch(q) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults(null); return; }
    setActivePage("explore");
    try {
      const results = await api(`/search?q=${encodeURIComponent(q)}`);
      setSearchResults(results);
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // Starter ny samtale
  function startConversation(user) {
    setActivePage("messages");
    setActiveConversation({
      other_user_id: user.id,
      other_name: user.name,
      other_handle: user.handle,
      other_avatar: user.avatar,
      other_avatar_color: user.avatar_color,
      other_profile_image: user.profile_image,
    });
  }

  function handleLogout() {
    disconnectSocket();
    localStorage.clear();
    window.location.replace("/");
  }

  // ── Render guards ─────────────────────────────────────────────────────────
  if (!authChecked) return (
    <div style={{ minHeight: "100vh", background: "var(--bg-subtle)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Spinner />
    </div>
  );

  if (!currentUser) return <AuthPage onLogin={user => { setCurrentUser(user); setAuthChecked(true); }} />;

  // ── NAV BADGE NUMBERS ─────────────────────────────────────────────────────
  const navBadges = {
    notifications: unreadNotifs,
    messages: unreadMessages,
  };

  // ── LAYOUT ────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight: "100vh", background: "var(--bg-subtle)", color: "var(--text)", fontFamily: "var(--font-sans)", display: "flex", justifyContent: "center", paddingBottom: isMobile ? 56 : 0 },
    container: { width: "100%", maxWidth: 1200, display: "flex", position: "relative" },
    sidebar: isMobile
      ? { position: "fixed", top: 0, left: sidebarOpen ? 0 : -280, width: 280, height: "100vh", background: "var(--bg-elevated)", zIndex: 200, padding: "20px 12px", overflowY: "auto", transition: "left 0.25s ease", borderRight: "1px solid var(--border)", boxShadow: sidebarOpen ? "4px 0 20px rgba(0,0,0,0.5)" : "none" }
      : isTablet
        ? { width: 60, padding: "20px 6px", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0, borderRight: "1px solid var(--border)" }
        : { width: 260, padding: "20px 12px", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0, borderRight: "1px solid var(--border)" },
    feed: { flex: 1, borderRight: isMobile ? "none" : "1px solid var(--border)", maxWidth: isMobile ? "100%" : 620 },
    feedHeader: { position: "sticky", top: 0, background: "var(--bg-subtle)", backdropFilter: "blur(20px)", zIndex: 10, borderBottom: "1px solid var(--border)" },
    rightSidebar: (isMobile || isTablet) ? { display: "none" } : { width: 300, padding: "20px 16px", position: "sticky", top: 0, height: "100vh", overflowY: "auto", flexShrink: 0 },
    backBtn: { background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 18, padding: "8px 12px", borderRadius: "50%", marginRight: 8 },
  };

  const postCardProps = {
    onLike: handleLike, onRepost: handleRepost,
    onBookmark: handleBookmark, onDelete: handleDelete,
    onReply: handleReply, onVote: handleVote,
    onQuote: (p) => { setQuotingPost(p); setActivePage("home"); setTimeout(() => textareaRef.current?.focus(), 100); },
    onClickPost: openThread,
    onClickUser: handleClickUser,
    currentUser,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Crimson+Pro:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        textarea::placeholder, input::placeholder { color: var(--text-faint) !important; }
        @keyframes gradientShift {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @media(max-width:767px) {
          .post-card { padding: 12px !important; }
        }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} />}
      <input type="file" accept="image/*" ref={imageInputRef} style={{ display: "none" }} onChange={handleImageSelect} />
      <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: "none" }} onChange={handleAvatarUpload} />

      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 199 }} />
      )}

      <div style={S.app}>
        {/* Mobile top bar */}
        {isMobile && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "var(--bg-elevated)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "12px 16px", gap: 12 }}>
            <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", color: "var(--text)", fontSize: 22, cursor: "pointer", padding: 4 }}>☰</button>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--accent)" }}>{tenant.brandName}</span>
          </div>
        )}

        <div style={{ ...S.container, marginTop: isMobile ? 48 : 0 }}>

          {/* ── VENSTRE SIDEBAR ── */}
          <div style={S.sidebar}>
            <div style={{ padding: "8px 12px", marginBottom: 16, cursor: "pointer", textAlign: isTablet ? "center" : "left" }}
              onClick={() => { setActivePage("home"); setThreadPost(null); setViewProfile(null); setHashtagView(null); setSearchResults(null); if (isMobile) setSidebarOpen(false); }}
            >
              {isTablet ? (
                <span
                  className={isBreedz ? "headline-gradient" : undefined}
                  style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 800, color: isBreedz ? undefined : "var(--accent)" }}
                >
                  {tenant.brandName.charAt(0)}
                </span>
              ) : isBreedz ? (
                <span
                  className="headline-gradient"
                  style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", display: "inline-block" }}
                >
                  {tenant.brandName}
                </span>
              ) : (
                <img src={tenant.logoSrc} alt={tenant.brandName} style={{height: 36, objectFit: "contain", mixBlendMode: "multiply"}} />
              )}
            </div>

            <nav>
              {navItems.map(item => {
                const ItemIcon = item.Icon;
                const active = activePage === item.key;
                return (
                <div key={item.key}
                  onClick={() => { setActivePage(item.key); setThreadPost(null); setViewProfile(null); setHashtagView(null); setActiveConversation(null); if (isMobile) setSidebarOpen(false); }}
                  title={isTablet ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: isTablet ? 0 : 14,
                    padding: isTablet ? "10px 0" : "10px 12px", borderRadius: 28, cursor: "pointer", marginBottom: 4,
                    justifyContent: isTablet ? "center" : "flex-start",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 16, fontFamily: "var(--font-sans)",
                    background: active ? "var(--surface)" : "transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <ItemIcon size={20} strokeWidth={active ? 2.4 : 2} />
                  {!isTablet && item.label}
                  {(navBadges[item.key] > 0) && (
                    <span style={{ background: "var(--accent)", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700, marginLeft: 4 }}>
                      {navBadges[item.key]}
                    </span>
                  )}
                </div>
                );
              })}
              {currentUser.verified && (
                <div
                  onClick={() => { setActivePage("admin"); setThreadPost(null); setViewProfile(null); setHashtagView(null); setActiveConversation(null); if (isMobile) setSidebarOpen(false); }}
                  title={isTablet ? (ADMIN_LABEL[tenant.id] || ADMIN_LABEL.breedz) : undefined}
                  style={{
                    display: "flex", alignItems: "center", gap: isTablet ? 0 : 14,
                    padding: isTablet ? "10px 0" : "10px 12px", borderRadius: 28, cursor: "pointer", marginBottom: 4,
                    justifyContent: isTablet ? "center" : "flex-start",
                    color: activePage === "admin" ? "var(--accent)" : "var(--text-muted)",
                    fontWeight: activePage === "admin" ? 700 : 500,
                    fontSize: 16, fontFamily: "var(--font-sans)",
                    background: activePage === "admin" ? "var(--surface)" : "transparent",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => { if (activePage !== "admin") e.currentTarget.style.background = "var(--surface)"; }}
                  onMouseLeave={e => { if (activePage !== "admin") e.currentTarget.style.background = "transparent"; }}
                >
                  <Settings size={20} strokeWidth={activePage === "admin" ? 2.4 : 2} />
                  {!isTablet && (ADMIN_LABEL[tenant.id] || ADMIN_LABEL.breedz)}
                </div>
              )}
            </nav>

            <button
              onClick={() => { setActivePage("home"); setTimeout(() => textareaRef.current?.focus(), 100); }}
              style={{
                width: "100%", marginTop: 16,
                background: "var(--primary-gradient)",
                color: "#fff", border: "none", borderRadius: 28, padding: "14px",
                fontWeight: 700, cursor: "pointer", fontSize: 16,
                fontFamily: "var(--font-sans)",
                letterSpacing: "0.02em",
                boxShadow: "0 12px 30px -10px var(--border-glow), 0 4px 12px -4px rgba(0,0,0,0.12)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 18px 40px -12px var(--border-glow), 0 6px 16px -4px rgba(0,0,0,0.16)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 12px 30px -10px var(--border-glow), 0 4px 12px -4px rgba(0,0,0,0.12)"; }}
            >
              {isTablet ? "+" : (POST_CTA[tenant.id] || POST_CTA.breedz)}
            </button>

            <div style={{
              position: "absolute", bottom: 16, left: 12, right: 12,
              display: "flex", flexDirection: isTablet ? "column" : "row", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 16,
            }}>
              {!isTablet && (
              <>
              <ProfileImage src={currentUser.profile_image} initials={currentUser.avatar} color={currentUser.avatar_color || "var(--accent)"} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", fontFamily: "var(--font-sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentUser.name}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>@{currentUser.handle}</div>
              </div>
              </>
              )}
              <button onClick={handleLogout} title={LOGOUT_LABEL[tenant.id] || LOGOUT_LABEL.breedz}
                style={{
                  background: "none", border: "1px solid var(--border-hard)", color: "var(--text-muted)",
                  cursor: "pointer", fontSize: 13, padding: isTablet ? "8px" : "6px 14px",
                  borderRadius: 20, fontFamily: "var(--font-sans)",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s", width: isTablet ? 40 : "auto",
                  justifyContent: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--danger)"; e.currentTarget.style.color = "var(--danger)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-hard)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >{isTablet ? "🚪" : `🚪 ${LOGOUT_LABEL[tenant.id] || LOGOUT_LABEL.breedz}`}</button>
            </div>
          </div>

          {/* ── MAIN FEED ── */}
          <main style={S.feed}>

            {/* ═══ HJEM ═══ */}
            {activePage === "home" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "16px 20px 0", fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Hjem</div>
                  <div style={{ display: "flex" }}>
                    {["forDeg", "følger"].map(tab => (
                      <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        flex: 1, padding: "12px 0", textAlign: "center",
                        fontFamily: "var(--font-serif)", fontSize: 15,
                        cursor: "pointer", border: "none", background: "transparent",
                        color: activeTab === tab ? "var(--text)" : "var(--text-muted)",
                        borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                      }}>
                        {tab === "forDeg" ? "For deg" : "Følger"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compose */}
                <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12 }}>
                  <ProfileImage src={currentUser.profile_image} initials={currentUser.avatar} color={currentUser.avatar_color || "var(--accent)"} />
                  <div style={{ flex: 1 }}>
                    <textarea
                      ref={textareaRef} value={newPost}
                      onChange={e => { setNewPost(e.target.value); setCharCount(e.target.value.length); }}
                      placeholder={isBreedz ? "What's on your mind?" : "Hva skjer?"}
                      onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handlePost(); }}
                      style={{
                        width: "100%", background: "transparent", border: "none", outline: "none",
                        resize: "none", color: "var(--text)", fontSize: 18, minHeight: 70,
                        fontFamily: "var(--font-sans)", lineHeight: 1.5,
                      }}
                    />

                    {/* Bilde-forhåndsvisning */}
                    {imagePreview && (
                      <div style={{ position: "relative", marginBottom: 10 }}>
                        <img src={imagePreview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 300, objectFit: "cover" }} />
                        <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                          style={{
                            position: "absolute", top: 8, right: 8, background: "#000c", border: "none",
                            borderRadius: "50%", width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14,
                          }}>✕</button>
                      </div>
                    )}

                    {/* Sitatinnlegg-forhåndsvisning */}
                    {quotingPost && (
                      <div style={{ position: "relative", marginBottom: 10 }}>
                        <QuoteEmbed post={{
                          quote_id: quotingPost.id, quote_content: quotingPost.content,
                          quote_image_url: quotingPost.image_url, quote_created_at: quotingPost.created_at,
                          quote_user_name: quotingPost.user_name, quote_user_handle: quotingPost.user_handle,
                          quote_user_avatar: quotingPost.user_avatar, quote_user_avatar_color: quotingPost.user_avatar_color,
                          quote_user_profile_image: quotingPost.user_profile_image, quote_user_verified: quotingPost.user_verified,
                        }} />
                        <button onClick={() => setQuotingPost(null)}
                          style={{
                            position: "absolute", top: 4, right: 4, background: "#000c", border: "none",
                            borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", fontSize: 12,
                          }}>✕</button>
                      </div>
                    )}

                    {/* Poll-opprettar */}
                    {showPollCreator && (
                      <div style={{ marginBottom: 10, padding: 12, background: "var(--bg-elevated)", borderRadius: 12, border: "1px solid var(--border)" }}>
                        {pollOptions.map((opt, i) => (
                          <input key={i} value={opt} placeholder={`Alternativ ${i + 1}`}
                            onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                            style={{
                              width: "100%", background: "var(--bg-subtle)", border: "1px solid var(--border)",
                              borderRadius: 8, padding: "8px 12px", color: "var(--text)",
                              fontSize: 14, fontFamily: "var(--font-sans)", outline: "none",
                              marginBottom: 6,
                            }}
                          />
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          {pollOptions.length < 4 && (
                            <button onClick={() => setPollOptions(prev => [...prev, ""])}
                              style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 12px", color: "var(--accent)", cursor: "pointer", fontSize: 13 }}>
                              + Alternativ
                            </button>
                          )}
                          <select value={pollDuration} onChange={e => setPollDuration(parseInt(e.target.value))}
                            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", color: "var(--text)", fontSize: 13 }}>
                            <option value={1}>1 time</option>
                            <option value={6}>6 timer</option>
                            <option value={24}>1 dag</option>
                            <option value={72}>3 dager</option>
                            <option value={168}>7 dager</option>
                          </select>
                          <button onClick={() => { setShowPollCreator(false); setPollOptions(["", ""]); }}
                            style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 13 }}>Avbryt</button>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => imageInputRef.current?.click()} title="Legg til bilde"
                          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--accent)", padding: "4px 6px", borderRadius: 8 }}
                        >🖼️</button>
                        <button onClick={() => setShowPollCreator(!showPollCreator)} title="Lag avstemning"
                          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: showPollCreator ? "var(--danger)" : "var(--accent)", padding: "4px 6px", borderRadius: 8 }}
                        >📊</button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {charCount > 200 && (
                          <span style={{ color: charCount > 260 ? "var(--danger)" : "var(--text-muted)", fontSize: 13 }}>
                            {280 - charCount}
                          </span>
                        )}
                        <button onClick={handlePost}
                          disabled={!newPost.trim() || newPost.length > 280 || posting}
                          style={{
                            background: newPost.trim() && !posting ? "linear-gradient(135deg,var(--accent),var(--accent-glow))" : "var(--border)",
                            color: newPost.trim() && !posting ? "#fff" : "var(--border)",
                            border: "none", borderRadius: 20, padding: "8px 20px",
                            fontWeight: 700, cursor: "pointer", fontSize: 14,
                            fontFamily: "var(--font-serif)",
                          }}
                        >
                          {uploading ? "Laster opp..." : posting ? "Poster..." : "Post"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {loadingPosts ? <Spinner /> : posts.map(post => (
                  <PostCard key={post.id} post={post} {...postCardProps}
                    isOwn={post.user_id === currentUser.id} />
                ))}
              </>
            )}

            {/* ═══ UTFORSK / SØK ═══ */}
            {activePage === "explore" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "14px 20px", fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Utforsk</div>
                  <div style={{ padding: "0 20px 14px" }}>
                    <div style={{ background: "var(--bg-subtle)", borderRadius: 24, padding: "10px 16px", display: "flex", gap: 10, border: "1px solid var(--border)" }}>
                      <span style={{ color: "var(--accent)" }}>🔍</span>
                      <input value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Søk innlegg og brukere"
                        style={{ background: "none", border: "none", outline: "none", color: "var(--text)", flex: 1, fontSize: 15, fontFamily: "var(--font-sans)" }}
                      />
                    </div>
                  </div>
                </div>
                {searchResults ? (
                  <>
                    {searchResults.users.length > 0 && (
                      <div style={{ borderBottom: "1px solid var(--border)" }}>
                        <div style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>BRUKERE</div>
                        {searchResults.users.map(u => (
                          <div key={u.id} onClick={() => handleClickUser(u.handle)}
                            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(53,109,255,0.06)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <ProfileImage src={u.profile_image} initials={u.avatar} color={u.avatar_color} size={40} />
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>{u.name} {u.verified && <span style={{ color: "var(--accent)" }}>✓</span>}</div>
                              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>@{u.handle} · {formatCount(u.followers_count)} følgere</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.posts.length > 0 && (
                      <>
                        <div style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>INNLEGG</div>
                        {searchResults.posts.map(post => (
                          <PostCard key={post.id} post={post} {...postCardProps} isOwn={post.user_id === currentUser.id} />
                        ))}
                      </>
                    )}
                    {searchResults.users.length === 0 && searchResults.posts.length === 0 && (
                      <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ingen resultater</div>
                    )}
                  </>
                ) : (
                  loadingPosts ? <Spinner /> : posts.map(post => (
                    <PostCard key={post.id} post={post} {...postCardProps} isOwn={post.user_id === currentUser.id} />
                  ))
                )}
              </>
            )}

            {/* ═══ BOKMERKER ═══ */}
            {activePage === "bookmarks" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "16px 20px", fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Bokmerker</div>
                </div>
                {loadingPosts ? <Spinner /> : posts.length === 0
                  ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ingen bokmerker ennå</div>
                  : posts.map(post => (
                    <PostCard key={post.id} post={post} {...postCardProps} isOwn={post.user_id === currentUser.id} />
                  ))
                }
              </>
            )}

            {/* ═══ PROFIL (egen) ═══ */}
            {activePage === "profile" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text)" }}>{currentUser.name}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{posts.length} innlegg</div>
                    </div>
                  </div>
                </div>
                <div style={{ height: 120, background: "linear-gradient(135deg,var(--bg-subtle),color-mix(in srgb, var(--accent) 20%, transparent))", position: "relative", marginBottom: 56 }}>
                  <div style={{ position: "absolute", bottom: -44, left: 20 }}>
                    <div style={{ position: "relative" }}>
                      <ProfileImage src={currentUser.profile_image} initials={currentUser.avatar} color={currentUser.avatar_color || "var(--accent)"} size={80} />
                      <button onClick={() => avatarInputRef.current?.click()} title="Endre profilbilde"
                        style={{
                          position: "absolute", bottom: 0, right: 0,
                          background: "var(--bg-elevated)", border: "2px solid var(--border)", borderRadius: "50%",
                          width: 28, height: 28, cursor: "pointer", fontSize: 12,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>📷</button>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "0 20px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>
                    {currentUser.name} {currentUser.verified && <span style={{ color: "var(--accent)" }}>✓</span>}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginBottom: 8 }}>@{currentUser.handle}</div>
                  {currentUser.bio && <p style={{ color: "var(--text)", fontSize: 15, marginBottom: 12 }}>{currentUser.bio}</p>}
                  <div style={{ display: "flex", gap: 20, fontSize: 14 }}>
                    <span><strong style={{ color: "var(--text)" }}>{currentUser.following_count ?? 0}</strong> <span style={{ color: "var(--text-muted)" }}>Følger</span></span>
                    <span><strong style={{ color: "var(--text)" }}>{currentUser.followers_count ?? 0}</strong> <span style={{ color: "var(--text-muted)" }}>Følgere</span></span>
                  </div>
                </div>
                {loadingPosts ? <Spinner /> : posts.map(post => (
                  <PostCard key={post.id} post={post} {...postCardProps} isOwn={true} />
                ))}
              </>
            )}

            {/* ═══ ANNEN BRUKERS PROFIL ═══ */}
            {activePage === "userProfile" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center" }}>
                    <button onClick={() => setActivePage("home")} style={S.backBtn}>←</button>
                    <div>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, color: "var(--text)" }}>{viewProfile?.name || "..."}</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{viewProfilePosts.length} innlegg</div>
                    </div>
                  </div>
                </div>
                {viewProfile ? (
                  <>
                    <div style={{ height: 120, background: "linear-gradient(135deg,var(--bg-subtle),color-mix(in srgb, var(--accent) 20%, transparent))", position: "relative", marginBottom: 56 }}>
                      <div style={{ position: "absolute", bottom: -44, left: 20 }}>
                        <ProfileImage src={viewProfile.profile_image} initials={viewProfile.avatar} color={viewProfile.avatar_color} size={80} />
                      </div>
                      <div style={{ position: "absolute", bottom: -40, right: 20, display: "flex", gap: 8 }}>
                        <button onClick={() => startConversation(viewProfile)}
                          style={{ background: "transparent", border: "1px solid var(--text-muted)", borderRadius: 20, padding: "6px 14px", color: "var(--text)", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-serif)" }}>
                          ✉️
                        </button>
                        <button onClick={() => handleFollow(viewProfile.handle)}
                          style={{
                            background: viewProfile.is_following ? "transparent" : "var(--text)",
                            color: viewProfile.is_following ? "var(--text)" : "var(--bg-subtle)",
                            border: viewProfile.is_following ? "1px solid var(--text-muted)" : "none",
                            borderRadius: 20, padding: "6px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "var(--font-serif)",
                          }}>
                          {viewProfile.is_following ? "Følger" : "Følg"}
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: "0 20px 16px", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>
                        {viewProfile.name} {viewProfile.verified && <span style={{ color: "var(--accent)" }}>✓</span>}
                      </div>
                      <div style={{ color: "var(--text-muted)", marginBottom: 8 }}>@{viewProfile.handle}</div>
                      {viewProfile.bio && <p style={{ color: "var(--text)", fontSize: 15, marginBottom: 12 }}>{viewProfile.bio}</p>}
                      <div style={{ display: "flex", gap: 20, fontSize: 14 }}>
                        <span><strong style={{ color: "var(--text)" }}>{viewProfile.following_count ?? 0}</strong> <span style={{ color: "var(--text-muted)" }}>Følger</span></span>
                        <span><strong style={{ color: "var(--text)" }}>{viewProfile.followers_count ?? 0}</strong> <span style={{ color: "var(--text-muted)" }}>Følgere</span></span>
                      </div>
                    </div>
                    {viewProfilePosts.map(post => (
                      <PostCard key={post.id} post={post} {...postCardProps} isOwn={post.user_id === currentUser.id} />
                    ))}
                  </>
                ) : <Spinner />}
              </>
            )}

            {/* ═══ VARSLER ═══ */}
            {activePage === "notifications" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "16px 20px", fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Varsler</div>
                </div>
                {loadingNotifs ? <Spinner /> : notifications.length === 0
                  ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ingen varsler ennå</div>
                  : notifications.map(n => (
                    <div key={n.id} onClick={() => n.post_id && openThread(n.post_id)}
                      style={{
                        display: "flex", gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border)",
                        cursor: n.post_id ? "pointer" : "default",
                        background: n.read ? "transparent" : "rgba(59,130,246,0.03)",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : "rgba(59,130,246,0.03)"}
                    >
                      <span style={{ fontSize: 22 }}>{NOTIF_ICONS[n.type] || "🔔"}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <ProfileImage src={n.from_profile_image} initials={n.from_avatar} color={n.from_avatar_color} size={24} />
                          <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14 }}>{n.from_name}</span>
                          {n.from_verified && <span style={{ color: "var(--accent)", fontSize: 12 }}>✓</span>}
                        </div>
                        <p style={{ color: "var(--text)", fontSize: 14, fontFamily: "var(--font-sans)" }}>
                          <strong>@{n.from_handle}</strong> {NOTIF_TEXT[n.type] || n.type}
                        </p>
                        {n.post_content && (
                          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4, fontStyle: "italic" }}>
                            "{n.post_content.slice(0, 80)}{n.post_content.length > 80 ? "..." : ""}"
                          </p>
                        )}
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{timeAgo(n.created_at)}</span>
                      </div>
                    </div>
                  ))
                }
              </>
            )}

            {/* ═══ MELDINGER ═══ */}
            {activePage === "messages" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "16px 20px", display: "flex", alignItems: "center" }}>
                    {activeConversation && (
                      <button onClick={() => setActiveConversation(null)} style={S.backBtn}>←</button>
                    )}
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>
                      {activeConversation ? activeConversation.other_name : "Meldinger"}
                    </span>
                  </div>
                </div>

                {!activeConversation ? (
                  // Samtale-liste
                  loadingMessages ? <Spinner /> : conversations.length === 0
                    ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
                        <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, color: "var(--text)", marginBottom: 8 }}>Ingen meldinger ennå</div>
                        <p>Besøk en profil og send en melding!</p>
                      </div>
                    : conversations.map(c => (
                      <div key={c.other_user_id} onClick={() => setActiveConversation(c)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "14px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(53,109,255,0.06)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <ProfileImage src={c.other_profile_image} initials={c.other_avatar} color={c.other_avatar_color} size={44} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 15 }}>
                              {c.other_name} {c.other_verified && <span style={{ color: "var(--accent)" }}>✓</span>}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{timeAgo(c.last_message_at)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <p style={{ color: "var(--text-muted)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 300 }}>
                              {c.last_sender_id === currentUser.id && "Du: "}{c.last_message}
                            </p>
                            {c.unread_count > 0 && (
                              <span style={{ background: "var(--accent)", color: "var(--bg-subtle)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                                {c.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  // Chat-vindu
                  <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)" }}>
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                      {loadingMessages ? <Spinner /> : chatMessages.map(msg => (
                        <div key={msg.id} style={{
                          display: "flex", justifyContent: msg.sender_id === currentUser.id ? "flex-end" : "flex-start",
                          marginBottom: 8,
                        }}>
                          <div style={{
                            maxWidth: "70%", padding: "10px 14px", borderRadius: 16,
                            background: msg.sender_id === currentUser.id ? "var(--accent)" : "var(--bg-subtle)",
                            border: msg.sender_id === currentUser.id ? "none" : "1px solid var(--border)",
                          }}>
                            <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.5 }}>{msg.content}</p>
                            <span style={{ color: msg.sender_id === currentUser.id ? "var(--accent)" : "var(--text-muted)", fontSize: 11 }}>
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
                      <input value={messageText}
                        onChange={e => setMessageText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleSendMessage()}
                        placeholder="Skriv en melding..."
                        style={{
                          flex: 1, background: "var(--bg-subtle)", border: "1px solid var(--border)",
                          borderRadius: 24, padding: "10px 16px", color: "var(--text)",
                          fontSize: 14, fontFamily: "var(--font-sans)", outline: "none",
                        }}
                      />
                      <button onClick={handleSendMessage} disabled={!messageText.trim()}
                        style={{
                          background: messageText.trim() ? "linear-gradient(135deg,var(--accent),var(--accent-glow))" : "var(--border)",
                          color: messageText.trim() ? "#fff" : "var(--border)",
                          border: "none", borderRadius: 20, padding: "8px 18px",
                          fontWeight: 700, cursor: "pointer", fontSize: 14, fontFamily: "var(--font-serif)",
                        }}>Send</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ═══ ADMIN ═══ */}
            {activePage === "admin" && currentUser.verified && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "16px 20px" }}>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Admin — Innloggingslogg</span>
                  </div>
                </div>
                <div style={{ padding: "16px 20px" }}>
                  <button onClick={async () => {
                    setAdminLoading(true);
                    try {
                      const data = await api("/admin/logs");
                      setAdminLogs(data.logs);
                    } catch (e) { setToast("Feil: " + e.message); }
                    setAdminLoading(false);
                  }} style={{
                    background: "linear-gradient(135deg,var(--accent),var(--accent-glow))", color: "#fff",
                    border: "none", borderRadius: 20, padding: "10px 24px", cursor: "pointer",
                    fontFamily: "var(--font-serif)", fontSize: 14, marginBottom: 16,
                  }}>
                    {adminLoading ? "Laster..." : "Hent logger"}
                  </button>

                  {adminLogs.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "left" }}>
                            <th style={{ padding: "10px 8px", color: "var(--accent)", fontFamily: "var(--font-serif)" }}>Bruker</th>
                            <th style={{ padding: "10px 8px", color: "var(--accent)", fontFamily: "var(--font-serif)" }}>IP</th>
                            <th style={{ padding: "10px 8px", color: "var(--accent)", fontFamily: "var(--font-serif)" }}>Enhet</th>
                            <th style={{ padding: "10px 8px", color: "var(--accent)", fontFamily: "var(--font-serif)" }}>Tidspunkt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminLogs.map(log => (
                            <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                              <td style={{ padding: "10px 8px", color: "var(--text)" }}>
                                <div style={{ fontWeight: 700 }}>{log.name}</div>
                                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>@{log.handle}</div>
                              </td>
                              <td style={{ padding: "10px 8px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: 12 }}>{log.ip_address || "—"}</td>
                              <td style={{ padding: "10px 8px", color: "var(--text-muted)" }}>{log.device || "—"}</td>
                              <td style={{ padding: "10px 8px", color: "var(--text-muted)", fontSize: 12 }}>{new Date(log.created_at).toLocaleString("no-NO")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!adminLoading && adminLogs.length === 0 && (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                      <p>Trykk "Hent logger" for å se innloggingshistorikk</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══ TRÅD-VISNING ═══ */}
            {activePage === "thread" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center" }}>
                    <button onClick={() => setActivePage("home")} style={S.backBtn}>←</button>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--text)" }}>Innlegg</span>
                  </div>
                </div>
                {loadingThread ? <Spinner /> : threadPost && (
                  <>
                    <PostCard post={threadPost} {...postCardProps} isOwn={threadPost.user_id === currentUser.id}
                      onClickPost={null} />
                    {threadReplies.length > 0 && (
                      <>
                        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 13, fontWeight: 700 }}>
                          SVAR ({threadReplies.length})
                        </div>
                        {threadReplies.map(r => (
                          <div key={r.id} style={{ display: "flex", gap: 12, padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
                            <ProfileImage src={r.user_profile_image} initials={r.user_avatar} color={r.user_avatar_color} size={36}
                              onClick={() => handleClickUser(r.user_handle)} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontWeight: 700, color: "var(--text)", fontSize: 14, cursor: "pointer" }}
                                  onClick={() => handleClickUser(r.user_handle)}>{r.user_name}</span>
                                {r.user_verified && <span style={{ color: "var(--accent)", fontSize: 12 }}>✓</span>}
                                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>@{r.user_handle}</span>
                                <span style={{ color: "var(--border)" }}>·</span>
                                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{timeAgo(r.created_at)}</span>
                              </div>
                              <p style={{ color: "var(--text)", fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>{r.content}</p>
                              {r.image_url && (
                                <img src={r.image_url} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 8, maxHeight: 300, objectFit: "cover" }} />
                              )}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {/* ═══ HASHTAG-VISNING ═══ */}
            {activePage === "hashtag" && (
              <>
                <div style={S.feedHeader}>
                  <div style={{ padding: "14px 20px", display: "flex", alignItems: "center" }}>
                    <button onClick={() => setActivePage("home")} style={S.backBtn}>←</button>
                    <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--accent)" }}>#{hashtagView}</span>
                  </div>
                </div>
                {hashtagPosts.length === 0
                  ? <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Ingen innlegg med #{hashtagView}</div>
                  : hashtagPosts.map(post => (
                    <PostCard key={post.id} post={post} {...postCardProps} isOwn={post.user_id === currentUser.id} />
                  ))
                }
              </>
            )}

          </main>

          {/* ── HØYRE SIDEBAR ── */}
          <aside style={S.rightSidebar}>
            <div style={{ background: "var(--bg-subtle)", borderRadius: 24, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, border: "1px solid var(--border)" }}>
              <span style={{ color: "var(--text-muted)" }}>🔍</span>
              <input value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder={`Søk på ${tenant.brandName}`}
                style={{ background: "none", border: "none", outline: "none", color: "var(--text)", flex: 1, fontSize: 14, fontFamily: "var(--font-sans)" }}
              />
            </div>

            {/* Trending */}
            <div className="breedz-glass breedz-glow" style={{ marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border-hard)", letterSpacing: "-0.01em" }}>
                {TRENDING_TITLE[tenant.id] || TRENDING_TITLE.breedz}
              </div>
              {TRENDING.map((t, i) => (
                <div key={i} onClick={() => handleClickUser(null, t.tag.slice(1))}
                  style={{ padding: "12px 18px", borderBottom: i < TRENDING.length - 1 ? "1px solid var(--border-hard)" : "none", cursor: "pointer", transition: "background 0.15s", fontFamily: "var(--font-sans)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{t.category} · Trend</div>
                  <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 15, marginTop: 2 }}>{t.tag}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{t.posts}</div>
                </div>
              ))}
            </div>

            {/* Who to follow / Hvem å følge */}
            <div className="breedz-glass breedz-glow" style={{ overflow: "hidden", marginBottom: 16 }}>
              <div style={{ padding: "14px 18px", fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border-hard)", letterSpacing: "-0.01em" }}>
                {FOLLOW_TITLE[tenant.id] || FOLLOW_TITLE.breedz}
              </div>
              {[
                { name: "HentePenger", handle: "hentepenger", avatar: "HP", color: "var(--accent)" },
                { name: "StartFunder", handle: "startfunder", avatar: "SF", color: "#0e4f8a" },
                { name: "Blockchain NO", handle: "blockchainnorge", avatar: "BN", color: "#7b2d8b" },
              ].map((u, i) => {
                const isFollowing = !!following[`@${u.handle}`];
                return (
                <div key={i} style={{ padding: "12px 18px", borderBottom: i < 2 ? "1px solid var(--border-hard)" : "none", display: "flex", alignItems: "center", gap: 10 }}>
                  <ProfileImage initials={u.avatar} color={u.color} size={36} onClick={() => handleClickUser(u.handle)} />
                  <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => handleClickUser(u.handle)}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", fontFamily: "var(--font-sans)" }}>{u.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}>@{u.handle}</div>
                  </div>
                  <button onClick={() => handleFollow(u.handle)}
                    style={{
                      background: isFollowing ? "transparent" : "var(--primary-gradient)",
                      color: isFollowing ? "var(--text)" : "#fff",
                      border: isFollowing ? "1px solid var(--border-hard)" : "none",
                      borderRadius: 20, padding: "6px 16px",
                      fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)",
                      boxShadow: isFollowing ? "none" : "0 4px 12px -4px var(--border-glow)",
                      transition: "transform 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    {isFollowing
                      ? (isBreedz ? "Following" : "Følger")
                      : (isBreedz ? "Follow" : "Følg")}
                  </button>
                </div>
                );
              })}
            </div>

            <div style={{ color: "var(--text-faint)", fontSize: 11, lineHeight: 2, fontFamily: "var(--font-sans)", padding: "0 4px" }}>
              {isBreedz ? "Privacy · Terms · Cookies" : "Personvern · Vilkår · Cookies"}<br />
              © 2026 {tenant.brandName}{isBreedz ? "" : " AS"}
            </div>
          </aside>

        </div>

        {/* ── MOBILE BOTTOM NAV ── */}
        {isMobile && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
            background: "var(--bg-elevated)", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "space-around", alignItems: "center",
            height: 56, padding: "0 8px",
          }}>
            {MOBILE_NAV.map(item => {
              const ItemIcon = item.Icon;
              const active = activePage === item.key;
              return (
              <button key={item.key}
                onClick={() => { setActivePage(item.key); setThreadPost(null); setViewProfile(null); setHashtagView(null); setActiveConversation(null); }}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: "8px 12px",
                  color: active ? "var(--accent)" : "var(--text-muted)",
                  position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ItemIcon size={22} strokeWidth={active ? 2.4 : 2} />
                {navBadges[item.key] > 0 && (
                  <span style={{ position: "absolute", top: 2, right: 4, background: "var(--accent)", color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>
                    {navBadges[item.key]}
                  </span>
                )}
              </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
