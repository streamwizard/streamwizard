import SettingsNav from "@/components/nav/settings-nav";

export default async function layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row gap-4 md:items-start">
      <SettingsNav /> 
            
      {children}

    </div>
  );
}
