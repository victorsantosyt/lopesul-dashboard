import fetch from "node-fetch";

const TOKEN = process.env.RAILWAY_TOKEN;
const PROJECT = "lopesul-wifi";
const ENVIRONMENT = "production";
const SERVICE = "lopesul-dashboard";

const vars = {
  RELAY_URL: "http://100.70.133.104:3001/mikrotik",
  MIKROTIK_HOST: "10.200.200.2",
  MIKROTIK_USER: "admin",
  MIKROTIK_PASS: "admin",
};

async function setVariable(key, value) {
  const query = `
    mutation UpsertVariable($input: VariableUpsertInput!) {
      variableUpsert(input: $input) {
        id
        key
        value
      }
    }
  `;

  const body = {
    query,
    variables: {
      input: {
        projectId: PROJECT,
        environmentName: ENVIRONMENT,
        serviceName: SERVICE,
        key,
        value,
      },
    },
  };

  try {
    const response = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (data.errors) {
      console.error(`❌ Erro ao setar ${key}:`, data.errors);
    } else {
      console.log(`✅ ${key} definido com sucesso!`);
    }
  } catch (err) {
    console.error(`💥 Falha geral ao definir ${key}:`, err.message);
  }
}

async function run() {
  for (const [key, value] of Object.entries(vars)) {
    console.log(`🔧 Setando ${key}=${value}`);
    await setVariable(key, value);
  }
}

run();

