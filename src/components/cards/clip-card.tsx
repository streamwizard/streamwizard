"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClipFolders } from "@/providers/clips-provider";
import { useModal } from "@/providers/modal-provider";
import { clipsWithFolders } from "@/types/database";
import { Calendar, Eye, MoreHorizontal, Star, User } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import TwitchClipModal from "../modals/twitch-clip-modal";
import { Button } from "../ui/button";

export default function TwitchClipCard({
  url,
  creator_name,
  title,
  view_count,
  created_at_twitch,
  thumbnail_url,
  duration,
  is_featured,
  embed_url,
  id,
  folders,
}: clipsWithFolders) {
  const { openModal } = useModal();
  const { getAvailableFolders, getRemovableFolders, AddToFolder, handleRemoveClipFromFolder } = useClipFolders();

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const OpenClip = () => {
    openModal(<TwitchClipModal url={embed_url!} />);
  };

  const CopyClipURL = () => {
    navigator.clipboard.writeText(url!);
    toast.success("Copied to clipboard");
  };

  function AvailableFolders() {
    const availableFolders = getAvailableFolders(folders.map((folder) => folder.id));

    if (availableFolders.length === 0) {
      return <DropdownMenuItem disabled>No folders available</DropdownMenuItem>;
    }

    return availableFolders.map((folder) => (
      <DropdownMenuItem key={folder.id} onClick={() => AddToFolder({ folderName: folder.name, folderId: folder.id, clipId: id! })}>
        {folder.name}
      </DropdownMenuItem>
    ));
  }

  function RemovableFolders() {
    const removableFolders = getRemovableFolders(folders.map((folder) => folder.id));

    if (removableFolders.length === 0) {
      return <DropdownMenuItem disabled>No folders available</DropdownMenuItem>;
    }

    return removableFolders.map((folder) => (
      <DropdownMenuItem key={folder.id} onClick={() => handleRemoveClipFromFolder(folder.id, id, folder.name)}>
        {folder.name}
      </DropdownMenuItem>
    ));
  }

  return (
    <Card className="w-full max-w-md overflow-hidden cursor-pointer">
      <CardHeader className="p-0">
        <div className="relative">
          <img src={thumbnail_url!} alt={title} className="w-full h-48 object-cover" onClick={OpenClip} />
          <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground">{formatDuration(duration!)}</Badge>
          {is_featured && (
            <Badge className="absolute bottom-2 left-2 bg-yellow-500 text-yellow-950">
              <Star className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <CardTitle className="text-lg mb-2 line-clamp-2">{title}</CardTitle>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-2">
          <User className="w-4 h-4" />
          <span>{creator_name}</span>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0 flex justify-between text-sm text-muted-foreground">
        <div className="flex items-center">
          <Eye className="w-4 h-4 mr-1" />
          {view_count!.toLocaleString()} views
        </div>
        <div className="flex flex-col justify-center">
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {formatDate(created_at_twitch!)}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 text-right">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Folders</DropdownMenuLabel>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Add to folder</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <AvailableFolders />
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Create new folder</DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Remove from folder</DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <RemovableFolders />
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Actions</DropdownMenuLabel>

              <Link href={url!} target="_blank">
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(url!)}>View</DropdownMenuItem>
              </Link>
              <DropdownMenuItem onClick={CopyClipURL}>Copy URL to clipboard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardFooter>
    </Card>
  );
}
