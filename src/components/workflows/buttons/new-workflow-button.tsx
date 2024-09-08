"use client";
import Workflowform from "@/components/forms/workflow-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useModal } from "@/providers/modal-provider";
import React from "react";

type Props = {};

const WorkflowButton = (props: Props) => {
  const { openModal } = useModal();

  const handleOpenModal = () => {
    openModal(<Workflowform />);
  };

  return (
    <>
      <Button onClick={handleOpenModal} className={cn(buttonVariants({ variant: "outline" }))}>
        New Workflow
      </Button>
    </>
  );
};

export default WorkflowButton;
