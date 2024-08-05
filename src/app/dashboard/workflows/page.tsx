import WorkflowCard from "@/components/workflows/cards/wordflow-card";
import { onGetWorkflows } from "@/actions/workflows";
import WorkflowButton from "@/components/workflows/buttons/new-workflow-button";
import { Divide } from "lucide-react";

type Props = {};

const Page = async (props: Props) => {
  const workflows = await onGetWorkflows();

  return (
    <div className="flex flex-col relative">
      <h1 className="text-4xl sticky top-0 z-[10] p-6 bg-background/50 backdrop-blur-lg flex items-center border-b justify-between">
        Workflows
        <WorkflowButton />
      </h1>
      <div className="relative flex flex-col gap-4">
        <section className="flex flex-col m-2">
          {workflows ? (
            workflows.map((flow, index) => (
              <div className="my-2" key={index}>
                <WorkflowCard key={flow.id} {...flow} />
              </div>
            ))
          ) : (
            <div className="mt-28 flex text-muted-foreground items-center justify-center">No Workflows</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Page;
