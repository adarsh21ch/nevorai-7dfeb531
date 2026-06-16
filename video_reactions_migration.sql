-- Video Reactions: like / dislike per (video, user)
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.video_reactions (
  video_id uuid NOT NULL REFERENCES public.video_assets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_video_reactions_video ON public.video_reactions(video_id, reaction);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_reactions TO authenticated;
GRANT ALL ON public.video_reactions TO service_role;

ALTER TABLE public.video_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own reaction" ON public.video_reactions;
CREATE POLICY "users read own reaction" ON public.video_reactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users insert own reaction" ON public.video_reactions;
CREATE POLICY "users insert own reaction" ON public.video_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own reaction" ON public.video_reactions;
CREATE POLICY "users update own reaction" ON public.video_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own reaction" ON public.video_reactions;
CREATE POLICY "users delete own reaction" ON public.video_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Public counts via SECURITY DEFINER (anon can read aggregate totals only)
CREATE OR REPLACE FUNCTION public.get_video_reaction_counts(_video_id uuid)
RETURNS TABLE (likes bigint, dislikes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE reaction = 'like')    AS likes,
    COUNT(*) FILTER (WHERE reaction = 'dislike') AS dislikes
  FROM public.video_reactions
  WHERE video_id = _video_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_video_reaction_counts(uuid) TO anon, authenticated;

-- Toggle helper: returns new state ('like' | 'dislike' | null)
CREATE OR REPLACE FUNCTION public.set_video_reaction(_video_id uuid, _reaction text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing text;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  IF _reaction IS NOT NULL AND _reaction NOT IN ('like','dislike') THEN
    RAISE EXCEPTION 'invalid reaction';
  END IF;

  SELECT reaction INTO _existing FROM public.video_reactions
    WHERE video_id = _video_id AND user_id = _uid;

  IF _reaction IS NULL OR _existing = _reaction THEN
    -- toggle off
    DELETE FROM public.video_reactions WHERE video_id = _video_id AND user_id = _uid;
    RETURN NULL;
  END IF;

  INSERT INTO public.video_reactions (video_id, user_id, reaction)
  VALUES (_video_id, _uid, _reaction)
  ON CONFLICT (video_id, user_id)
  DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now();

  RETURN _reaction;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_video_reaction(uuid, text) TO authenticated;
