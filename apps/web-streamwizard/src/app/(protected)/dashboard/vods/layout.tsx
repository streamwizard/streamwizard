import { ScrollToTop } from "@/components/buttons/scroll-to-top";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ScrollToTop />
    </>
  );
}
