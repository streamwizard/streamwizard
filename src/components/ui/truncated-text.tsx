import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  message: string;
}

export default function TruncatedText({ message }: Props) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [isTextTruncated, setIsTextTruncated] = useState<boolean>(false);

  useEffect(() => {
    const element = messageRef.current;
    if (element) {
      const isHorizontalOverflowing: boolean = element.scrollWidth > element.clientWidth;

      if (isHorizontalOverflowing) {
        setIsTextTruncated(true);
      }
    }
  }, [messageRef]);

  return (
    <>
      <div ref={messageRef} className="overflow-hidden text-ellipsis">
        {isTextTruncated ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="block overflow-hidden text-ellipsis whitespace-nowrap">{message}</p>
              </TooltipTrigger>

              <TooltipContent sideOffset={4} className="bg-muted/50">
                <p className="w-96	 break-words">{message}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <p className="whitespace-nowrap ">{message}</p>
        )}
      </div>
    </>
  );
}
