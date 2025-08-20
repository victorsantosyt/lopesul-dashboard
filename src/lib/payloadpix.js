// Gera payload EMV (Pix copia-e-cola) básico para testes/mock
export function gerarPayloadPix({ chave, nome, cidade, valor, descricao }) {
  function sanitize(s) {
        return (s || '').toString().normalize('NFKD').replace(/[^\x20-\x7E]/g, '');
    }
  chave = sanitize(chave); nome = sanitize(nome); cidade = sanitize(cidade); descricao = sanitize(descricao);

  const merchantAccount = `0014BR.GOV.BCB.PIX01${String(chave.length).padStart(2,'0')}${chave}`;
  const campo26 = `26${String(merchantAccount.length).padStart(2,'0')}${merchantAccount}`;
  const campo54 = `54${String(valor.length).padStart(2,'0')}${valor}`;
  const campo59 = `59${String(nome.length).padStart(2,'0')}${nome}`;
  const campo60 = `60${String(cidade.length).padStart(2,'0')}${cidade}`;
  const campo62 = `62070503***`;

  const partes = ["000201", campo26, "52040000", "5303986", campo54, "5802BR", campo59, campo60, campo62];
  const semCRC = partes.join("");
  const crc = crc16(semCRC + "6304");
  return semCRC + "6304" + crc;
}

function crc16(str) {
  let pol = 0x1021, res = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    res ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      res = (res & 0x8000) ? ((res << 1) ^ pol) : (res << 1);
      res &= 0xFFFF;
    }
  }
  return res.toString(16).toUpperCase().padStart(4, "0");
}
