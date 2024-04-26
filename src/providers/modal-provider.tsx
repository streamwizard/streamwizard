"use client";
import { createContext, useContext, useEffect, useState } from "react";

interface ModalProviderProps {
  children: React.ReactNode;
}

type ModalContextType = {
  isOpen: boolean;
  setOpen: (modal: React.ReactNode) => void;
  setClose: () => void;
};

export const ModalContext = createContext<ModalContextType>({
  isOpen: false,
  setOpen: (modal: React.ReactNode) => {},
  setClose: () => {},
});

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showingModal, setShowingModal] = useState<React.ReactNode>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const setOpen = async (modal: React.ReactNode) => {
    if (modal) {
      setShowingModal(modal);
      setIsOpen(true);
    }
  };

  const setClose = () => {
    setIsOpen(false);
  };

  if (!isMounted) return null;

  return (
    <ModalContext.Provider value={{ setOpen, setClose, isOpen }}>
      {isOpen && showingModal && (
        <div className="fixed inset-0 z-50 bg-black/80  fade-out-0 fade-in-0">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 fade-out-0 fade-in-0 zoom-out-95 zoom-in-95 slide-out-to-left-1/2 slide-out-to-top-[48%] slide-in-from-left-1/2 slide-in-from-top-[48%] sm:rounded-lg">
            <div className="flex justify-between">
              <h2>Modal</h2>
              <button onClick={() => setClose()}>Close</button>
            </div>
            {showingModal}
          </div>
        </div>
      )}
      {children}
    </ModalContext.Provider>
  );
};

export default ModalProvider;
