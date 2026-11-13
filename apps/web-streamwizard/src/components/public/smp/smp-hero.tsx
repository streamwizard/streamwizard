import Image from "next/image";
import { SectionView } from "@/components/public/analytics/section-view";
import { TrackedLink } from "@/components/shared/tracked-link";

/*
 * The top of /smp, laid out like the modpack's title screen: the night scene
 * behind, the pixel logo on top, the primary "join" button under it.
 *
 * Both images are the menu's own art at its native size (480x270 and 350x116),
 * scaled up by whole numbers in CSS and served as they are: the image
 * optimizer would resample them. The logo is a picture of the wordmark; the
 * page's <h1> is real text.
 */
export function SmpHero() {
  return (
    <section className="smp-scene flex items-center">
      <Image
        src="/img/smp/background.png"
        alt=""
        width={480}
        height={270}
        unoptimized
        preload
        className="smp-scene-art"
      />
      <SectionView section="hero" className="container mx-auto px-4 py-14 md:py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Image
            src="/img/smp/logo.png"
            alt="StreamWizard"
            width={350}
            height={116}
            unoptimized
            className="pixel-art h-[116px] w-[350px] max-w-none min-[791px]:h-[232px] min-[791px]:w-[700px]"
          />
          <h1 className="pixel-shadow mt-6 font-pixel text-3xl leading-tight font-semibold text-white sm:text-4xl md:text-5xl">
            The Minecraft SMP <br className="hidden sm:block" /> your viewers can mess with.
          </h1>
          {/* A flat dark backing, so the two lines read over the tower's lit windows too. */}
          <div className="mt-5 max-w-2xl bg-(--smp-night)/75 px-4 py-3">
            <p className="text-lg text-white">
              A survival server for Twitch streamers on Minecraft Java 26.3. Viewers use Twitch redeems to drop
              jumpscares, disasters and loot crates on you while you play.
            </p>
            <p className="mt-3 font-pixel text-base text-(--smp-gold)">
              Applications are open. The launch date will be announced.
            </p>
          </div>
          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <TrackedLink href="#join" cta="join_waitlist" section="hero" className="pixel-btn pixel-btn-primary">
              Join the waitlist
            </TrackedLink>
            <TrackedLink href="#viewers" cta="see_redeems" section="hero" className="pixel-btn">
              See what viewers can do
            </TrackedLink>
          </div>
        </div>
      </SectionView>
    </section>
  );
}
