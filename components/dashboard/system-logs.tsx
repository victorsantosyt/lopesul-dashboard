import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface SystemLogsProps {
  logs: any[]
}

export function SystemLogs({ logs }: SystemLogsProps) {
  const getTypeBadge = (type: string) => {
    switch (type) {
      case "payment":
        return <Badge variant="default">Pagamento</Badge>
      case "mikrotik":
        return <Badge variant="secondary">Mikrotik</Badge>
      case "webhook":
        return <Badge variant="outline">Webhook</Badge>
      case "error":
        return <Badge variant="destructive">Erro</Badge>
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs do Sistema</CardTitle>
        <CardDescription>Últimos 100 eventos do sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{getTypeBadge(log.type)}</TableCell>
                <TableCell>
                  <div>
                    <div>{log.message}</div>
                    {log.data && (
                      <details className="text-xs text-muted-foreground mt-1">
                        <summary className="cursor-pointer">Dados adicionais</summary>
                        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </TableCell>
                <TableCell>{formatDate(log.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
