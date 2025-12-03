import React, { useState } from 'react';
import { SearchBar } from './SearchBar';
import { ClientProfile } from './ClientProfile';
import { LoansList } from './LoansList';
import { mockClient, mockLoans } from '../data/mockData';
export function ClientPaymentHistory() {
  const [client, setClient] = useState(mockClient);
  const [loans, setLoans] = useState(mockLoans);
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    // In a real app, this would make an API call to search for clients
    console.log('Searching for:', query);
  };
  return <div className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
          <span className="inline-flex items-center justify-center bg-primary/10 p-2 rounded-md">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9H21M7 3V5M17 3V5M6 12H10V16H6V12ZM14 12H18V16H14V12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          Historial de Cliente
        </h1>
        <SearchBar onSearch={handleSearch} initialValue={searchQuery} />
      </header>
      {client && <>
          <ClientProfile client={client} />
          <LoansList loans={loans} />
        </>}
    </div>;
}