import React, { createContext, useContext } from 'react';
import { useLicense, } from '@/hooks/useLicense';
import type { UseLicenseReturn } from '@/types/license';

const LicenseContext = createContext<UseLicenseReturn | null>(null);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const license = useLicense();
  return (
    <LicenseContext.Provider value={license}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicenseContext(): UseLicenseReturn {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicenseContext must be used within LicenseProvider');
  return ctx;
}
