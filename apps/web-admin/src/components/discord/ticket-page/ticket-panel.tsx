import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { cn } from "@/lib/utils";

/**
 * One side panel of the ticket page (Details, Manage, Timeline). A card in the
 * desktop column. `flat` drops the box for the phone drawer, where a card
 * inside the sheet only costs width.
 */
export function TicketPanel({
  title,
  flat = false,
  contentClassName,
  children,
}: {
  title: string;
  flat?: boolean;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  if (flat) {
    return (
      <section className="space-y-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className={contentClassName}>{children}</div>
      </section>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className={cn(contentClassName)}>{children}</CardContent>
    </Card>
  );
}
