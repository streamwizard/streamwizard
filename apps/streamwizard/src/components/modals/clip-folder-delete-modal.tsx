"use client";

import React from "react";
import { Button } from "../ui/button";
import { useModal } from "@/providers/modal-provider";
import { toast } from "sonner";
import { deleteClipFolder } from "@/actions/supabase/clips/clips";

interface ClipFolderDeleteModalProps {
  folderId: number;
  folderName: string;
}

export default function ClipFolderDeleteModal({ folderId }: ClipFolderDeleteModalProps) {
  const { closeModal } = useModal();

  const handleDelete = () => {
    toast.promise(
      async () => {
        const res = await deleteClipFolder(folderId);
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: "Deleting folder...",
        success: "Folder deleted successfully",
        error: "Failed to delete folder",
      }
    );

    closeModal();
  };

  const handleCancel = () => {
    closeModal();
  };

  return (
    <div className="space-y-4 max-w-lg ">
      <p className="text-lg font-bold ">Are you sure you want to delete this folder?</p>
      <p className="text-sm text-muted-foreground">
        This action cannot be undone. The folder will be deleted, but all clips inside it will remain available outside of this folder.
      </p>

      <div className="flex space-x-2 justify-end">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
