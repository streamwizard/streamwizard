import { ScrollToTop } from "@/components/layout/scroll-to-top";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ScrollToTop />
    </>
  );
}
