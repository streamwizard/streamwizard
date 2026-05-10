import { cn } from "@/lib/utils";
import { TestimonialCard } from "../cards/testimonial-card";
import { Marquee } from "@repo/ui";
import { createClient } from "@/lib/supabase/server";

interface TestimonialsSectionProps {
  className?: string;
}

export async function TestimonialsSection({ className }: TestimonialsSectionProps) {
  const supabase = await createClient();

  const { data: testimonials, error } = await supabase.from("testimonials").select("*").eq("active", true);

  if (error) {
    console.error("Error fetching testimonials:", error);
    return null;
  }

  if (testimonials.length < 3) return null;

  return (
    <section className={cn("bg-background text-foreground", "py-6 px-0", className)}>
      <div className="mx-auto flex max-w-container flex-col items-center gap-4 text-center sm:gap-16">
        <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
          <div className="relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg  bg-background md:shadow-xl">
            <Marquee pauseOnHover reverse className="[--duration:20s]">
              {testimonials.map((review, _) => (
                <TestimonialCard
                  key={review.id}
                  author={{
                    name: review.username,
                    handle: review.username,
                    avatar: review.profile_img,
                  }}
                  text={review.content}
                  href={review.href}
                />
              ))}
            </Marquee>
          </div>
        </div>
      </div>
    </section>
  );
}
