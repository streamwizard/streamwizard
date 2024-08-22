import { useState, useRef, useEffect } from "react";
import usePlaceholders from "@/hooks/workflow/usePlaceholders";
import { v4 as uuidv4, v4 } from "uuid";

// Interface for Placeholder
interface Placeholder {
  node_id: string;
  label: string;
  type: string;
  options: string[];
  uuid?: string;
}

// Interface for the custom hook's props
interface UseEditorProps {
  triggerChar: string; // Character that triggers the autocomplete
  initialValue?: string; // Initial content to populate the editor
  onChange?: (content: string) => void; // Callback to handle changes in the editor content
}

const useAutoCompleteEditor = ({ triggerChar, initialValue, onChange }: UseEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null); // Ref to the editor div
  const { placeholders } = usePlaceholders(); // Fetch available placeholders

  // State to manage query and visibility
  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [filteredPlaceholders, setFilteredPlaceholders] = useState<Placeholder[]>(placeholders);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<Placeholder | null>(null);
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const [placeholdersState, setPlaceholdersState] = useState<{ [uuid: string]: Placeholder }>({});

  // Effect to initialize editor content and manage query state from initialValue
  useEffect(() => {
    if (initialValue && editorRef.current) {
      updateEditorContent(initialValue);
    }
  }, [initialValue, placeholders, triggerChar]);

  // Effect to handle input events in the editor
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLDivElement;
      const text = target.innerHTML;
      const triggerIndex = text.lastIndexOf(triggerChar);

      if (triggerIndex !== -1) {
        const query = extractQuery(text, triggerIndex);
        setQuery(query);
        setFilteredPlaceholders(placeholders.filter((p) => p.label.toLowerCase().startsWith(query.toLowerCase())));
        setOpen(true);
      } else {
        setQuery("");
        setFilteredPlaceholders([]);
        setOpen(false);
      }
    };

    const editor = editorRef.current;
    editor?.addEventListener("input", handleInput);
    return () => {
      editor?.removeEventListener("input", handleInput);
    };
  }, [triggerChar, placeholders]);

  // Effect to filter placeholders based on the current query
  useEffect(() => {
    const filtered = query.length === 0 ? placeholders : placeholders.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
    setFilteredPlaceholders(filtered);
  }, [query, placeholders]);

  // Effect to update filtered options when a placeholder is selected
  useEffect(() => {
    setFilteredOptions(selectedPlaceholder ? selectedPlaceholder.options : []);
  }, [selectedPlaceholder]);

  // Helper functions
  const extractQuery = (text: string, triggerIndex: number) => {
    let query = text.substring(triggerIndex + 1).trim(); // Skip the triggerChar
    const nextSpaceIndex = query.indexOf("");
    if (nextSpaceIndex !== -1) query = query.substring(0, nextSpaceIndex).trim();
    return query;
  };

  const updateEditorContent = (text: string) => {
    // Replace placeholders with HTML spans
    const content = replacePlaceholdersWithSpans(text);
    if (editorRef.current) {
      editorRef.current.innerHTML = content;

      // Set the cursor at the end of the content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);

      // Check for the trigger character to open the menu
      const triggerIndex = text.lastIndexOf(triggerChar);
      if (triggerIndex !== -1) {
        const query = extractQuery(text, triggerIndex);
        setQuery(query);
        setFilteredPlaceholders(placeholders.filter((p) => p.label.toLowerCase().startsWith(query.toLowerCase())));
        setOpen(true);
      } else {
        setQuery("");
        setFilteredPlaceholders(placeholders);
        setOpen(false);
      }
    }
  };

  const replacePlaceholdersWithSpans = (text: string) => {
    return text.replace(/{([^}]+)}/g, (match, placeholderContent) => {
      // Replace &nbsp; with an empty string within the placeholder content

      // Split the placeholderContent to get label and option
      const [label, option] = placeholderContent.split(".");

      // Find the placeholder by label or ID
      const placeholder = placeholders.find((p) => p.label === label || p.node_id === label);

      console.log(option);

      if (placeholder) {
        // Return a span element with correct attributes
        return `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-node_id="${
          placeholder.node_id
        }" data-type="${placeholder.type}" data-uuid="${placeholder.uuid || v4()}" contenteditable="false" data-option="${option || ""}">{${
          placeholder.label
        }${option ? `.${option}` : ""}}</span>`;
      }

      // Return the original match if no placeholder found
      return match;
    });
  };

  // Function to calculate the position of the autocomplete menu
  const getAutocompletePosition = () => calculatePosition(editorRef.current);

  // Function to calculate the position of the selected placeholder
  const getSelectedPlaceholderPosition = () => {
    if (editorRef.current && selectedPlaceholder) {
      const placeholderSpan = editorRef.current.querySelector(`[data-uuid="${selectedPlaceholder.uuid}"]`);
      return placeholderSpan ? calculatePosition(placeholderSpan) : { top: 0, left: 0 };
    }
    return { top: 0, left: 0 };
  };

  const calculatePosition = (element: Element | null) => {
    if (element) {
      const rect = element.getBoundingClientRect();
      const editorRect = editorRef.current!.getBoundingClientRect();
      return {
        top: rect.bottom - editorRect.top + window.scrollY,
        left: rect.left - editorRect.left + window.scrollX,
      };
    }
    return { top: 0, left: 0 };
  };

  // Handler for when a placeholder is selected
  const handlePlaceholderClick = (placeholder: Placeholder) => {
    const editor = editorRef.current;
    if (editor) {
      const selection = window.getSelection();
      if (!selection) return;

      const range = selection.getRangeAt(0);
      const triggerIndex = editor.innerHTML.lastIndexOf(triggerChar);

      const placeholderUUID = uuidv4();
      const placeholderHTML = `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-node_id="${placeholder.node_id}" data-type="${placeholder.type}" data-uuid="${placeholderUUID}" contenteditable="false">${placeholder.label}</span>`;

      editor.innerHTML = editor.innerHTML.substring(0, triggerIndex) + placeholderHTML + editor.innerHTML.substring(triggerIndex + query.length + 1);

      // Update the caret position
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

      // Store the placeholder in state
      setPlaceholdersState((prev) => ({
        ...prev,
        [placeholderUUID]: { ...placeholder, uuid: placeholderUUID },
      }));

      setQuery("");
      setOpen(false);

      setSelectedPlaceholder({ ...placeholder, uuid: placeholderUUID });
      setSelectedOption("");
    }
  };

  // Handler for when an option is selected for the placeholder
  const handleOptionClick = (option: string) => {
    if (selectedPlaceholder) {
      const editor = editorRef.current;
      if (editor) {
        const placeholderSpan = editor.querySelector(`[data-uuid="${selectedPlaceholder.uuid}"]`);

        // get the node_id of the selected placeholder
        const selectedPlaceholderNodeID = selectedPlaceholder.node_id;

        if (placeholderSpan) {
          // Update the placeholder span with the selected option
          placeholderSpan.setAttribute("data-option", option);
          placeholderSpan.innerHTML = `{${selectedPlaceholder.label}.${option}}`;

          // Update the state with the new option for this placeholder
          setPlaceholdersState((prev) => ({
            ...prev,
            [selectedPlaceholder.uuid!]: {
              ...selectedPlaceholder,
              options: [option],
            },
          }));

          // Call onChange with the updated content (safely remove the placeholder content) and replace the label with the node_id
          if (onChange) {
            const sanitizedContent = editor.innerHTML
              .replace(/&nbsp;/g, " ")
              .replace(/<[^>]+>/g, "")
              .replace(`{${selectedPlaceholder.label}.${option}}`, `{${selectedPlaceholderNodeID}.${option}}`);

            console.log(sanitizedContent);
            onChange(sanitizedContent);
          }

          // Reset state
          setSelectedPlaceholder(null);
          setSelectedOption("");
        }
      }
    }
  };

  return {
    editorRef,
    query,
    open,
    filteredPlaceholders,
    selectedPlaceholder,
    filteredOptions,
    selectedOption,
    setQuery,
    setOpen,
    setFilteredPlaceholders,
    setSelectedPlaceholder,
    setSelectedOption,
    setFilteredOptions,
    handlePlaceholderClick,
    handleOptionClick,
    getAutocompletePosition,
    getSelectedPlaceholderPosition,
  };
};

export default useAutoCompleteEditor;
