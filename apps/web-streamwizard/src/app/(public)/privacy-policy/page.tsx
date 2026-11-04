import { PrivacyPolicyContent } from "@/components/legal/privacy-policy-content";
import { absoluteUrl } from "@/lib/seo";
import { Metadata } from "next";

export const metadata: Metadata = {
  // Suffix comes from the root layout's title template.
  title: "Privacy Policy",
  description:
    "How StreamWizard collects, uses, and protects your personal data.",
  alternates: { canonical: absoluteUrl("/privacy-policy") },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <PrivacyPolicyContent />
      </div>
    </div>
  );
}
