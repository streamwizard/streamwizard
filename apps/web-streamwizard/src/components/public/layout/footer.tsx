"use client";

import Link from "next/link";
import Image from "next/image";
import { discordInviteLink, docsLink, githubLink, productLinks } from "@/lib/constant";
import { TrackedLink } from "../analytics/tracked-link";
import { Separator } from "@repo/ui";
import { FaDiscord, FaGithub } from "react-icons/fa";

const navigation = {
  // The public product pages, not /dashboard/*: those routes are behind auth,
  // a dead end for anyone (and any crawler) not already signed in.
  product: [
    { name: "Cloud OBS", href: productLinks.cloudObs, cta: "cloud_obs" },
    { name: "Overlays", href: productLinks.overlays, cta: "overlays" },
    { name: "Clips", href: productLinks.clips, cta: "clips" },
    { name: "VOD clipping", href: productLinks.vods, cta: "vods" },
    { name: "Analytics", href: productLinks.analytics, cta: "analytics" },
    { name: "Docs", href: docsLink, cta: "docs" },
  ],
  community: [
    { name: "Discord", href: discordInviteLink, cta: "discord" },
    { name: "GitHub", href: githubLink, cta: "github" },
  ],
  legal: [
    { name: "Terms of Service", href: "/terms-of-service" },
    { name: "Privacy Policy", href: "/privacy-policy" },
  ],
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white py-16">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-12">
          {/* Branding Section */}
          <div className="space-y-4 md:w-1/3">
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="StreamWizard Logo"
                width={40}
                height={40}
                className="rounded-xl"
                style={{ width: 40, height: 40 }}
              />
              <span className="text-xl font-medium ml-4">StreamWizard</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              Cloud OBS, overlays, clip management, and stream analytics for Twitch. One login, no
              install, and the code is on GitHub.
            </p>
            <p className="text-sm text-muted-foreground/60">Free and open source. Built by the community.</p>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-8 gap-x-8 md:w-1/2 md:justify-items-end">
            {/* Product Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm tracking-wider">PRODUCT</h3>
              <ul className="space-y-3">
                {navigation.product.map((item) => (
                  <li key={item.name}>
                    <TrackedLink
                      href={item.href}
                      cta={item.cta}
                      section="footer"
                      {...(item.href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      {item.name}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Community Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm tracking-wider">COMMUNITY</h3>
              <ul className="space-y-3">
                {navigation.community.map((item) => (
                  <li key={item.name}>
                    <TrackedLink
                      href={item.href}
                      cta={item.cta}
                      section="footer"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      {item.name}
                    </TrackedLink>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm tracking-wider">LEGAL</h3>
              <ul className="space-y-3">
                {navigation.legal.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <Separator className="my-8 bg-muted-foreground/20" />

        {/* Footer Bottom */}
        <div className="flex text-center flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <TrackedLink
              href={discordInviteLink}
              cta="discord_icon"
              section="footer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <FaDiscord className="h-6 w-6" />
              <span className="sr-only">Discord</span>
            </TrackedLink>
            <TrackedLink
              href={githubLink}
              cta="github_icon"
              section="footer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <FaGithub className="h-6 w-6" />
              <span className="sr-only">GitHub</span>
            </TrackedLink>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} StreamWizard. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
