"use client";

import Link from "next/link";
import Image from "next/image";
import { discordInviteLink, docsClipsLink, docsLink, githubLink } from "@/lib/constant";
import { Separator } from "@repo/ui";
import { FaDiscord, FaGithub } from "react-icons/fa";

type FooterLink = { name: string; href: string; external?: boolean };

const navigation: Record<string, FooterLink[]> = {
  product: [
    { name: "Cloud OBS", href: "/cloud-obs" },
    { name: "Overlays & Widgets", href: "/overlays" },
    { name: "Clips & VODs", href: "/clips" },
    { name: "Pricing", href: "/cloud-obs#pricing" },
    { name: "Roadmap", href: "/roadmap" },
  ],
  resources: [
    { name: "Docs", href: docsLink, external: true },
    { name: "Clips guide", href: docsClipsLink, external: true },
    { name: "Widget API", href: `${docsLink}/widgets/overview`, external: true },
    { name: "Contribute", href: `${docsLink}/contributing/first-contribution`, external: true },
  ],
  community: [
    { name: "Discord", href: discordInviteLink, external: true },
    { name: "GitHub", href: githubLink, external: true },
  ],
  legal: [
    { name: "Terms of Service", href: "/terms-of-service" },
    { name: "Privacy Policy", href: "/privacy-policy" },
  ],
};

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-sm tracking-wider">{title}</h3>
      <ul className="space-y-3">
        {links.map((item) => (
          <li key={item.name}>
            <Link
              href={item.href}
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="text-muted-foreground hover:text-white transition-colors"
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white py-16">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-12">
          {/* Branding Section */}
          <div className="space-y-4 lg:w-1/3">
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
              Clips, overlays, widgets and IRL streaming for Twitch creators. One toolkit instead of four
              subscriptions.
            </p>
            <p className="text-sm text-muted-foreground/60">Free and open source. Built by the community.</p>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-2 gap-y-8 gap-x-8 sm:grid-cols-4 lg:w-3/5">
            <FooterColumn title="PRODUCT" links={navigation.product} />
            <FooterColumn title="RESOURCES" links={navigation.resources} />
            <FooterColumn title="COMMUNITY" links={navigation.community} />
            <FooterColumn title="LEGAL" links={navigation.legal} />
          </div>
        </div>

        <Separator className="my-8 bg-muted-foreground/20" />

        {/* Footer Bottom */}
        <div className="flex text-center flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Link
              href={discordInviteLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <FaDiscord className="h-6 w-6" />
              <span className="sr-only">Discord</span>
            </Link>
            <Link
              href={githubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-white transition-colors"
            >
              <FaGithub className="h-6 w-6" />
              <span className="sr-only">GitHub</span>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} StreamWizard. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
