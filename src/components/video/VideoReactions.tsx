import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { formatViewCount } from "@/lib/format";

type Reaction = "like" | "dislike" | null;

interface Props {
  videoId: string;
}

export const VideoReactions = ({ videoId }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0); // tracked but not shown
  const [mine, setMine] = useState<Reaction>(null);
  const [busy, setBusy] = useState(false);

  const loadCounts = useCallback(async () => {
    const { data } = await (supabase as any).rpc("get_video_reaction_counts", {
      _video_id: videoId,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      setLikes(Number(row.likes) || 0);
      setDislikes(Number(row.dislikes) || 0);
    }
  }, [videoId]);

  const loadMine = useCallback(async () => {
    if (!user) {
      setMine(null);
      return;
    }
    const { data } = await (supabase as any)
      .from("video_reactions")
      .select("reaction")
      .eq("video_id", videoId)
      .eq("user_id", user.id)
      .maybeSingle();
    setMine((data?.reaction as Reaction) ?? null);
  }, [videoId, user]);

  useEffect(() => {
    loadCounts();
    loadMine();
  }, [loadCounts, loadMine]);

  const promptSignIn = (verb: string) => {
    const here =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    toast(`Sign in to ${verb} videos`, {
      action: {
        label: "Sign in",
        onClick: () => navigate(`/auth?redirect=${encodeURIComponent(here)}`),
      },
    });
  };

  const react = async (next: "like" | "dislike") => {
    if (!user) {
      promptSignIn(next);
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = mine;
    const prevLikes = likes;
    const prevDislikes = dislikes;

    // optimistic
    const turnsOff = prev === next;
    const newMine: Reaction = turnsOff ? null : next;
    setMine(newMine);
    setLikes(
      prevLikes +
        (newMine === "like" ? 1 : 0) -
        (prev === "like" ? 1 : 0),
    );
    setDislikes(
      prevDislikes +
        (newMine === "dislike" ? 1 : 0) -
        (prev === "dislike" ? 1 : 0),
    );

    const { error } = await (supabase as any).rpc("set_video_reaction", {
      _video_id: videoId,
      _reaction: turnsOff ? null : next,
    });
    if (error) {
      // rollback
      setMine(prev);
      setLikes(prevLikes);
      setDislikes(prevDislikes);
      toast.error("Could not save. Try again.");
    } else {
      // re-sync counts (in case of races)
      loadCounts();
    }
    setBusy(false);
  };

  const liked = mine === "like";
  const disliked = mine === "dislike";

  return (
    <div className="inline-flex items-center rounded-full bg-muted/60 hover:bg-muted transition-colors overflow-hidden border border-border/50">
      <button
        type="button"
        onClick={() => react("like")}
        disabled={busy}
        aria-pressed={liked}
        aria-label="Like"
        className="flex items-center gap-2 pl-4 pr-3 h-9 text-sm font-medium hover:bg-foreground/5 transition-colors disabled:opacity-60"
      >
        <ThumbsUp
          size={16}
          className={liked ? "fill-current" : ""}
          strokeWidth={liked ? 2.25 : 2}
        />
        <span className="tabular-nums">{formatViewCount(likes)}</span>
      </button>
      <div className="w-px h-5 bg-border" />
      <button
        type="button"
        onClick={() => react("dislike")}
        disabled={busy}
        aria-pressed={disliked}
        aria-label="Dislike"
        className="flex items-center gap-2 px-4 h-9 text-sm font-medium hover:bg-foreground/5 transition-colors disabled:opacity-60"
      >
        <ThumbsDown
          size={16}
          className={disliked ? "fill-current" : ""}
          strokeWidth={disliked ? 2.25 : 2}
        />
      </button>
    </div>
  );
};
