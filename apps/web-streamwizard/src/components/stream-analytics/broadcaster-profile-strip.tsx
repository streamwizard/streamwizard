import { Avatar, AvatarFallback, AvatarImage, Badge } from "@repo/ui";
import type { BroadcasterProfile } from "@/actions/supabase/analytics/stream-analytics";

const BADGE_STYLES: Record<string, string> = {
  partner: "bg-purple-600 text-white hover:bg-purple-600",
  affiliate: "bg-indigo-500 text-white hover:bg-indigo-500",
};

interface BroadcasterProfileStripProps {
  profile: BroadcasterProfile;
}

export function BroadcasterProfileStrip({ profile }: BroadcasterProfileStripProps) {
  const badgeStyle = profile.broadcasterType ? BADGE_STYLES[profile.broadcasterType] : null;

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={profile.profileImageUrl ?? undefined} alt={profile.username} />
        <AvatarFallback>{profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold">{profile.username}</span>
        {badgeStyle && (
          <Badge className={badgeStyle}>
            {profile.broadcasterType === "partner" ? "Partner" : "Affiliate"}
          </Badge>
        )}
      </div>
    </div>
  );
}
