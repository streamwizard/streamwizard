import ModalButton from "@/components/buttons/modal-button";
import { CommandForm } from "@/components/forms/command-form";
import { CommandColumns } from "@/components/tabels/commands/command-columns";
import { CommandTable } from "@/components/tabels/commands/command-table";

export default async function Page() {

  return (
    <div className="hidden h-full  flex-1 flex-col  md:flex">
      <div className="flex items-center justify-between space-y-2 border rounded p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Commands</h2>
        </div>
        <div className="flex items-center space-x-2">
          <ModalButton buttonText="Add Command" ModalComponent={CommandForm} />
        </div>
      </div>
      <div className="flex items-center justify-between space-y-2 border rounded p-4 mt-4">
        <CommandTable columns={CommandColumns} />
      </div>
    </div>
  );
}
