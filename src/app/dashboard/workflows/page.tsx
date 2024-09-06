import { onGetWorkflows } from "@/actions/workflows";
import { WorkflowColumns } from "@/components/tabels/workflows/workflow-columns";
import { WorkflowTable } from "@/components/tabels/workflows/workflow-table";
import WorkflowButton from "@/components/workflows/buttons/new-workflow-button";

type Props = {};

const Page = async (props: Props) => {
  const workflows = await onGetWorkflows();

  return (
    <div className="flex flex-col w-full ">
      <div className="flex w-full border-b justify-between pb-4">
        <h1 className="text-4xl">Workflows</h1>
        <WorkflowButton />
      </div>
      <div className="relative flex flex-col gap-4">
        <section className="flex flex-col m-2">
          <WorkflowTable workflow={workflows ? workflows : []} columns={WorkflowColumns} />
        </section>
      </div>
    </div>
  );
};

export default Page;
