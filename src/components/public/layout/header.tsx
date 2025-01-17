import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import Link from "next/link";
import React from "react";

export default function Header() {
  return (
    <header className="shadow sticky top-0 z-50 backdrop-blur-xl">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold flex items-center gap-2" >
            <Image alt="StreamWizard" src="/logo.png" width={40} height={40} /> <span>StreamWizard</span>
          </Link>
          <div>
            <Button className="bg-secondary text-white hover:bg-slate-700">Log in</Button>
          </div>
        </div>
      </div>
      <Separator />
    </header>
  );
}
