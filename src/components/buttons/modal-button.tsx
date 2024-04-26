"use client";
import React, { ReactNode } from "react";
import { Button } from "../ui/button";
import Modal from "../global/modal";

interface ModalButtonProps {
  ModalComponent: React.FC<{ setModal: (value: boolean) => void }>;
  buttonText: string;
}

export default function ModalButton({ ModalComponent, buttonText }: ModalButtonProps) {
  const [modal, setModal] = React.useState<boolean>(false);

  const setOpen = () => setModal(true);
  const setClose = () => setModal(false);

  return (
    <>
      <Button variant="outline" onClick={setOpen}>{buttonText}</Button>
      <Modal open={modal} setModal={setClose}>
        <ModalComponent setModal={setClose}/>
      </Modal>
    </>
  );
}
