import { Heart, MessageCircle, Share2, ThumbsUp, Repeat2, Send } from "lucide-react";
import { Platform } from "@/lib/types";

function MediaBox({ mediaUrl, aspect }: { mediaUrl?: string; aspect: string }) {
  if (mediaUrl) {
    return (
      <div className={`${aspect} overflow-hidden bg-gray-100`}>
        <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return null;
}

export default function PlatformPreview({
  platform,
  content,
  hashtags,
  mediaUrl,
}: {
  platform: Platform;
  content: string;
  hashtags: string[];
  mediaUrl?: string;
}) {
  const hashtagLine = hashtags.length > 0 ? hashtags.join(" ") : "";

  if (platform === "INSTAGRAM") {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400" />
          <span className="text-sm font-semibold">brandname</span>
        </div>
        {mediaUrl ? (
          <MediaBox mediaUrl={mediaUrl} aspect="aspect-square" />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-gray-100 text-gray-300">
            <span className="text-xs">Media preview</span>
          </div>
        )}
        <div className="space-y-1 px-3 py-3">
          <div className="flex gap-4 text-gray-700">
            <Heart size={20} />
            <MessageCircle size={20} />
            <Share2 size={20} />
          </div>
          <p className="text-sm font-semibold">124 likes</p>
          <p className="whitespace-pre-wrap text-sm">
            <span className="font-semibold">brandname </span>
            {content}
          </p>
          {hashtagLine && <p className="text-sm text-blue-700">{hashtagLine}</p>}
        </div>
      </div>
    );
  }

  if (platform === "LINKEDIN") {
    return (
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-10 w-10 rounded-full bg-gray-300" />
          <div>
            <p className="text-sm font-semibold">Brand Name</p>
            <p className="text-xs text-gray-500">1,204 followers · 2h</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="whitespace-pre-wrap text-sm">{content}</p>
          {hashtagLine && <p className="mt-1 text-sm text-blue-700">{hashtagLine}</p>}
        </div>
        {mediaUrl ? (
          <MediaBox mediaUrl={mediaUrl} aspect="aspect-video" />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-gray-100 text-gray-300">
            <span className="text-xs">Media preview</span>
          </div>
        )}
        <div className="flex justify-around border-t border-gray-100 px-2 py-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <ThumbsUp size={16} /> Like
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={16} /> Comment
          </span>
          <span className="flex items-center gap-1">
            <Repeat2 size={16} /> Repost
          </span>
          <span className="flex items-center gap-1">
            <Send size={16} /> Send
          </span>
        </div>
      </div>
    );
  }

  // FACEBOOK
  return (
    <div className="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-blue-500" />
        <div>
          <p className="text-sm font-semibold">Brand Name</p>
          <p className="text-xs text-gray-500">2h · 🌐</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        <p className="whitespace-pre-wrap text-sm">{content}</p>
        {hashtagLine && <p className="mt-1 text-sm text-blue-700">{hashtagLine}</p>}
      </div>
      {mediaUrl ? (
        <MediaBox mediaUrl={mediaUrl} aspect="aspect-video" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-gray-100 text-gray-300">
          <span className="text-xs">Media preview</span>
        </div>
      )}
      <div className="flex justify-around border-t border-gray-100 px-2 py-2 text-xs font-medium text-gray-500">
        <span className="flex items-center gap-1">
          <ThumbsUp size={16} /> Like
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle size={16} /> Comment
        </span>
        <span className="flex items-center gap-1">
          <Share2 size={16} /> Share
        </span>
      </div>
    </div>
  );
}
