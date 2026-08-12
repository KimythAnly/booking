import { useCallback } from 'react';
import { useToast } from '../components/Toast';

export interface MutationOptions<T> {
  optimistic?: () => void;
  rollback?: () => void;
  action: () => Promise<T>;
  onSuccess?: (result: T) => void;
  reconcile?: () => void;
  errorMsg?: string;
}

export function isAmbiguousFailure(err: unknown): boolean {
  if (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') return true;
  if (err instanceof TypeError) return true;
  return false;
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
        if (isAmbiguousFailure(err)) {
          // The server may or may not have applied the change (lost response /
          // timeout). Don't roll back — refresh to reconcile with the real state.
          opts.reconcile?.();
          toast.warning('連線不穩定或回應逾時 — 已重新同步，請確認操作結果');
        } else {
          opts.rollback?.();
          toast.error(opts.errorMsg ?? `操作失敗 — ${(err as Error).message}`);
        }
      });
  }, [toast]);
}
