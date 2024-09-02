import useAutoCompleetEditor from "@/hooks/workflow/useAutoCompleet";
import React from "react";

interface Placeholder {
  id: string;
  label: string;
  type: string;
  options: string[];
  uuid?: string;
}

interface EditorProps {
  triggerChar?: string;
  onChange?: (content: string) => void;
  initialValue?: string;
}

const Editor: React.FC<EditorProps> = ({ triggerChar = "@", onChange, initialValue }) => {
  const {
    editorRef,
    open,
    filteredPlaceholders,
    selectedPlaceholder,
    filteredOptions,
    highlightedIndex,
    handlePlaceholderClick,
    handleOptionClick,
    getAutocompletePosition,
    getSelectedPlaceholderPosition,
  } = useAutoCompleetEditor({ triggerChar, onChange, initialValue });

  const { top, left } = getAutocompletePosition();
  const selectedPlaceholderPosition = getSelectedPlaceholderPosition();

  return (
    <div className="relative  w-full">
      <div
        ref={editorRef}
        className="border p-1 rounded-lg w-full focus:outline-none dark:bg-gray-900 text-black dark:text-white min-h-20"
        contentEditable
      />
      {open && (
        <ul className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white z-50" style={{ top, left }}>
          {filteredPlaceholders.map((placeholder, index) => (
            <li
              key={placeholder.uuid}
              className={`p-2 cursor-pointer ${
                index === highlightedIndex ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
              onClick={() => handlePlaceholderClick(placeholder)}
            >
              {placeholder.label}
            </li>
          ))}
        </ul>
      )}

      {selectedPlaceholder && (
        <ul
          className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white z-50"
          style={{ top: selectedPlaceholderPosition.top, left: selectedPlaceholderPosition.left }}
        >
          { filteredOptions && filteredOptions.length > 0 && filteredOptions.map((option, index) => (
            <li
              key={option}
              className={`p-2 cursor-pointer ${
                index === highlightedIndex ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
              onClick={() => handleOptionClick(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Editor;
