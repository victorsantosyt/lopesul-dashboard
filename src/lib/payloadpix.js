// Gera payload EMV (Pix "copia-e-cola") conforme BR Code, para testes/mock

// ---------- utils ----------
function sanitizeAscii(s) {
  return (s || "")
    .toString()
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, ""); // remove não-ASCII
}
function tlv(id, value) {
  const v = String(value ?? "");
  const len = String(v.length).padStart(2, "0");
  return `${id}${len}${v}`;
}
function crc16(str) {
  let pol = 0x1021, res = 0xffff;
  for (let i = 0; i < str.length; i++) {
    res ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      res = (res & 0x8000) ? ((res << 1) ^ pol) : (res << 1);
      res &= 0xffff;
    }
  }
  return res.toString(16).toUpperCase().padStart(4, "0");
}
function toAmountString(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  // 2 casas decimais com ponto
  return n.toFixed(2);
}

// ---------- principal ----------
/**
 * gerarPayloadPix({ chave, nome, cidade, valor, descricao, txid })
 * - chave: string da chave PIX
 * - nome: até 25 chars (será truncado)
 * - cidade: até 15 chars (será truncado)
 * - valor: number (reais) ou string; será formatado p/ 2 casas
 * - descricao: opcional, vai em 26-02 (limitado p/ caber no TLV)
 * - txid: opcional (<= 25) – se não vier, não inclui 62-05
 */
export function gerarPayloadPix({ chave, nome, cidade, valor, descricao, txid }) {
  const gui = "br.gov.bcb.pix"; // sempre minúsculo
  const chaveSan = sanitizeAscii(chave).slice(0, 77); // limite seguro
  const merchantName = sanitizeAscii(nome).slice(0, 25) || "LOJA";
  const merchantCity = sanitizeAscii(cidade).slice(0, 15) || "BRASILIA";
  const desc = sanitizeAscii(descricao).slice(0, 99); // limite seguro
  const tx = sanitizeAscii(txid).slice(0, 25);        // txid Pix máx. 25

  // 00: Payload Format Indicator = "01"
  const id00 = tlv("00", "01");

  // 26: Merchant Account Information Template (GUI + chave [+ descricao])
  // 26-00 GUI; 26-01 Chave; 26-02 Descricao (opcional)
  const mai =
    tlv("00", gui) +
    tlv("01", chaveSan) +
    (desc ? tlv("02", desc) : "");
  const id26 = tlv("26", mai);

  // 52: MCC (0000 = sem categoria)
  const id52 = tlv("52", "0000");

  // 53: Moeda 986 (BRL)
  const id53 = tlv("53", "986");

  // 54: Valor (opcional, mas útil) – com 2 casas
  const valorStr = toAmountString(valor);
  const id54 = valorStr ? tlv("54", valorStr) : "";

  // 58: País (BR)
  const id58 = tlv("58", "BR");

  // 59: Nome do recebedor (até 25)
  const id59 = tlv("59", merchantName);

  // 60: Cidade (até 15)
  const id60 = tlv("60", merchantCity);

  // 62: Additional Data Field Template → 62-05 = Reference Label (txid)
  const adf = tx ? tlv("05", tx) : "";
  const id62 = adf ? tlv("62", adf) : "";

  // 63: CRC será calculado após montar tudo com sufixo "6304"
  const semCRC = [
    id00,
    // 01: Point of Initiation Method — opcional; deixe sem para estático
    id26,
    id52,
    id53,
    id54,
    id58,
    id59,
    id60,
    id62,
  ].join("");

  const crc = crc16(semCRC + "6304");
  return semCRC + "6304" + crc;
}
