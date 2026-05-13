import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { prefStorage } from '../services/preferences';

const CurrencyContext = createContext(null);

export const SUPPORTED_CURRENCIES = [
    { code: 'PLN', label: 'Złoty (PLN)', symbol: 'zł' },
    { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
    { code: 'USD', label: 'Dolar (USD)', symbol: '$' },
    { code: 'GBP', label: 'Funt (GBP)', symbol: '£' },
    { code: 'CHF', label: 'Frank (CHF)', symbol: 'CHF' },
];

const RATES_TTL_MS = 60 * 60 * 1000; // 1h
const RATES_CACHE_KEY = 'fx_rates_pln';

// rates: ile PLN za 1 jednostkę waluty (np. EUR -> 4.25)
async function fetchRatesNBP() {
    const res = await fetch('https://api.nbp.pl/api/exchangerates/tables/A?format=json');
    if (!res.ok) throw new Error('NBP fetch failed');
    const data = await res.json();
    const table = Array.isArray(data) ? data[0] : null;
    if (!table || !table.rates) throw new Error('Bad NBP response');
    const rates = { PLN: 1 };
    for (const r of table.rates) {
        rates[r.code] = r.mid;
    }
    return rates;
}

export function CurrencyProvider({ children }) {
    const [currency, setCurrencyState] = useState(() => prefStorage.get('currency') || 'PLN');
    const [rates, setRates] = useState({ PLN: 1 });
    const [loadingRates, setLoadingRates] = useState(false);

    const setCurrency = useCallback((code) => {
        prefStorage.set('currency', code);
        setCurrencyState(code);
    }, []);

    useEffect(() => {
        const onUserChanged = () => {
            setCurrencyState(prefStorage.get('currency') || 'PLN');
        };
        window.addEventListener('user_prefs_changed', onUserChanged);
        return () => window.removeEventListener('user_prefs_changed', onUserChanged);
    }, []);

    const loadRates = useCallback(async () => {
        // Próba z cache
        try {
            const cached = localStorage.getItem(RATES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.ts && (Date.now() - parsed.ts) < RATES_TTL_MS && parsed.rates) {
                    setRates(parsed.rates);
                    return;
                }
            }
        } catch {}

        setLoadingRates(true);
        try {
            const fresh = await fetchRatesNBP();
            setRates(fresh);
            localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ ts: Date.now(), rates: fresh }));
        } catch (err) {
            console.warn('Nie udało się pobrać kursów NBP, zostaję na PLN.', err);
        } finally {
            setLoadingRates(false);
        }
    }, []);

    useEffect(() => {
        loadRates();
    }, [loadRates]);

    // Kwoty w bazie są w PLN. Przeliczamy do wybranej waluty.
    const format = useCallback((amountPln) => {
        if (typeof amountPln !== 'number' || isNaN(amountPln)) amountPln = 0;
        const meta = SUPPORTED_CURRENCIES.find(c => c.code === currency) || SUPPORTED_CURRENCIES[0];
        const rate = rates[currency] || 1;
        const converted = currency === 'PLN' ? amountPln : amountPln / rate;
        return `${converted.toFixed(2)} ${meta.symbol}`;
    }, [currency, rates]);

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, rates, format, loadingRates, refreshRates: loadRates }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export const useCurrency = () => useContext(CurrencyContext);
