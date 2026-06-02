import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_HOSTING_PROVIDER,
  LEGAL_OPERATOR,
} from "@/lib/legal";

type LegalNoticeProps = {
  variant: "normal" | "genz";
};

export function LegalNotice({ variant }: LegalNoticeProps) {
  if (variant === "genz") {
    return (
      <section className="mt-10 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-3">legal notice (the official corporate stuff) 📋</h2>
        <dl className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <div>
            <dt className="text-foreground font-medium inline">operator: </dt>
            <dd className="inline">{LEGAL_OPERATOR}</dd>
          </div>
          <div>
            <dt className="text-foreground font-medium inline">email: </dt>
            <dd className="inline">
              <a
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
              >
                {LEGAL_CONTACT_EMAIL}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-foreground font-medium inline">hosting: </dt>
            <dd className="inline">{LEGAL_HOSTING_PROVIDER}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground mt-4">
          EU law says we gotta put this here. Netherlands-based operator, German servers. all legit.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-10 pt-8 border-t border-border">
      <h2 className="text-lg font-semibold mb-3">Legal Notice</h2>
      <dl className="space-y-2 text-sm text-muted-foreground leading-relaxed">
        <div>
          <dt className="text-foreground font-medium">Operator</dt>
          <dd>{LEGAL_OPERATOR}</dd>
        </div>
        <div>
          <dt className="text-foreground font-medium">Contact</dt>
          <dd>
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="text-foreground underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-foreground font-medium">Hosting provider</dt>
          <dd>{LEGAL_HOSTING_PROVIDER}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground mt-4">
        This notice is provided in accordance with EU electronic commerce transparency requirements.
        StreamWizard is operated from the Netherlands and hosted in Germany.
      </p>
    </section>
  );
}
