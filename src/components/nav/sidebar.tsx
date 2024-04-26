import Image from "next/image";
import React, { ReactNode } from "react";
import { Separator } from "../ui/separator";

interface Props {
  children: ReactNode;
}

export default function Sidebar({ children }: Props) {
  return (
    <aside className="hidden w-[250px] flex-shrink-0 select-none flex-col h-screen border-r border-border bg-border/10 md:flex">
      <div className="flex flex-row items-center gap-2 px-4 mt-4 justify-center">
        <Image
          src="/logo.png"
          width={100}
          height={100}
          alt="Logo"
          style={{
            maxWidth: "100%",
            height: "auto"
          }} />
      </div>
      <span className="my-4">
        <Separator />
      </span>
      {children}
    </aside>
  );
}
