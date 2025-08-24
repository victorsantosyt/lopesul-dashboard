'use client';
import { useState, useEffect, useRef } from 'react';
import { criarCheckout, verificarPorExternalId } from '@/lib/client/pagamentos';

export default function PixCheckoutButton({
  valor = 9.90,
  descricao = 'Acesso Wi-Fi',
  clienteIp,
  clienteMac,
  pollIntervalMs = 3000,
}) {
  const [loading, setLoading] = useState(false);
  const [externalId, setExternalId] = useState(null);
  const [copiaECola, setCopiaECola] = useState('');
  const [status, setStatus] = useState('inicial');
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function startCheckout() {
    try {
      setLoading(true);
      setStatus('criando');
      const r = await criarCheckout({ valor, descricao, clienteIp, clienteMac });
      setExternalId(r.externalId);
      setCopiaECola(r.copiaECola || '');
      setStatus('pendente');

      // inicia polling
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(async () => {
        try {
          const v = await verificarPorExternalId(r.externalId);
          if (v?.pago) {
            setStatus('pago');
            clearInterval(timerRef.current);
          } else if (v?.status === 'expirado' || v?.status === 'cancelado') {
            setStatus(v.status);
            clearInterval(timerRef.current);
          }
        } catch (e) {
          console.warn('poll verificar falhou:', e?.message || e);
        }
      }, pollIntervalMs);
    } catch (e) {
      console.error(e);
      setStatus('erro');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Plano</div>
          <div className="font-semibold">{descricao}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">Valor</div>
          <div className="font-semibold">
            {Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)}
          </div>
        </div>
      </div>

      <button
        className="w-full rounded-xl bg-black text-white py-2 disabled:opacity-50"
        onClick={startCheckout}
        disabled={loading || status === 'pendente' || status === 'pago'}
      >
        {loading ? 'Gerando Pix...' : status === 'pago' ? 'Pago ✅' : 'Pagar com Pix'}
      </button>

      {copiaECola && status !== 'pago' && (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Copia e Cola Pix</div>
          <textarea
            readOnly
            className="w-full h-28 p-2 border rounded-md text-sm"
            value={copiaECola}
            onFocus={e => e.target.select()}
          />
          <div className="text-xs text-gray-500">
            Status: <span className="font-medium">{status}</span>
            {externalId ? ` • Ref: ${externalId}` : ''}
          </div>
        </div>
      )}

      {status === 'pago' && (
        <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm">
          Pagamento confirmado! Acesso liberado.
        </div>
      )}
    </div>
  );
}
