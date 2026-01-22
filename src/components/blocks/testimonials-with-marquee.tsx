import { cn } from "@/lib/utils";
import { TestimonialAuthor, TestimonialCard } from "../cards/testimonial-card";
import { Marquee } from "../ui/marquee";

interface TestimonialsSectionProps {
  title: string;
  description: string;
  testimonials: Array<{
    author: TestimonialAuthor;
    text: string;
    href?: string;
  }>;
  className?: string;
}

export function TestimonialsSection({ title, description, testimonials, className }: TestimonialsSectionProps) {
  return (
    <section className={cn("bg-background text-foreground", "py-12 sm:py-24 md:py-32 px-0", className)}>
      <div className="mx-auto flex max-w-container flex-col items-center gap-4 text-center sm:gap-16">
        <div className="flex flex-col items-center gap-4 px-4 sm:gap-8">
          <h2 className="max-w-[720px] text-3xl font-semibold leading-tight sm:text-5xl sm:leading-tight">{title}</h2>
          <p className="text-md max-w-[600px] font-medium text-muted-foreground sm:text-xl">{description}</p>
        </div>

        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg  bg-background md:shadow-xl">
            <Marquee pauseOnHover reverse className="[--duration:20s]">
              {testimonials.map((review, _) => (
                <TestimonialCard key={_} {...review} />
              ))}
            </Marquee>
          </div>
        </div>
      </div>
    </section>
  );
}
