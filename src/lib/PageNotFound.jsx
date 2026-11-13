import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <div className="text-center space-y-4">
      <h1 className="text-5xl font-light text-muted-foreground">404</h1>
      <p>Página não encontrada.</p>
      <Link to="/" className="underline text-primary">Voltar à agenda</Link>
    </div>
  </div>;
}
