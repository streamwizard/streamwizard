"use client";

import { useCallback, useEffect, useState } from "react";
import { CURRENCIES, DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from "@/components/public/pricing/plans";

const STORAGE_KEY = "sw:pricing-currency";

/*
 * Currency choice for the plan cards. Starts on the default so server and
 * client render the same markup, then picks up a stored choice after mount.
 * Everything a switcher needs comes back from here, so new currencies only
 * ever mean a new entry in CURRENCIES.
 */
export function useCurrency() {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isCurrencyCode(stored) && stored !== DEFAULT_CURRENCY) {
      setCurrencyState(stored);
    }
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { currency, setCurrency, currencies: CURRENCIES };
}
