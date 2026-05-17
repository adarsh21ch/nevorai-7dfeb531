import { VideoPlayer } from "@/components/VideoPlayer";

interface PostSubmitVideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  allowSeek?: boolean;
  allowSpeed?: boolean;
}

export const PostSubmitVideoPlayer = ({
  videoUrl,
  thumbnailUrl,
  allowSeek = true,
  allowSpeed = true,
}: PostSubmitVideoPlayerProps) => {
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
      <VideoPlayer
        src={videoUrl}
        poster={thumbnailUrl || undefined}
        allowSeek={allowSeek}
        allowPlaybackSpeed={allowSpeed}
        autoplay
      />
    </div>
  );
};
