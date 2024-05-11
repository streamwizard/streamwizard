import { getUser } from "@/actions/twitch/twitch-api";
import { TwitchUser } from "@/types/API/twitch";
import { CalendarDays } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Skeleton } from "../ui/skeleton";

interface props {
  broadcaster_id: string;
}

export default function TwitchCard({ broadcaster_id }: props) {
  const [channel, setChannel] = useState<TwitchUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChannel = async () => {
      const data = await getUser({ id: broadcaster_id });

      if (!data) {
        return;
      }

      setChannel(data[0]);
      setLoading(false);
    };

    fetchChannel();
  }, []);

  return (
    <div className="flex justify-between space-x-4">
      {loading ? (
        <>
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="w-56 h-20" />
          </div>
        </>
      ) : (
        <>
          <Avatar>
            <AvatarImage src={channel?.profile_image_url} />
            <AvatarFallback>SW</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{channel?.display_name}</h4>
            <p className="text-sm ">{channel?.broadcaster_type}</p>
            <p className="text-sm ">{channel?.description}</p>
            <div className="flex items-center pt-2">
              <CalendarDays className="mr-2 h-4 w-4 opacity-70" /> <span className="text-xs text-muted-foreground">{channel?.created_at}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
