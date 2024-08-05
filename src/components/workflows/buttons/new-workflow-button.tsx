"use client";
import Workflowform from "@/components/forms/workflow-form";
import Modal from "@/components/global/modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React from "react";

type Props = {};

const WorkflowButton = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {
        <Modal setModal={(e) => setOpen(e)} open={open}>
          <Workflowform />
        </Modal>
      }
      <Button size={"icon"} onClick={() => setOpen(true)}>
        <Plus />
      </Button>
    </>
  );
};

export default WorkflowButton;
