import { useEffect, useState } from 'react';

// Loads a static file from public/data/ (e.g. "overall_summary.json").
// These are pre-computed by scripts/fetch-data.js — this hook never talks
// to the Socrata API directly.
export function useJsonData(filename) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    fetch(`/data/${filename}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${filename}: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ data: null, loading: false, error });
      });

    return () => {
      cancelled = true;
    };
  }, [filename]);

  return state;
}
