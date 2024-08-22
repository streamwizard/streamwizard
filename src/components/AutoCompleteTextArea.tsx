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
    query,
    open,
    filteredPlaceholders,
    selectedPlaceholder,
    filteredOptions,
    selectedOption,
    handlePlaceholderClick,
    handleOptionClick,
    getAutocompletePosition,
    getSelectedPlaceholderPosition,
  } = useAutoCompleetEditor({ triggerChar, onChange, initialValue });

  const { top, left } = getAutocompletePosition();
  const selectedPlaceholderPosition = getSelectedPlaceholderPosition();

  return (
    <div className="relative max-w-xl w-full">
      <div
        ref={editorRef}
        className="border p-1 rounded-lg w-full focus:outline-none dark:bg-gray-900 text-black dark:text-white min-h-20"
        contentEditable
      />
      {open && (
        <ul className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white z-50" style={{ top, left }}>
          {filteredPlaceholders.length > 0 ? (
            filteredPlaceholders.map((placeholder) => (
              <li
                key={placeholder.uuid }
                className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handlePlaceholderClick(placeholder)}
              >
                {placeholder.label}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 dark:text-gray-400">No results found</li>
          )}
        </ul>
      )}
      {selectedPlaceholder && (
        <ul
          className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white z-50"
          style={{ top: selectedPlaceholderPosition.top, left: selectedPlaceholderPosition.left }}
        >
          {filteredOptions.map((option) => (
            <li key={option} className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600" onClick={() => handleOptionClick(option)}>
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Editor;
