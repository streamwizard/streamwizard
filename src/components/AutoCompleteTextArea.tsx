"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";

interface AutoCompleteTextAreaProps {
  suggestions: string[];
  onChange: (value: string) => void;
  value: string;
}

const AutoCompleteTextArea: React.FC<AutoCompleteTextAreaProps> = ({ suggestions, value, onChange }) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    onChange(newText);
    const match = newText.match(/\$\{([^}]+)\}$/);
    if (match) {
      const query = match[1].toLowerCase();
      setFilteredSuggestions(suggestions.filter((s) => s.toLowerCase().includes(query)));
    } else {
      setFilteredSuggestions([]);
    }
    setActiveSuggestionIndex(null);
  }, [onChange, suggestions]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart, selectionEnd, value } = event.currentTarget;

    switch (event.key) {
      case "{":
        if (selectionStart > 0 && value[selectionStart - 1] === "$") {
          event.preventDefault();
          const newText = `${value.slice(0, selectionStart)}{}${value.slice(selectionEnd)}`;
          onChange(newText);
          setTimeout(() => {
            if (textAreaRef.current) {
              textAreaRef.current.selectionStart = textAreaRef.current.selectionEnd = selectionStart + 1;
              textAreaRef.current.focus();
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
  }, [activeSuggestionIndex, filteredSuggestions, onChange, suggestions]);

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
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full p-2 border border-gray-300 rounded-md"
        rows={5}
      />
      {suggestionsList}
    </div>
  );
};

export default AutoCompleteTextArea;