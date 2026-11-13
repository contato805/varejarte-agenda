import { useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

export default function DataReadBoundary({ children }) {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const failed = useSyncExternalStore(
    callback => cache.subscribe(callback),
    () => cache.getAll().some(query => query.state.status === 'error'),
  );
  return <>
    {failed && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 space-y-3">
      <p>Não foi possível carregar todos os dados. Recarregue antes de consultar a agenda ou os relatórios.</p>
      <Button variant="outline" onClick={() => client.resetQueries()}>Recarregar dados</Button>
    </div>}
    <div hidden={failed}>{children}</div>
  </>;
}
