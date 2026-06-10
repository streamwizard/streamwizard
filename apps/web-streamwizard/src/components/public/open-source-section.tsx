import Link from "next/link";
import { Button } from "@repo/ui";
import { FaGithub } from "react-icons/fa";
import { githubLink } from "@/lib/constant";

export function OpenSourceSection() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-8 py-14 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-600 mb-6">
            <FaGithub className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Built in public. Contributions welcome.</h2>
          <p className="text-muted-foreground max-w-xl mx-auto mb-8">
            StreamWizard is open source — fork it, report bugs, or just lurk the repo.
          </p>
          <Button asChild variant="outline" size="lg" className="gap-2 border-purple-500/40 hover:bg-purple-500/10">
            <Link href={githubLink} target="_blank" rel="noopener noreferrer">
              <FaGithub className="h-5 w-5" />
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
