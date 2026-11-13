import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar, Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function EmployeeLogin() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("employeeLogin", { login, password });
      if (res.data?.success) {
        sessionStorage.setItem("employeeSession", JSON.stringify(res.data.session));
        navigate("/", { replace: true });
      } else {
        setError(res.data?.error || "Login ou senha incorretos.");
      }
    } catch (err) {
      console.error("Login error:", err);
      const msg = err?.response?.data?.error || err?.message || "Erro ao conectar ao servidor.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="https://media.base44.com/images/public/69ac93e375e4e4093788aef0/98ca518dd_Varejarte_logo_png__2_.png"
            alt="Varejarte Consultoria"
            className="h-32 w-auto mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold">Varejarte Agenda</h1>

        </div>

        <Card className="shadow-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Entrar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Login</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="seu.login"
                    className="pl-9"
                    autoFocus />
                  
                </div>
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="pl-9 pr-9" />
                  
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error &&
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              }

              <Button type="submit" className="w-full" disabled={!login || !password || loading}>
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>


      </div>
    </div>);

}