"use client";

import Link from "next/link";
import Image from "next/image";
import { discordInviteLink } from "@/lib/constant";
import { Separator } from "@/components/ui/separator";
import { FaDiscord } from "react-icons/fa";

const navigation = {
  product: [
    { name: "Clip Management", href: "/dashboard/clips" }
  ],
  community: [
    { name: "Discord", href: discordInviteLink }
  ],
  legal: [
    { name: "Terms", href: "#" },
    { name: "Privacy", href: "#" }
  ]
};

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-black text-white py-16">
      <div className="container px-4 mx-auto">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-12">
          {/* Branding Section */}
          <div className="space-y-4 md:w-1/3">
            <div className="flex items-center ">
              <Image 
                src="/logo.png" 
                alt="StreamWizard Logo" 
                width={40} 
                height={40} 
                className="rounded-xl"
              />
              <span className="text-xl font-medium ml-4">StreamWizard</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              StreamWizard helps you organize your Twitch clips effortlessly. 
              Search by category, creator, title, date range, and more. Create 
              custom folders to keep your clips perfectly organized.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-3 3 gap-8 md:w-1/2 md:justify-items-end">
            {/* Product Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm tracking-wider">PRODUCT</h3>
              <ul className="space-y-3">
                {navigation.product.map((item) => (
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

            {/* Community Links */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm tracking-wider">COMMUNITY</h3>
              <ul className="space-y-3">
                {navigation.community.map((item) => (
                  <li key={item.name}>
                    <Link 
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-white transition-colors"
                    >
                      {item.name}
                    </Link>
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
        <div className="flex  text-center flex-row justify-between items-center gap-4">
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
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} StreamWizard. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}