import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';

interface Person {
  name: string;
  phone: string;
  id?: string;
}

interface AutocompleteProps {
  label: string;
  placeholder: string;
  suggestions: Person[];
  selectedName: string;
  selectedPhone: string;
  onSelect: (name: string, phone: string) => void;
  onNameChange: (name: string) => void;
  onPhoneChange: (phone: string) => void;
}

export function Autocomplete({
  label,
  placeholder,
  suggestions,
  selectedName,
  selectedPhone,
  onSelect,
  onNameChange,
  onPhoneChange,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      suggestion.phone.includes(searchTerm)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    onNameChange(value);
    setIsOpen(true);
  };

  const handleSuggestionClick = (suggestion: Person) => {
    onSelect(suggestion.name, suggestion.phone);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder={placeholder}
          value={selectedName || searchTerm}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="text"
          placeholder="Teléfono"
          value={selectedPhone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium text-sm text-gray-900">{suggestion.name}</div>
              <div className="text-xs text-gray-500">{suggestion.phone}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
