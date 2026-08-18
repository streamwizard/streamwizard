"use client";
import { Button, Sheet, SheetContent, SheetTrigger, SheetTitle, Separator } from "@repo/ui";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { login } from "@/actions/auth/login";
import { discordInviteLink, docsLink, githubLink } from "@/lib/constant";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { BookOpen, Menu } from "lucide-react";

/* The marketing pages, in reading order of the signal path. */
const PAGES = [
  { name: "Cloud OBS", href: "/cloud-obs" },
  { name: "Overlays", href: "/overlays" },
  { name: "Clips", href: "/clips" },
  { name: "Pricing", href: "/cloud-obs#pricing" },
  { name: "Roadmap", href: "/roadmap" },
];

export default function Header() {
  return (
    <header className="shadow sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2">
            <Image alt="StreamWizard" src="/logo.png" width={40} height={40} style={{ width: 40, height: 40 }} />
            <span>StreamWizard</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-5">
            {PAGES.map((page) => (
              <Link key={page.href} href={page.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm">
                {page.name}
              </Link>
            ))}
            <Separator orientation="vertical" className="h-5" />
            <Link href={docsLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-sm">
              <BookOpen className="h-4 w-4" />
              Docs
            </Link>
            <Link href={githubLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="GitHub">
              <FaGithub className="h-4 w-4" />
            </Link>
            <Link href={discordInviteLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Discord">
              <FaDiscord className="h-4 w-4" />
            </Link>
            <Button className="bg-secondary text-white hover:bg-slate-700" onClick={() => login()}>Log in</Button>
          </nav>

          {/* Mobile nav */}
          <div className="flex lg:hidden items-center gap-2">
            <Button className="bg-secondary text-white hover:bg-slate-700 text-sm" onClick={() => login()}>Log in</Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <nav className="flex flex-col gap-2 px-4 pt-2">
                  {PAGES.map((page) => (
                    <Link key={page.href} href={page.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm py-1">
                      {page.name}
                    </Link>
                  ))}
                  <Separator className="my-2" />
                  <Link
                    href={docsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm py-1"
                  >
                    <BookOpen className="h-4 w-4" />
                    Docs
                  </Link>
                </nav>

                <div className="mt-auto px-4 pb-4">
                  <Separator className="mb-4" />
                  <div className="flex items-center gap-4">
                    <Link href={githubLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <FaGithub className="h-5 w-5" />
                      <span className="sr-only">GitHub</span>
                    </Link>
                    <Link href={discordInviteLink} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                      <FaDiscord className="h-5 w-5" />
                      <span className="sr-only">Discord</span>
                    </Link>
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
