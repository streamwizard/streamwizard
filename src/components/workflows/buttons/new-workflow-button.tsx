"use client";
import Workflowform from "@/components/forms/workflow-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { useModal } from "@/providers/modal-provider";
import { cn } from "@/utils";
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
