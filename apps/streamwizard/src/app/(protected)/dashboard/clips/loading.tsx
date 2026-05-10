import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-4 gap-4 mb-4">
      {Array.from({ length: 20 }).map((_, index) => (
        <Card className="w-full max-w-md overflow-hidden" key={index}>
          <CardHeader className="p-0">
            <div className="relative">
              <Skeleton className="w-full h-48" />
              <Skeleton className="absolute top-2 left-2 h-5 w-16" />
              <Skeleton className="absolute bottom-2 left-2 h-5 w-20" />
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <Skeleton className="h-6 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-2" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
          <CardFooter className="p-4 pt-0 flex justify-between">
            <div className="flex items-center space-x-1">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex flex-col items-end space-y-2">
              <div className="flex items-center space-x-1">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
