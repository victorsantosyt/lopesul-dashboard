import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Registra uma ação no log de auditoria
 * @param {Object} params
 * @param {string} params.acao - Ação executada (enum AuditAction)
 * @param {string} params.entidade - Tipo de entidade afetada
 * @param {string} params.entidadeId - ID da entidade
 * @param {string} params.operadorId - ID do operador (opcional)
 * @param {string} params.operadorNome - Nome do operador (opcional)
 * @param {Object} params.detalhes - Detalhes adicionais em JSON
 * @param {string} params.ipAddress - IP do cliente
 * @param {string} params.userAgent - User agent do cliente
 * @param {boolean} params.sucesso - Se a ação foi bem sucedida
 * @param {string} params.erro - Mensagem de erro (se houver)
 */
export async function registrarAuditoria({
  acao,
  entidade,
  entidadeId = null,
  operadorId = null,
  operadorNome = null,
  detalhes = null,
  ipAddress = null,
  userAgent = null,
  sucesso = true,
  erro = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        acao,
        entidade,
        entidadeId,
        operadorId,
        operadorNome,
        detalhes: detalhes ? JSON.stringify(detalhes) : null,
        ipAddress,
        userAgent,
        sucesso,
        erro,
      },
    })
  } catch (error) {
    // Não falhar a operação principal se o log falhar
    console.error("[v0] Erro ao registrar auditoria:", error)
  }
}

/**
 * Busca logs de auditoria com filtros
 */
export async function buscarLogs({
  acao,
  entidade,
  entidadeId,
  operadorId,
  dataInicio,
  dataFim,
  page = 1,
  limit = 50,
}) {
  const where = {}

  if (acao) where.acao = acao
  if (entidade) where.entidade = entidade
  if (entidadeId) where.entidadeId = entidadeId
  if (operadorId) where.operadorId = operadorId

  if (dataInicio || dataFim) {
    where.createdAt = {}
    if (dataInicio) where.createdAt.gte = new Date(dataInicio)
    if (dataFim) where.createdAt.lte = new Date(dataFim)
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs: logs.map((log) => ({
      ...log,
      detalhes: log.detalhes ? JSON.parse(log.detalhes) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Extrai IP e User Agent de uma requisição Next.js
 */
export function extrairInfoRequisicao(request) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || request.ip || "unknown"

  const userAgent = request.headers.get("user-agent") || "unknown"

  return { ipAddress, userAgent }
}
