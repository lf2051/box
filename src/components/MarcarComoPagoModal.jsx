import React, { useState } from 'react';
import { X, CheckCircle, Calendar, CreditCard, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const getLocalDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateBr = (raw) => {
  if (!raw) return '-';
  const value = String(raw);
  const dateKey = value.includes('T') ? value.split('T')[0] : value;
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${day}/${month}/${year}`;
};

const MarcarComoPagoModal = ({ isOpen, onClose, conta, contas = [], onConfirm }) => {
  const [formData, setFormData] = useState({
    dataPagamento: getLocalDateKey(new Date()),
    formaPagamento: 'Dinheiro',
    observacoes: ''
  });

  const list = contas && contas.length > 0 ? contas : (conta ? [conta] : []);
  const isBulk = list.length > 1;
  const totalValue = list.reduce((acc, c) => acc + (parseFloat(c.valor) || 0), 0);

  if (!isOpen || list.length === 0) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isBulk) {
      onConfirm(list, {
        ...formData
      });
    } else {
      const single = list[0];
      onConfirm(single.id, {
        ...formData,
        clienteName: single.cliente?.nome
      });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl w-full max-w-md border border-gray-700 shadow-2xl"
        >
          <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-[#2a3a4a] rounded-t-xl">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-[#00d084]" />
              MARCAR COMO PAGO
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="bg-[#2a3a4a]/50 p-4 rounded-lg border border-gray-700 space-y-2">
              {isBulk ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Selecionadas</span>
                    <span className="text-white font-medium">{list.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Valor Total</span>
                    <span className="text-[#00d084] font-bold text-lg">R$ {totalValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Clientes</span>
                    <span className="text-white font-mono text-sm">Vários</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Cliente</span>
                    <span className="text-white font-medium">{list[0].cliente?.nome || 'Cliente Desconhecido'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Valor</span>
                    <span className="text-[#00d084] font-bold text-lg">R$ {parseFloat(list[0].valor).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Vencimento</span>
                    <span className="text-white font-mono text-sm">
                      {formatDateBr(list[0].data_vencimento)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00d084]" /> Data do Pagamento
              </label>
              <input
                type="date"
                required
                value={formData.dataPagamento}
                onChange={(e) => setFormData({...formData, dataPagamento: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none focus:ring-1 focus:ring-[#00d084]"
              />
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" /> Forma de Pagamento
              </label>
              <select
                value={formData.formaPagamento}
                onChange={(e) => setFormData({...formData, formaPagamento: e.target.value})}
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none"
              >
                <option value="Dinheiro">Dinheiro</option>
                <option value="Pix">Pix</option>
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
                <option value="Cheque">Cheque</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" /> Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                rows="3"
                className="w-full bg-[#0f172a] border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:border-[#00d084] focus:outline-none resize-none"
                placeholder="Detalhes opcionais sobre o pagamento..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-[#00d084] hover:bg-[#00b872] text-white font-bold">
                Confirmar Recebimento
              </Button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default MarcarComoPagoModal;
