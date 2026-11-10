import { Card, CardContent } from "@repo/ui/components/ui/card";
import { VmsPageHeader } from "@/components/vms/vms-page-header";

export function VmsMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <VmsPageHeader />
      <Card>
        <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
}
