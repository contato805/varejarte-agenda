import React, { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Loader2, FileText } from "lucide-react";

export default function Settings() {
  const [loading, setLoading] = useState(false);

  const handleDownloadMd = async () => {
    setLoading(true);
    try {
      const res = await api.functions.invoke("generateFullBackupMd", {});
      const { markdown, date } = res.data;

      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-varejarte-${date.replace(/\//g, "-")}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erro ao gerar backup: " + (err?.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Backup Completo do Sistema
          </CardTitle>
          <CardDescription>
            Baixe um arquivo .md contendo todos os dados do sistema: colaboradores, clientes (com contatos, filiais e atividades), tipos de atividade, todos os agendamentos e histórico de auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadMd} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? "Gerando backup..." : "Baixar Backup (.md)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}