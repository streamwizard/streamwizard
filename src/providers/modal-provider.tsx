"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from "react";
import { MdClose } from "react-icons/md";

// Create a context for the modal
interface ModalContextType {
  openModal: (content: ReactNode, props?: Record<string, any>) => void;
  closeModal: () => void;
  modalProps: Record<string, any>;
}

const ModalContext = createContext<ModalContextType | null>(null);

interface Props {
  children: React.ReactNode;
}

// Modal Provider component
export const ModalProvider = ({ children }: Props) => {
  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [modalProps, setModalProps] = useState<Record<string, any>>({});

  const openModal = useCallback((content: ReactNode, props: Record<string, any> = {}) => {
    setModalContent(content);
    setModalProps(props);
  }, []);

  const closeModal = useCallback(() => {
    setModalContent(null);
    setModalProps({});
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, modalProps }}>
      {children}
      <Modal isOpen={!!modalContent} closeModal={closeModal}>
        {modalContent}
      </Modal>
    </ModalContext.Provider>
  );
};

// Custom hook to use the modal context
export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
};

// Example Modal component
interface ModalProps {
  children: ReactNode;
  closeModal: () => void;
  isOpen: boolean;
}

const Modal: React.FC<ModalProps> = ({ children, closeModal, isOpen }) => {
  // Close modal on ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
          className="fixed inset-0 h-full w-full flex items-center justify-center z-50"
          // onClick={closeModal} // Close when clicking the background
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, backdropFilter: "blur(10px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 h-full w-full bg-black bg-opacity-50 z-50"
          />

          <motion.div
            className={cn("z-50 relative bg-background rounded-md shadow-md p-4")}
            initial={{ opacity: 0, scale: 0.5, rotateX: 40, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 10 }}
            transition={{ type: "tween", stiffness: 260, damping: 15 }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
            <button onClick={closeModal} className="absolute top-4 right-4 text-2xl" aria-label="Close modal">
              <MdClose />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
