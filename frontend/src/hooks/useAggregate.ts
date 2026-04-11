"use client";

import useSWR from "swr";

interface AggregateRequest {
  type: string;
  params?: Record<string, unknown>;
}

const fetcher = ([url, body]: [string, string]) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).then((r) => r.json());

export function useAggregate<T = Record<string, unknown>[]>(
  request: AggregateRequest | null,
  refreshInterval?: number,
) {
  const body = request ? JSON.stringify(request) : null;

  const { data, error, isLoading, mutate } = useSWR(
    body ? ["/api/aggregate", body] : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  return {
    data: data?.data as T | undefined,
    error,
    isLoading,
    refresh: mutate,
  };
}
