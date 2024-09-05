"use client";
import Workflowform from "@/components/forms/workflow-form";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalTrigger } from "@/components/ui/animated-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/utils";
import React from "react";

type Props = {};

const WorkflowButton = (props: Props) => {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <ModalTrigger className={cn(buttonVariants({ variant: "outline" }))}>New Workflow</ModalTrigger>
      <ModalBody>
        <ModalContent className="flex justify-center items-center">
          <Workflowform />
        </ModalContent>
      </ModalBody>
    </>
  );
};

export default WorkflowButton;
