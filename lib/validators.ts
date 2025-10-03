export function validateCPF(cpf: string): boolean {
  // Remove non-numeric characters
  cpf = cpf.replace(/[^\d]/g, "")

  // Check if has 11 digits
  if (cpf.length !== 11) return false

  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cpf)) return false

  // Validate first check digit
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(cpf.charAt(i)) * (10 - i)
  }
  let checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  if (checkDigit !== Number.parseInt(cpf.charAt(9))) return false

  // Validate second check digit
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(cpf.charAt(i)) * (11 - i)
  }
  checkDigit = 11 - (sum % 11)
  if (checkDigit >= 10) checkDigit = 0
  if (checkDigit !== Number.parseInt(cpf.charAt(10))) return false

  return true
}

export function validateCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  cnpj = cnpj.replace(/[^\d]/g, "")

  // Check if has 14 digits
  if (cnpj.length !== 14) return false

  // Check if all digits are the same
  if (/^(\d)\1+$/.test(cnpj)) return false

  // Validate first check digit
  let sum = 0
  let weight = 5
  for (let i = 0; i < 12; i++) {
    sum += Number.parseInt(cnpj.charAt(i)) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  let checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (checkDigit !== Number.parseInt(cnpj.charAt(12))) return false

  // Validate second check digit
  sum = 0
  weight = 6
  for (let i = 0; i < 13; i++) {
    sum += Number.parseInt(cnpj.charAt(i)) * weight
    weight = weight === 2 ? 9 : weight - 1
  }
  checkDigit = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (checkDigit !== Number.parseInt(cnpj.charAt(13))) return false

  return true
}

export function validateDocument(document: string): boolean {
  const cleaned = document.replace(/[^\d]/g, "")
  if (cleaned.length === 11) return validateCPF(cleaned)
  if (cleaned.length === 14) return validateCNPJ(cleaned)
  return false
}

export function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/[^\d]/g, "")
  if (cleaned.length <= 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
  }
  return cpf
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/[^\d]/g, "")
  if (cleaned.length <= 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
  }
  return cnpj
}

export function formatDocument(document: string): string {
  const cleaned = document.replace(/[^\d]/g, "")
  if (cleaned.length <= 11) return formatCPF(cleaned)
  if (cleaned.length <= 14) return formatCNPJ(cleaned)
  return document
}
