"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";

interface AutoCompleteTextAreaProps {
  suggestions: string[];
  onChange: (value: string) => void;
  value: string;
}

const AutoCompleteTextArea: React.FC<AutoCompleteTextAreaProps> = ({ suggestions, value, onChange }) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [contentArray, setContentArray] = useState<(string | JSX.Element)[]>([]);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = value.split(/\$\{([^}]+)\}/g).map((part, index) =>
      index % 2 === 1 ? <span className="border border-blue-500 p-1" key={index}>${part}</span> : part
    );
    setContentArray(content);
  }, [value]);

  const getCaretPosition = (element: HTMLElement) => {
    let caretOffset = 0;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
  };

  const setCaretPosition = (element: HTMLElement, offset: number) => {
    const selection = window.getSelection();
    const range = document.createRange();
    let charCount = 0;
    let nodeFound = false;

    function traverseNodes(node: Node) {
      if (node.nodeType === 3) {
        const nextCharCount = charCount + node.textContent!.length;
        if (!nodeFound && offset >= charCount && offset <= nextCharCount) {
          range.setStart(node, offset - charCount);
          range.collapse(true);
          nodeFound = true;
        }
        charCount = nextCharCount;
      } else {
        for (let i = 0; i < node.childNodes.length; i++) {
          traverseNodes(node.childNodes[i]);
        }
      }
    }

    traverseNodes(element);

    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handleChange = useCallback(() => {
    if (divRef.current) {
      const caretPos = getCaretPosition(divRef.current);

      const newText = divRef.current.innerText || "";
      onChange(newText);

      const match = newText.match(/\$\{([^}]+)\}$/);
      if (match) {
        const query = match[1].toLowerCase();
        setFilteredSuggestions(suggestions.filter((s) => s.toLowerCase().includes(query)));
      } else {
        setFilteredSuggestions([]);
      }
      setActiveSuggestionIndex(null);

      // Update the value and contentArray
      onChange(newText);
    }
  }, [onChange, suggestions]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const { selectionStart } = window.getSelection()?.getRangeAt(0) || {};

    switch (event.key) {
      case "{":
        if (selectionStart && selectionStart > 0 && (divRef.current?.innerText[selectionStart - 1] === "$")) {
          event.preventDefault();
          document.execCommand("insertText", false, "{}");
          setTimeout(() => {
            const range = document.createRange();
            const sel = window.getSelection();
            if (divRef.current && sel) {
              range.setStart(divRef.current.childNodes[0], selectionStart + 1);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
              divRef.current.focus();
            }
          }, 0);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveSuggestionIndex((prevIndex) => (prevIndex === null ? 0 : Math.min(filteredSuggestions.length - 1, prevIndex + 1)));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveSuggestionIndex((prevIndex) => (prevIndex === null ? 0 : Math.max(0, prevIndex - 1)));
        break;
      case "Enter":
        if (activeSuggestionIndex !== null) {
          event.preventDefault();
          const selectedSuggestion = filteredSuggestions[activeSuggestionIndex];
          const newValue = value.replace(/\$\{[^}]*\}$/, `\${${selectedSuggestion}}`);
          onChange(newValue);
          setFilteredSuggestions([]);
          setActiveSuggestionIndex(null);
        }
        break;
      case " ":
        if (event.ctrlKey) {
          event.preventDefault();
          const textBeforeCursor = value.slice(0, selectionStart);
          const openBracketIndex = textBeforeCursor.lastIndexOf("${");
          const closeBracketIndex = textBeforeCursor.lastIndexOf("}");
          if (openBracketIndex !== -1 && closeBracketIndex < openBracketIndex) {
            const query = textBeforeCursor.slice(openBracketIndex + 2).toLowerCase();
            setFilteredSuggestions(suggestions.filter((s) => s.toLowerCase().includes(query)));
            setActiveSuggestionIndex(0);
          } else {
            setFilteredSuggestions([]);
          }
        }
        break;
      case "Escape":
        event.preventDefault();
        setFilteredSuggestions([]);
        setActiveSuggestionIndex(null);
        break;
    }
  }, [activeSuggestionIndex, filteredSuggestions, onChange, suggestions, value]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    const newValue = value.replace(/\$\{[^}]*\}$/, `\${${suggestion}}`);
    onChange(newValue);
    setFilteredSuggestions([]);
    setActiveSuggestionIndex(null);
  }, [onChange, value]);

  const suggestionsList = useMemo(() => (
    filteredSuggestions.length > 0 && (
      <ul className="absolute top-full left-0 w-full mt-1 border border-gray-300 shadow-lg max-h-60 overflow-auto z-10">
        {filteredSuggestions.map((suggestion, index) => (
          <li
            key={suggestion}
            onClick={() => handleSuggestionClick(suggestion)}
            className={`p-2 cursor-pointer ${index === activeSuggestionIndex ? "border" : "bg-transparent"}`}
          >
            {suggestion}
          </li>
        ))}
      </ul>
    )
  ), [filteredSuggestions, activeSuggestionIndex, handleSuggestionClick]);

  return (
    <div className="relative">
      <div
        ref={divRef}
        contentEditable
        onInput={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full p-2 border border-gray-300 rounded-md min-h-[100px] whitespace-pre-wrap"
      >
        {contentArray.map((item, index) => (
          <React.Fragment key={index}>{item}</React.Fragment>
        ))}
      </div>
      {suggestionsList}
    </div>
  );
};

export default AutoCompleteTextArea;
