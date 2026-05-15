
import { useState, useEffect } from 'react';

interface PendingPayment {
  order_id: number;
  amount: number;
  project_name: string;
}

export const usePendingPayment = () => {
  const [paymentData, setPaymentData] = useState<PendingPayment | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('pending_payment');
    if (stored) {
      try {
        setPaymentData(JSON.parse(stored));
      } catch (e) {
        console.error('خطأ في قراءة بيانات الدفع', e);
      }
    }
  }, []);

  const clearPendingPayment = () => {
    localStorage.removeItem('pending_payment');
    setPaymentData(null);
  };

  return { paymentData, clearPendingPayment };
};
