import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StatsCardsProps {
  payments: any[]
  sessions: any[]
}

export function StatsCards({ payments, sessions }: StatsCardsProps) {
  // Calcular estatísticas
  const totalPayments = payments.length
  const paidPayments = payments.filter((p) => p.status === "paid").length
  const pendingPayments = payments.filter((p) => p.status === "pending").length
  const failedPayments = payments.filter((p) => p.status === "failed").length

  const activeSessions = sessions.filter((s) => s.status === "active").length
  const expiredSessions = sessions.filter((s) => s.status === "expired").length

  const totalRevenue = payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount_cents, 0)

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPayments}</div>
          <div className="flex gap-2 mt-2">
            <Badge variant="default">{paidPayments} pagos</Badge>
            <Badge variant="secondary">{pendingPayments} pendentes</Badge>
            {failedPayments > 0 && <Badge variant="destructive">{failedPayments} falharam</Badge>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          <p className="text-xs text-muted-foreground">Pagamentos confirmados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activeSessions}</div>
          <p className="text-xs text-muted-foreground">Usuários conectados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Sessões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{sessions.length}</div>
          <div className="flex gap-2 mt-2">
            <Badge variant="default">{activeSessions} ativas</Badge>
            <Badge variant="secondary">{expiredSessions} expiradas</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
