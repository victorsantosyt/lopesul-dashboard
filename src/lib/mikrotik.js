// src/lib/mikrotik.js

// === Utils internas ===
async function connectSSH({ host, user, pass, port = 22, privateKey, readyTimeout = 10000 }) {
  // Dynamic import evita que o Next bundle o módulo nativo do ssh2
  const { NodeSSH } = await import("node-ssh");
  const ssh = new NodeSSH();
  const opts = {
    host,
    username: user,
    port,
    readyTimeout,
    tryKeyboard: false,
  };
  if (privateKey) opts.privateKey = privateKey;
  else opts.password = pass;

  try {
    await ssh.connect(opts);
    return ssh;
  } catch (err) {
    try { ssh.dispose(); } catch (_) {}
    throw new Error(`SSH connection failed: ${String(err)}`);
  }
}

async function execWithTimeout(sshClient, cmd, { timeoutMs = 4000 } = {}) {
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try { sshClient.dispose(); } catch (_) {}
  }, timeoutMs);

  try {
    const res = await sshClient.execCommand(cmd, { cwd: "/" });
    const out = (res.stdout || "").trim();
    const err = (res.stderr || "").trim();
    if (timedOut) throw new Error("command timeout");
    return { out, err };
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------
// Aqui mantém todas as tuas funções originais: 
// getStarlinkStatus, revogarAcesso, liberarAcesso, liberarCliente, listPppActive
// -----------------------------------------------------------------

/** Alias: revogarCliente → revogarAcesso */
export async function revogarCliente(options = {}) {
  return revogarAcesso(options);
}

/** Alias: liberarClienteNoMikrotik → liberarAcesso */
export async function liberarClienteNoMikrotik(options = {}) {
  return liberarAcesso(options);
}

// === Export default ===
export default {
  getStarlinkStatus,
  revogarAcesso,
  revogarCliente,            // alias
  liberarAcesso,
  liberarCliente,
  liberarClienteNoMikrotik,  // alias
  listPppActive,
};
