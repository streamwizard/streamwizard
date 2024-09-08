'use client'
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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Effect to initialize editor content and manage query state from initialValue
  useEffect(() => {
    if (initialValue && editorRef.current) {
      updateEditorContent(initialValue);
    }
  }, [initialValue, placeholders, triggerChar]);

  // Effect to handle input events in the editor
  useEffect(() => {
    const editor = editorRef.current;
    editor?.addEventListener("input", handleInput);
    editor?.addEventListener("keydown", handleKeyDown);

    return () => {
      editor?.removeEventListener("input", handleInput);
      editor?.removeEventListener("keydown", handleKeyDown);
    };
  }, [filteredPlaceholders, filteredOptions, highlightedIndex, selectedPlaceholder]);

  // Effect to filter placeholders based on the current query
  useEffect(() => {
    const filtered = query.length === 0 ? placeholders : placeholders.filter((p) => p.label.toLowerCase().includes(query.toLowerCase()));
    setFilteredPlaceholders(filtered);
  }, [query, placeholders]);

  // Effect to update filtered options when a placeholder is selected
  useEffect(() => {
    setFilteredOptions(selectedPlaceholder ? selectedPlaceholder.options : []);
  }, [selectedPlaceholder]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredPlaceholders, filteredOptions]);

  // Helper functions
  const extractQuery = (text: string, triggerIndex: number) => {
    let query = text.substring(triggerIndex + 1); // Extract the text after the triggerChar
    const spaceIndex = query.indexOf(" ");

    if (spaceIndex !== -1) {
      // If there is a space, return an empty string
      return "";
    }

    return query.trim();
  };

  const updateEditorContent = (text: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const selection = window.getSelection();
    let caretPosition = 0;

    // Save current caret position
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editor);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretPosition = preCaretRange.toString().length;
    }

    // Replace placeholders with HTML spans
    const content = replacePlaceholdersWithSpans(text);

    // Update the editor content
    editor.innerHTML = content;

    // Restore caret position
    const newPosition = restoreCaretPosition(editor, caretPosition);

    // If restoreCaretPosition failed, fall back to placing caret at the end
    if (newPosition === -1) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

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
  };

  // Helper function to restore caret position
function restoreCaretPosition(el: HTMLElement, position: number): number {
  const range = document.createRange();
  const sel = window.getSelection();
  
  let currentPosition = 0;
  let startNode: Node | null = null;
  let startOffset = 0;

  function traverseNodes(node: Node): boolean {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.nodeValue?.length || 0;
      if (currentPosition + nodeLength >= position) {
        startNode = node;
        startOffset = position - currentPosition;
        return true;
      } else {
        currentPosition += nodeLength;
      }
    } else {
      for (const childNode of Array.from(node.childNodes)) {
        if (traverseNodes(childNode)) {
          return true;
        }
      }
    }
    return false;
  }

  traverseNodes(el);

  if (startNode) {
    range.setStart(startNode, startOffset);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    return startOffset;
  }

  return -1;
}

  const sanitizeContent = (html: string) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const spans = tempDiv.querySelectorAll("span[data-node_id]");
    spans.forEach((span) => {
      const nodeId = span.getAttribute("data-node_id");
      const option = span.getAttribute("data-option") || "";
      if (nodeId) {
        span.replaceWith(`{${nodeId}${option ? `:${option}` : ""}}`);
      }
    });

    return tempDiv.textContent || "";
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLDivElement;
    const text = target.innerText;

    // Check for the trigger character to open the menu
    const triggerIndex = text.lastIndexOf(triggerChar);

    if (triggerIndex !== -1) {
      const query = extractQuery(text, triggerIndex);

      if (query.length === 0) {
        // Close the placeholder list if there's a space

        setQuery("");
        setFilteredPlaceholders([]);
        setOpen(false);
      } else {
        setQuery(query);
        setFilteredPlaceholders(placeholders.filter((p) => p.label.toLowerCase().startsWith(query.toLowerCase())));
        setOpen(true);
      }
    } else {
      setQuery("");
      setFilteredPlaceholders([]);
      setOpen(false);
    }

    // Sanitize content by replacing spans with placeholderId and option
    const sanitizedContent = sanitizeContent(target.innerHTML);

    // Call onChange with the updated content
    if (onChange) {
      onChange(sanitizedContent);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    let itemList: Placeholder[] | string[];

    if (selectedPlaceholder) {
      // Options menu is open
      itemList = filteredOptions;
    } else {
      // Placeholder menu is open
      itemList = filteredPlaceholders;
    }

    if (itemList.length > 0) {
      if (e.key === "ArrowDown") {
        setHighlightedIndex((prevIndex) => (prevIndex + 1) % itemList.length);
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setHighlightedIndex((prevIndex) => (prevIndex === 0 ? itemList.length - 1 : prevIndex - 1));
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < itemList.length) {
          if (selectedPlaceholder) {
            // Since selectedPlaceholder is not null, itemList is string[]
            handleOptionClick(itemList[highlightedIndex] as string);
          } else {
            // Since selectedPlaceholder is null, itemList is Placeholder[]
            handlePlaceholderClick(itemList[highlightedIndex] as Placeholder);
          }
          setHighlightedIndex(-1);
        }
        e.preventDefault();
      }
    }
  };

  const replacePlaceholdersWithSpans = (text: string) => {
    return text.replace(/{([^}]+)}/g, (match, placeholderContent) => {
      // Replace &nbsp; with an empty string within the placeholder content

      // Split the placeholderContent to get label and option
      const [label, option] = placeholderContent.split(":");

      // Find the placeholder by label or ID
      const placeholder = placeholders.find((p) => p.label === label || p.node_id === label);

      if (placeholder) {
        // Return a span element with correct attributes
        return `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-node_id="${
          placeholder.node_id
        }" data-type="${placeholder.type}" data-uuid="${placeholder.uuid || v4()}" contenteditable="false" data-option="${option || ""}">{${
          placeholder.label
        }${option ? `:${option}` : ""}}</span>`;
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
      let carrotPosition = range.startOffset;

      const placeholderUUID = uuidv4();
      const placeholderHTML = `<span class="inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium" data-node_id="${placeholder.node_id}" data-type="${placeholder.type}" data-uuid="${placeholderUUID}" contenteditable="false">${placeholder.label}</span>`;

      editor.innerHTML = editor.innerHTML.substring(0, triggerIndex) + placeholderHTML + editor.innerHTML.substring(triggerIndex + query.length + 1);

      // Update the caret position
      const newRange = document.createRange();
      const newCaretPosition = editor.querySelector(`[data-uuid="${placeholderUUID}"]`)?.nextSibling;

      // set the caret position to the end of the placeholder using the restore caret position function
      if (newCaretPosition) {
        // set the caret position to the end of the placeholder using the restore caret position function
        restoreCaretPosition(editor, carrotPosition || -1);
      }
      
   

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
          placeholderSpan.innerHTML = `{${selectedPlaceholder.label}:${option}}`;

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
            const sanitizedContent = sanitizeContent(editor.innerHTML);

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
    highlightedIndex,
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
