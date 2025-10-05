// test-fetch.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testarConexao() {
  const url = "https://api.pagar.me/core/v5";
  console.log(`🔍 Testando conexão com: ${url}`);

  try {
    const response = await fetch(url);
    console.log(`✅ Conexão bem-sucedida! Status: ${response.status}`);
  } catch (err) {
    console.error("❌ Erro ao conectar:", err.message);
  }
}

testarConexao();
