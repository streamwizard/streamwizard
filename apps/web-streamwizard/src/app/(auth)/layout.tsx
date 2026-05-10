import React from "react";

export interface LayoutProps {
  children: React.ReactNode;
}

export default async function layout({ children }: LayoutProps) {
  return <div>{children}</div>;
}
