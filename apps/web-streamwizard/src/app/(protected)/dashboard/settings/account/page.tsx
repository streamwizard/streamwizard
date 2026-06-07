import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { RequestDataSection } from "@/components/settings/request-data-section";

export default function AccountSettingsPage() {
  return (
    <div className="w-full max-w-2xl space-y-6">
      <RequestDataSection />
      <DeleteAccountSection />
    </div>
  );
}
