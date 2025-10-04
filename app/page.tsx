import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Wifi, CreditCard, LayoutDashboard, ArrowRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Sistema de Hotspot Pagar.me</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Integração completa entre Mikrotik e Pagar.me para gestão de acesso à internet via pagamento
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <LayoutDashboard className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Dashboard Admin</CardTitle>
              <CardDescription>Gerencie pagamentos, sessões ativas e monitore o sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/dashboard">
                <Button className="w-full">
                  Acessar Dashboard
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <CreditCard className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Checkout</CardTitle>
              <CardDescription>Página de compra de planos de internet para clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/checkout">
                <Button className="w-full bg-transparent" variant="outline">
                  Ver Checkout
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Wifi className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Portal do Cliente</CardTitle>
              <CardDescription>Consulte status de pagamento e sessão ativa</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/portal">
                <Button className="w-full bg-transparent" variant="outline">
                  Acessar Portal
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Recursos do Sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="font-semibold mb-1">Integração Pagar.me</h3>
                  <p className="text-sm text-muted-foreground">
                    Processamento de pagamentos via PIX e cartão de crédito
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="font-semibold mb-1">Controle Mikrotik</h3>
                  <p className="text-sm text-muted-foreground">
                    Liberação e bloqueio automático de acesso via RouterOS API
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="font-semibold mb-1">Gestão de Sessões</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitoramento em tempo real de sessões ativas e expiradas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <h3 className="font-semibold mb-1">Auditoria Completa</h3>
                  <p className="text-sm text-muted-foreground">Logs detalhados de todas as operações do sistema</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
