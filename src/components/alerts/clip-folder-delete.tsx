import { deleteClipFolder } from "@/actions/supabase/clips/clips";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Props {
  folderId: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  userId: string;
}

export default function ClipFolderDelete({ folderId, open, setOpen, userId }: Props) {
  const HandleFolderDelete = (folderId: number) => {
    toast.promise(
      async () => {
        const res = await deleteClipFolder(folderId, userId);
        if (!res.success) {
          throw new Error(res.message);
        }
        return res.message;
      },
      {
        loading: "Deleting folder...",
        success: "Folder deleted successfully!",
        error: "Failed to delete folder.",
      }
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your clip folder, the clips will remain in your account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => HandleFolderDelete(folderId)}>Delete Folder</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
