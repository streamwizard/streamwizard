'use client'
import React from "react";
import { Button } from "@/components/ui/button";


interface Props {
  children: React.ReactNode;
  open?: boolean;
  setModal: (value: boolean) => void;
}

export default function Modal({ children, setModal, open }: Props) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/80  fade-out-0 fade-in-0">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-[50rem] translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 fade-out-0 fade-in-0 zoom-out-95 zoom-in-95 slide-out-to-left-1/2 slide-out-to-top-[48%] slide-in-from-left-1/2 slide-in-from-top-[48%] sm:rounded-lg">
            <div className="flex justify-between">
              <h2>Modal</h2>
              <button onClick={() => setModal(false)}>Close</button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
