import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle, Database, Play, Settings, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  // Por enquanto, assumimos que as tabelas não existem
  // O usuário precisa executar os scripts SQL primeiro
  const tablesExist = false
  const missingTables = ["payments", "hotspot_sessions", "system_logs", "plans"]

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
          <div className="flex gap-3">
            <Button size="sm" asChild className="bg-orange-600 hover:bg-orange-700">
              <a
                href="https://supabase.com/dashboard/project/_/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Abrir Supabase SQL Editor
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
                <strong>Abra o Supabase SQL Editor:</strong>
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
                <strong>Selecione seu projeto Supabase</strong>
                <br />
                <span className="text-muted-foreground">Escolha o projeto conectado a este app</span>
              </li>
              <li>
                <strong>Vá em "SQL Editor" no menu lateral</strong>
                <br />
                <span className="text-muted-foreground">Ou clique em "New query"</span>
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
