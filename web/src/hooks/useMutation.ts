import { useCallback } from 'react';
import { useToast } from '../components/Toast';

export interface MutationOptions<T> {
  optimistic?: () => void;
  rollback?: () => void;
  action: () => Promise<T>;
  onSuccess?: (result: T) => void;
  errorMsg?: string;
}

export function useMutation() {
  const toast = useToast();
  return useCallback(<T,>(opts: MutationOptions<T>) => {
    opts.optimistic?.();
    opts
      .action()
      .then((res) => {
        opts.onSuccess?.(res);
      })
      .catch((err) => {
        opts.rollback?.();
        toast.error(opts.errorMsg ?? `操作失敗 — ${(err as Error).message}`);
      });
  }, [toast]);
}
