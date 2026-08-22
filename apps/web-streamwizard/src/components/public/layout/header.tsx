"use client";
import { Button, Sheet, SheetContent, SheetTrigger, SheetTitle, Separator } from "@repo/ui";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { login } from "@/actions/auth/login";
import { captureEvent } from "@repo/posthog";
import { discordInviteLink, docsLink, githubLink, productLinks } from "@/lib/constant";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { BookOpen, Menu } from "lucide-react";
import { TrackedLink } from "../analytics/tracked-link";

const productNav = [
  { name: "Cloud OBS", href: productLinks.cloudObs, cta: "cloud_obs" },
  { name: "Overlays", href: productLinks.overlays, cta: "overlays" },
  { name: "Clips", href: productLinks.clips, cta: "clips" },
  { name: "VOD clipping", href: productLinks.vods, cta: "vods" },
  { name: "Analytics", href: productLinks.analytics, cta: "analytics" },
];

export default function Header() {
  const handleLogin = (source: string) => {
    // Fire before the server action: login() ends in a redirect to Twitch.
    captureEvent("login_clicked", { source });
    login();
  };

  return (
    <header className="shadow sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <Image alt="StreamWizard" src="/logo.png" width={40} height={40} style={{ width: 40, height: 40 }} />
            <span>StreamWizard</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-4">
            <TrackedLink href={docsLink} cta="docs" section="header" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
              <BookOpen className="h-4 w-4" />
              Docs
            </TrackedLink>
            <TrackedLink href={githubLink} cta="github" section="header" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
              <FaGithub className="h-4 w-4" />
              GitHub
            </TrackedLink>
            <TrackedLink href={discordInviteLink} cta="discord" section="header" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
              <FaDiscord className="h-4 w-4" />
              Discord
            </TrackedLink>
            <Button className="bg-secondary text-white hover:bg-slate-700" onClick={() => handleLogin("header")}>Log in</Button>
          </nav>

          {/* Mobile nav */}
          <div className="flex md:hidden items-center gap-2">
            <Button className="bg-secondary text-white hover:bg-slate-700 text-sm" onClick={() => handleLogin("header_mobile")}>Log in</Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <nav className="flex flex-col gap-2 px-4 pt-2">
                  {productNav.map((item) => (
                    <TrackedLink
                      key={item.href}
                      href={item.href}
                      cta={item.cta}
                      section="header_menu"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm py-1"
                    >
                      {item.name}
                    </TrackedLink>
                  ))}
                  <Separator className="my-2" />
                  <TrackedLink
                    href={docsLink}
                    cta="docs"
                    section="header_menu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm py-1"
                  >
                    <BookOpen className="h-4 w-4" />
                    Docs
                  </TrackedLink>
                </nav>

                <div className="mt-auto px-4 pb-4">
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-4">
                    <TrackedLink href={githubLink} cta="github" section="header_menu" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <FaGithub className="h-5 w-5" />
                      <span className="sr-only">GitHub</span>
                    </TrackedLink>
                    <TrackedLink href={discordInviteLink} cta="discord" section="header_menu" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <FaDiscord className="h-5 w-5" />
                      <span className="sr-only">Discord</span>
                    </TrackedLink>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      <Separator />
    </header>
  );
}
