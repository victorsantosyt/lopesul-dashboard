"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState } from "react"

interface PaymentsTableProps {
  payments: any[]
}

export function PaymentsTable({ payments }: PaymentsTableProps) {
  const [selectedPayment, setSelectedPayment] = useState<any>(null)

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge variant="default">Pago</Badge>
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>
      case "expired":
        return <Badge variant="outline">Expirado</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("pt-BR")
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Recentes</CardTitle>
          <CardDescription>Lista dos últimos 50 pagamentos</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{payment.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{payment.customer_email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{payment.plans?.name || "N/A"}</TableCell>
                  <TableCell>{formatCurrency(payment.amount_cents)}</TableCell>
                  <TableCell>{getStatusBadge(payment.status)}</TableCell>
                  <TableCell>{formatDate(payment.created_at)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => setSelectedPayment(payment)}>
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedPayment && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Pagamento</CardTitle>
            <CardDescription>ID: {selectedPayment.id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">Cliente</h4>
                <p>{selectedPayment.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedPayment.customer_email}</p>
                {selectedPayment.customer_phone && (
                  <p className="text-sm text-muted-foreground">{selectedPayment.customer_phone}</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold">Pagamento</h4>
                <p>{formatCurrency(selectedPayment.amount_cents)}</p>
                <p className="text-sm text-muted-foreground">Método: {selectedPayment.payment_method}</p>
                <p className="text-sm text-muted-foreground">Status: {getStatusBadge(selectedPayment.status)}</p>
              </div>
            </div>
            {selectedPayment.pix_qr_code && (
              <div>
                <h4 className="font-semibold">PIX</h4>
                <p className="text-sm font-mono bg-muted p-2 rounded">{selectedPayment.pix_qr_code}</p>
              </div>
            )}
            <Button variant="outline" onClick={() => setSelectedPayment(null)}>
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
