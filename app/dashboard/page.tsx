import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Database, Play, Settings, CheckCircle, DollarSign, Users, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AutoSetupButton } from "@/components/dashboard/auto-setup-button"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()

  let tablesExist = false
  let plansCount = 0
  let paymentsCount = 0
  let sessionsCount = 0
  let totalRevenue = 0

  try {
    // Check if plans table exists and has data
    const { data: plans, error: plansError } = await supabase.from("plans").select("*", { count: "exact" }).limit(1)

    if (!plansError && plans !== null) {
      tablesExist = true

      // Get actual counts and stats
      const { count: plansTotal } = await supabase.from("plans").select("*", { count: "exact", head: true })

      const { count: paymentsTotal } = await supabase.from("payments").select("*", { count: "exact", head: true })

      const { count: sessionsTotal } = await supabase
        .from("hotspot_sessions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")

      // Calculate total revenue from paid payments
      const { data: paidPayments } = await supabase.from("payments").select("amount_cents").eq("status", "paid")

      plansCount = plansTotal || 0
      paymentsCount = paymentsTotal || 0
      sessionsCount = sessionsTotal || 0
      totalRevenue = paidPayments?.reduce((sum, p) => sum + (p.amount_cents || 0), 0) || 0

      // If no plans exist, insert sample plans
      if (plansCount === 0) {
        const samplePlans = [
          { name: "1 Hora", duration_hours: 1, price_cents: 500, description: "Acesso por 1 hora", active: true },
          { name: "3 Horas", duration_hours: 3, price_cents: 1200, description: "Acesso por 3 horas", active: true },
          { name: "6 Horas", duration_hours: 6, price_cents: 2000, description: "Acesso por 6 horas", active: true },
          { name: "12 Horas", duration_hours: 12, price_cents: 3500, description: "Acesso por 12 horas", active: true },
          { name: "1 Dia", duration_hours: 24, price_cents: 5000, description: "Acesso por 24 horas", active: true },
        ]

        await supabase.from("plans").insert(samplePlans)
        plansCount = samplePlans.length
      }
    }
  } catch (error) {
    console.error("[v0] Error checking database:", error)
    tablesExist = false
  }

  const missingTables = ["payments", "hotspot_sessions", "system_logs", "plans"]

  if (tablesExist) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Lopesul</h1>
            <p className="text-muted-foreground">Controle e monitoramento Mikrotik/Starlink</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Sistema Operacional
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pagamentos</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentsCount}</div>
              <p className="text-xs text-muted-foreground">
                {paymentsCount === 0 ? "Nenhum pagamento ainda" : "Pagamentos registrados"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {(totalRevenue / 100).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                {paymentsCount === 0 ? "Aguardando primeiro pagamento" : "Receita confirmada"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessionsCount}</div>
              <p className="text-xs text-muted-foreground">
                {sessionsCount === 0 ? "Nenhuma sessão ativa" : "Usuários conectados"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Planos Disponíveis</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{plansCount}</div>
              <p className="text-xs text-muted-foreground">Planos ativos</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="sessions">Sessões Hotspot</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sistema Configurado com Sucesso!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    O banco de dados está configurado e operacional. Você pode começar a usar o sistema!
                  </AlertDescription>
                </Alert>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <h3 className="font-semibold">Próximos Passos:</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>
                        Teste o checkout em{" "}
                        <a href="/checkout" className="underline">
                          /checkout
                        </a>
                      </li>
                      <li>Configure as variáveis de ambiente do Pagar.me</li>
                      <li>Configure a conexão com o Mikrotik</li>
                      <li>Configure o webhook do Pagar.me</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Links Úteis:</h3>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="/checkout">Testar Checkout</a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href="/portal">Portal do Cliente</a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pagamentos Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum pagamento registrado ainda</p>
                    <Button variant="outline" size="sm" className="mt-4 bg-transparent" asChild>
                      <a href="/checkout">Fazer primeiro teste</a>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Visualização detalhada de pagamentos em desenvolvimento
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sessões Ativas do Hotspot</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma sessão ativa no momento</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {sessionsCount} {sessionsCount === 1 ? "usuário conectado" : "usuários conectados"}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Banco de Dados</div>
                      <div className="text-sm text-muted-foreground">Supabase conectado</div>
                    </div>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Operacional
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Pagar.me API</div>
                      <div className="text-sm text-muted-foreground">Configure as variáveis de ambiente</div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Mikrotik API</div>
                      <div className="text-sm text-muted-foreground">Configure as variáveis de ambiente</div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Lopesul</h1>
          <p className="text-muted-foreground">Controle e monitoramento Mikrotik/Starlink</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            <Settings className="h-3 w-3 mr-1" />
            Configuração Pendente
          </Badge>
        </div>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-4">
          <div>
            <strong>🚨 Sistema não configurado!</strong>
            <br />O banco de dados precisa ser inicializado antes de usar o dashboard.
          </div>
          <div className="flex gap-3 flex-wrap">
            <AutoSetupButton />
            <Button size="sm" asChild className="bg-orange-600 hover:bg-orange-700">
              <a
                href="https://supabase.com/dashboard/project/_/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Abrir Supabase SQL Editor (Manual)
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/checkout" className="inline-flex items-center gap-2">
                <Play className="h-4 w-4" />
                Testar checkout (funciona sem banco)
              </a>
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg text-sm space-y-3">
            <div className="flex items-center gap-2 font-semibold">
              <Database className="h-4 w-4" />
              Passos para configurar:
            </div>
            <ol className="list-decimal list-inside space-y-2 ml-6">
              <li>
                <strong>Opção 1 - Automático (Recomendado):</strong>
                <br />
                <span className="text-muted-foreground">
                  Clique no botão verde "Inicializar Banco Automaticamente" acima
                </span>
              </li>
              <li>
                <strong>Opção 2 - Manual:</strong>
                <br />
                <span className="text-muted-foreground">
                  Clique no botão laranja acima ou acesse{" "}
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    supabase.com/dashboard
                  </a>
                </span>
              </li>
              <li>
                <strong>Execute os scripts na ordem:</strong>
                <div className="ml-4 mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">1º</Badge>
                    <code className="bg-background px-2 py-1 rounded text-xs">
                      scripts/001_create_payment_tables.sql
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">2º</Badge>
                    <code className="bg-background px-2 py-1 rounded text-xs">scripts/002_insert_sample_plans.sql</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">3º</Badge>
                    <code className="bg-background px-2 py-1 rounded text-xs">scripts/003_setup_rls_policies.sql</code>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  💡 Copie o conteúdo de cada arquivo da pasta <code>/scripts</code> e cole no SQL Editor
                </div>
              </li>
              <li>
                <strong>Recarregue esta página</strong>
                <br />
                <span className="text-muted-foreground">Após executar os 3 scripts, atualize o dashboard</span>
              </li>
            </ol>
          </div>
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">Aguardando configuração</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">R$ --</div>
            <p className="text-xs text-muted-foreground">Aguardando dados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessões Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground">Sistema não configurado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">⚙️</div>
            <p className="text-xs text-muted-foreground">Configuração pendente</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList>
          <TabsTrigger value="setup">
            <Settings className="h-4 w-4 mr-2" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="payments" disabled>
            Pagamentos ⚠️
          </TabsTrigger>
          <TabsTrigger value="sessions" disabled>
            Sessões Hotspot ⚠️
          </TabsTrigger>
          <TabsTrigger value="logs" disabled>
            Logs do Sistema ⚠️
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Status do Banco de Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Conexão Supabase</div>
                      <div className="text-sm text-muted-foreground">Integração configurada</div>
                    </div>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg border-orange-200">
                    <div>
                      <div className="font-medium">Tabelas do Sistema</div>
                      <div className="text-sm text-muted-foreground">Faltam: {missingTables.join(", ")}</div>
                    </div>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Não criadas
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Scripts SQL</div>
                      <div className="text-sm text-muted-foreground">Prontos para execução</div>
                    </div>
                    <Badge variant="secondary">
                      <Play className="h-3 w-3 mr-1" />
                      Aguardando
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Integrações Externas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Pagar.me API</div>
                      <div className="text-sm text-muted-foreground">Pagamentos PIX</div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Mikrotik API</div>
                      <div className="text-sm text-muted-foreground">Controle de hotspot</div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Webhook Pagar.me</div>
                      <div className="text-sm text-muted-foreground">Automação de pagamentos</div>
                    </div>
                    <Badge variant="secondary">Configurar</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Configuração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                  <div>
                    <div className="font-medium text-orange-800">Executar Scripts SQL</div>
                    <div className="text-sm text-orange-600">
                      Criar tabelas, inserir planos de exemplo e configurar políticas de segurança (3 scripts)
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Configurar Variáveis de Ambiente</div>
                    <div className="text-sm text-gray-600">
                      PAGAR_ME_API_KEY, MIKROTIK_HOST, MIKROTIK_USERNAME, etc.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    3
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Testar Integrações</div>
                    <div className="text-sm text-gray-600">Verificar conectividade com Pagar.me e Mikrotik</div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="bg-gray-400 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
                    4
                  </div>
                  <div>
                    <div className="font-medium text-gray-700">Sistema Operacional</div>
                    <div className="text-sm text-gray-600">Dashboard completo com automação de hotspot</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Execute os scripts SQL primeiro para acessar os dados de pagamentos.</AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Execute os scripts SQL primeiro para acessar os dados das sessões de hotspot.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Execute os scripts SQL primeiro para acessar os logs do sistema.</AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  )
}
