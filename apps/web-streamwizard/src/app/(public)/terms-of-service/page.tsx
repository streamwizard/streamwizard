import { TermsOfServiceContent } from "@/components/legal/terms-of-service-content";
import { absoluteUrl } from "@/lib/seo/seo";
import { Metadata } from "next";

export const metadata: Metadata = {
  // Suffix comes from the root layout's title template.
  title: "Terms of Service",
  description: "The terms and conditions governing your use of StreamWizard.",
  alternates: { canonical: absoluteUrl("/terms-of-service") },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <TermsOfServiceContent />
      </div>
    </div>
  );
}
