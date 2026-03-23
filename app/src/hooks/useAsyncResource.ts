"use client";

import { useEffect, useEffectEvent, useState } from "react";

export function useAsyncResource<TData>(
  load: () => Promise<TData>,
  deps: React.DependencyList,
  initialData: TData
) {
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextData = await load();
      setData(nextData);
      return nextData;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load data");
      return null;
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void refresh();
  }, deps);

  return {
    data,
    error,
    isLoading,
    refresh,
    setData,
  };
}
