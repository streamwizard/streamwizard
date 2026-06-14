import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

export interface TestimonialAuthor {
  name: string;
  handle: string;
  avatar: string;
}

export interface TestimonialCardProps {
  author: TestimonialAuthor;
  text: string;
  href?: string;
  className?: string;
}

export function TestimonialCard({ author, text, href, className }: TestimonialCardProps) {
  const Card = href ? "a" : "div";

  return (
    <Card
      {...(href ? { href, target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "group flex flex-col gap-4 rounded-2xl p-5 sm:p-6",
        "w-[300px] sm:w-[320px]",
        // Modern Dark Cinema: glass surface + hairline border
        "bg-white/[0.04] backdrop-blur-sm",
        "border border-white/[0.08]",
        // Social Proof: left accent border as blockquote signal
        "border-l-[3px] border-l-purple-500/60",
        // Hover: subtle lift, 200ms per UX guidelines
        "transition-all duration-200",
        "hover:bg-white/[0.07] hover:border-l-purple-400 hover:shadow-[0_4px_24px_-4px_rgba(168,85,247,0.12)]",
        href && "cursor-pointer",
        className,
      )}
    >
      {/* Star rating — universal social proof trust signal */}
      <div className="flex gap-0.5" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        ))}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground flex-1">{text}</p>

      <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
        <Avatar className="h-9 w-9 ring-2 ring-purple-500/20 ring-offset-1 ring-offset-background">
          <AvatarImage src={author.avatar} alt={author.name} />
          <AvatarFallback className="bg-purple-900/50 text-purple-300 text-xs font-semibold">
            {author.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground leading-none">{author.name}</span>
          <span className="text-xs text-muted-foreground">{author.handle}</span>
        </div>
      </div>
    </Card>
  );
}
