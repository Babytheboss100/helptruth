import { useState } from "react";
import { MessageCircle, Repeat2, Heart, Share } from "lucide-react";

/**
 * @param {{
 *   id: string,
 *   author: { name: string, handle: string, avatar?: string, avatarColor?: string, verified?: boolean },
 *   content: string,
 *   timestamp: string,
 *   stats: { replies: number, reposts: number, likes: number },
 *   liked?: boolean,
 *   onLike?: () => void,
 *   onReply?: () => void,
 *   onRepost?: () => void,
 *   onShare?: () => void,
 * }} props
 */
export default function PostCard({
  author,
  content,
  timestamp,
  stats,
  liked: likedProp = false,
  onLike,
  onReply,
  onRepost,
  onShare,
}) {
  const [liked, setLiked] = useState(likedProp);
  const [likeCount, setLikeCount] = useState(stats.likes);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
    if (onLike) onLike();
  };

  const avatarNode = author.avatar ? (
    <img
      src={author.avatar}
      alt={author.name}
      className="w-11 h-11 rounded-full border border-border object-cover"
    />
  ) : (
    <div
      className="w-11 h-11 rounded-full border border-border flex items-center justify-center text-white font-semibold"
      style={{ background: author.avatarColor || "var(--accent)" }}
    >
      {(author.name || "?").slice(0, 1).toUpperCase()}
    </div>
  );

  return (
    <article className="breedz-glass breedz-glow p-5 mb-4 hover:bg-white/[0.05] transition-colors cursor-pointer">
      <div className="flex gap-3">
        {avatarNode}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm flex-wrap">
            <span className="font-semibold text-text">{author.name}</span>
            {author.verified && (
              <span className="text-accent" title="Verified">✓</span>
            )}
            <span className="text-text-muted">@{author.handle}</span>
            <span className="text-text-faint">·</span>
            <span className="text-text-muted">{timestamp}</span>
          </div>
          <p className="text-text mt-1 whitespace-pre-wrap break-words">{content}</p>

          <div className="flex items-center justify-between mt-4 max-w-md text-text-muted">
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 hover:text-accent transition-colors text-sm"
              aria-label="Reply"
            >
              <MessageCircle size={16} />
              <span>{stats.replies}</span>
            </button>
            <button
              onClick={onRepost}
              className="flex items-center gap-1.5 hover:text-success transition-colors text-sm"
              aria-label="Repost"
            >
              <Repeat2 size={16} />
              <span>{stats.reposts}</span>
            </button>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors text-sm ${
                liked ? "text-danger" : "hover:text-danger"
              }`}
              aria-label={liked ? "Unlike" : "Like"}
              aria-pressed={liked}
            >
              <Heart size={16} fill={liked ? "currentColor" : "none"} />
              <span>{likeCount}</span>
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 hover:text-accent transition-colors text-sm"
              aria-label="Share"
            >
              <Share size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
