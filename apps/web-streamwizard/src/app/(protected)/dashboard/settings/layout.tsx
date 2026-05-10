import SettingsNav from "@/components/nav/SettingsNav";

export default async function layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex space-x-4 ">
      <SettingsNav /> 
            
      {children}

    </div>
  );
}
