import { cn } from "@/lib/utils";
import { TestimonialCard } from "../cards/testimonial-card";
import { Marquee } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import { getActiveTestimonials } from "@repo/supabase/queries/public";

interface TestimonialsSectionProps {
  className?: string;
}

export async function TestimonialsSection({ className }: TestimonialsSectionProps) {
  const supabase = await createClient();

  const { data: testimonials, error } = await getActiveTestimonials(supabase);

  if (error) {
    console.error("Error fetching testimonials:", error);
    return null;
  }

  if (testimonials.length < 3) return null;

  return (
    <section className={cn("py-20 overflow-hidden", className)}>
      {/* Section header */}
      <div className="container px-4 mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300 mb-4">
          Loved by streamers
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-3">Don&apos;t take our word for it.</h2>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm sm:text-base">
          Streamers use StreamWizard every week to find their best clips and moments.
        </p>
      </div>

      {/* Two-row marquee with left/right edge fade */}
      <div className="relative [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex flex-col gap-4">
          <Marquee pauseOnHover className="[--duration:30s]">
            {testimonials.map((review) => (
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
          <Marquee pauseOnHover reverse className="[--duration:25s]">
            {testimonials.map((review) => (
              <TestimonialCard
                key={`rev-${review.id}`}
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
    </section>
  );
}
