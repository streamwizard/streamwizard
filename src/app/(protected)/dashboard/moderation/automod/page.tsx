import AutoModSettingsForm from "./automod-settings-form";

export default function AutoModPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AutoMod</h1>
        <p className="text-muted-foreground">Manage your channel&apos;s AutoMod settings to automatically filter messages.</p>
      </div>
      <AutoModSettingsForm />
    </div>
  );
}
