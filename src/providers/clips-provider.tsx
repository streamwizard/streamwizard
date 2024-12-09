"use client";
import { addClipToFolder, removeClipFromFolder } from "@/actions/supabase/clips/clips";
import { Database } from "@/types/supabase";
import React, { createContext, use, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { useSession } from "./session-provider";

type AddToFolderType = {
  folderName: string;
  folderId: number;
  clipId: number;
};

interface FolderContextType {
  folders: Database["public"]["Tables"]["clip_folders"]["Row"][];
  getAvailableFolders: (folderId: number[]) => Database["public"]["Tables"]["clip_folders"]["Row"][];
  getRemovableFolders: (folderId: number[]) => Database["public"]["Tables"]["clip_folders"]["Row"][];
  handleRemoveClipFromFolder: (folderId: number, clipId: number, folderName: string) => void;
  AddToFolder: ({ folderName, folderId, clipId }: AddToFolderType) => void;
}

const FolderContext = createContext<FolderContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
  ClipFolders: Database["public"]["Tables"]["clip_folders"]["Row"][];
}

export function ClipFolderProvider({ children, ClipFolders }: Props) {
  const [folders, setFolders] = useState<Database["public"]["Tables"]["clip_folders"]["Row"][]>(ClipFolders);
  const { id: userId } = useSession();

  // Get folders excluding the specified folder ID
  const getAvailableFolders = (excludedFolderIds: number[]) => {
    return folders.filter((folder) => !excludedFolderIds.includes(folder.id));
  };

  // Get clips eligible for removal excluding specified folder IDs
  const getRemovableFolders = (excludedFolderIds: number[]) => {
    return ClipFolders.filter((folder) => excludedFolderIds.includes(folder.id));
  };

  // Add a clip to a folder
  const AddToFolder = ({ folderName, folderId, clipId }: AddToFolderType) => {
    toast.promise(
      async () => {
        console.log({ folderId, folderName });
        const res = await addClipToFolder({ clipId, userId, folderId, folderName });
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: "Adding to favorites",
        success: "Added to favorites",
        error: "Failed to add to favorites",
      }
    );
  };

  const handleRemoveClipFromFolder = (folderId: number, clipId: number, folderName: string) => {
    toast.promise(
      async () => {
        const res = await removeClipFromFolder(clipId, folderId, userId);
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: `Removing from ${folderName}`,
        success: `Removed from ${folderName}`,
        error: `Failed to remove from ${folderName}`,
      }
    );
  };

  useEffect(() => {
    setFolders(ClipFolders);
  }, [ClipFolders]);

  return (
    <FolderContext.Provider value={{ folders, getAvailableFolders, getRemovableFolders, AddToFolder, handleRemoveClipFromFolder }}>
      {children}
    </FolderContext.Provider>
  );
}

export function useClipFolders() {
  const context = useContext(FolderContext);
  if (context === undefined) {
    throw new Error("useClipFolders must be used within a ClipFolderProvider");
  }
  return context;
}
