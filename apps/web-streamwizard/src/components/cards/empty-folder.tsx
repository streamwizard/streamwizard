import { FolderX } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"

interface EmptyFolderProps {
  folderName: string
}

export function EmptyFolder({ folderName }: EmptyFolderProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="flex flex-col items-center justify-center p-6 text-center">
        <FolderX className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">{folderName}</h2>
        <p className="text-muted-foreground">This folder is empty</p>
      </CardContent>
    </Card>
  )
}

