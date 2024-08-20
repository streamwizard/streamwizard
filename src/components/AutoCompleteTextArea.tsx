import React, { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';

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
  placeholders: Placeholder[];
  initialValue?: string;
}

const Editor: React.FC<EditorProps> = ({ triggerChar = "@", onChange, placeholders, initialValue }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [filteredPlaceholders, setFilteredPlaceholders] = useState<Placeholder[]>(placeholders);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<Placeholder | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);

  // Function to convert {placeholder} to span elements with unique IDs
  const replacePlaceholdersWithSpans = (text: string) => {
    return text.replace(/{([^}]+)}/g, (match, label) => {
      const placeholder = placeholders.find(p => p.label === label || p.id === label);
      if (placeholder) {
        const placeholderUUID = uuidv4();
        return `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-id="${placeholder.id}" data-type="${placeholder.type}" data-uuid="${placeholderUUID}" contenteditable="false">${placeholder.label}</span>`;
      }
      return match;
    });
  };

  // Handle initialValue on component mount
  useEffect(() => {
    if (initialValue && editorRef.current) {
      editorRef.current.innerHTML = replacePlaceholdersWithSpans(initialValue);
    }
  }, [initialValue, placeholders]);

  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const text = target.innerText;

      const triggerIndex = text.lastIndexOf(triggerChar);

      if (triggerIndex !== -1) {
        let query = text.substring(triggerIndex + 1).trim();

        const nextSpaceIndex = query.indexOf(" ");
        if (nextSpaceIndex !== -1) {
          query = query.substring(0, nextSpaceIndex).trim();
        }

        if (query) {
          const filtered = placeholders.filter((p) => p.label.toLowerCase().startsWith(query.toLowerCase()));
          setFilteredPlaceholders(filtered);
          setQuery(query);
          setOpen(true);
        } else {
          setFilteredPlaceholders(placeholders);
          setQuery("");
          setOpen(true);
        }
      } else {
        setQuery("");
        setFilteredPlaceholders([]);
        setOpen(false);
      }

      if (onChange) {
        let content = target.innerText;
        placeholders.forEach((p) => {
          content = content.replace(new RegExp(`{${p.label}}`, 'g'), `{${p.id}}`);
        });
        onChange(content);
      }
    };

    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener("input", handleInput);
    }

    return () => {
      if (editor) {
        editor.removeEventListener("input", handleInput);
      }
    };
  }, [triggerChar, onChange, placeholders]);

  useEffect(() => {
    if (query.length === 0) {
      setFilteredPlaceholders(placeholders);
    } else {
      const filtered = placeholders.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
      setFilteredPlaceholders(filtered);
    }
  }, [query]);

  useEffect(() => {
    if (selectedPlaceholder) {
      setFilteredOptions(selectedPlaceholder.options);
    } else {
      setFilteredOptions([]);
    }
  }, [selectedPlaceholder]);

  useEffect(() => {
    console.log(placeholders);
  }, [placeholders]);

  const handlePlaceholderClick = (placeholder: Placeholder) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = window.getSelection();
      if (!selection) return;

      const range = selection.getRangeAt(0);
      const triggerIndex = editor.innerHTML.lastIndexOf(triggerChar);

      // Generate a UUID for this placeholder instance
      const placeholderUUID = uuidv4();
      const placeholderHTML = `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-id="${placeholder.id}" data-type="${placeholder.type}" data-uuid="${placeholderUUID}" contenteditable="false">${placeholder.label}</span>`;

      // Insert the new placeholder HTML with the unique UUID
      editor.innerHTML = editor.innerHTML.substring(0, triggerIndex) + placeholderHTML + editor.innerHTML.substring(triggerIndex + query.length + 1);

      const newRange = document.createRange();
      const newCaretPosition = editor.querySelector(`[data-uuid="${placeholderUUID}"]`)?.nextSibling;

      if (newCaretPosition) {
        newRange.setStartAfter(newCaretPosition);
      } else {
        newRange.setStartAfter(editor.lastChild as Node);
      }
      newRange.collapse(true);

      selection.removeAllRanges();
      selection.addRange(newRange);

      setQuery("");
      setOpen(false);

      // Set selectedPlaceholder without overriding others
      setSelectedPlaceholder({ ...placeholder, uuid: placeholderUUID });
      setSelectedOption("");
    }
  };

  const handleOptionClick = (option: string) => {
    if (selectedPlaceholder) {
      const editor = editorRef.current;
      if (editor) {
        const placeholderSpan = editor.querySelector(`[data-uuid="${selectedPlaceholder.uuid}"]`);

        if (placeholderSpan) {
          placeholderSpan.setAttribute('data-option', option);
          placeholderSpan.innerHTML = `{${selectedPlaceholder.label}.${option}}`;

          let contentWithOptions = editor.innerText;
          placeholders.forEach((p) => {
            const regex = new RegExp(`\\{${p.label}(\\.[^\\}]+)?\\}`, 'g');
            contentWithOptions = contentWithOptions.replace(regex, `{${p.id}${option ? `.${option}` : ''}}`);
          });

          if (onChange) {
            onChange(contentWithOptions);
          }

          setSelectedPlaceholder(null);
          setSelectedOption("");
        }
      }
    }
  };

  const getAutocompletePosition = () => {
    const editor = editorRef.current;
    if (editor) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        const editorRect = editor.getBoundingClientRect();
        return {
          top: rect.bottom - editorRect.top + window.scrollY,
          left: rect.left - editorRect.left + window.scrollX,
        };
      }
    }
    return { top: 0, left: 0 };
  };

  const getSelectedPlaceholderPosition = () => {
    const editor = editorRef.current;
    if (editor && selectedPlaceholder) {
      const placeholderSpan = editor.querySelector(`[data-id="${selectedPlaceholder.id}"]`);
      if (placeholderSpan) {
        const rect = placeholderSpan.getBoundingClientRect();
        const editorRect = editor.getBoundingClientRect();
        return {
          top: rect.bottom - editorRect.top + window.scrollY,
          left: rect.left - editorRect.left + window.scrollX,
        };
      }
    }
    return { top: 0, left: 0 };
  };

  const { top, left } = getAutocompletePosition();
  const selectedPlaceholderPosition = getSelectedPlaceholderPosition();

  return (
    <div className="relative max-w-xl ">
      <div
        ref={editorRef}
        className="border p-1 rounded-lg min-w-[200px] focus:outline-none bg-white dark:bg-gray-900 text-black dark:text-white min-h-20"
        contentEditable
      ></div>
      {open && (
        <ul className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white" style={{ top, left }}>
          {filteredPlaceholders.length > 0 ? (
            filteredPlaceholders.map((placeholder) => (
              <li
                key={placeholder.id}
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
        <ul className="absolute border rounded-lg shadow-lg mt-2 bg-white dark:bg-gray-800 text-black dark:text-white" style={{ top: selectedPlaceholderPosition.top, left: selectedPlaceholderPosition.left }}>
          {filteredOptions.map(option => (
            <li
              key={option}
              className="p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
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
