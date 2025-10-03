"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState } from "react"

interface SessionsTableProps {
  sessions: any[]
}

export function SessionsTable({ sessions }: SessionsTableProps) {
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Ativa</Badge>
      case "expired":
        return <Badge variant="secondary">Expirada</Badge>
      case "disconnected":
        return <Badge variant="outline">Desconectada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const handleDisconnect = async (sessionId: string) => {
    setDisconnecting(sessionId)
    try {
      const response = await fetch("/api/mikrotik/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      if (response.ok) {
        // Recarregar a página para atualizar os dados
        window.location.reload()
      } else {
        alert("Erro ao desconectar usuário")
      }
    } catch (error) {
      console.error("Erro ao desconectar:", error)
      alert("Erro ao desconectar usuário")
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sessões de Hotspot</CardTitle>
        <CardDescription>Lista das últimas 50 sessões</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expira em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{session.payments?.customer_name || "N/A"}</div>
                    <div className="text-sm text-muted-foreground">{session.payments?.customer_email || "N/A"}</div>
                  </div>
                </TableCell>
                <TableCell>{session.payments?.plans?.name || "N/A"}</TableCell>
                <TableCell className="font-mono text-sm">{session.mac_address}</TableCell>
                <TableCell className="font-mono text-sm">{session.ip_address || "N/A"}</TableCell>
                <TableCell>{getStatusBadge(session.status)}</TableCell>
                <TableCell>{formatDate(session.expires_at)}</TableCell>
                <TableCell>
                  {session.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect(session.id)}
                      disabled={disconnecting === session.id}
                    >
                      {disconnecting === session.id ? "Desconectando..." : "Desconectar"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
