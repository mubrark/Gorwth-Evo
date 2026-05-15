import { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowRight, Calendar, DollarSign, Globe, User } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface OrderDetail {
  order_id: number;
  project_name: string;
  website_url?: string;
  amount: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  service_name: string;
  description?: string;
  manager_name?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
  created_at: string;
  invoice_status?: 'pending' | 'paid' | 'overdue';
  invoice_due_date?: string;
}

export default function OrderDetails() {
  const [, setLocation] = useLocation();
  const { id } = useParams<{ id: string }>();
  const order_id =id ? parseInt(id, 10) : NaN;
  if (isNaN(order_id)){
    console.error("غير صالح", order_id);
  }
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrderDetails();
  }, [id]);

  const fetchOrderDetails = async () => {
    setIsLoading(true);
    try {
      // افتراض وجود API لجلب تفاصيل الطلب (يجب إضافته في الخادم)
      const response = await apiClient.getOrderById(parseInt(id));
      if (response.error) {
        toast.error(response.error);
        setLocation('/dashboard');
      } else {
        setOrder(response.data as OrderDetail);
      }
    } catch (err) {
      toast.error('حدث خطأ في جلب تفاصيل الطلب');
      setLocation('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: 'مكتمل',
      in_progress: 'قيد التنفيذ',
      pending: 'قيد الانتظار',
      cancelled: 'ملغى',
    };
    return labels[status] || status;
  };

  const getInvoiceStatusColor = (status?: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getInvoiceStatusLabel = (status?: string) => {
    const labels: Record<string, string> = {
      paid: 'مدفوع',
      pending: 'معلق',
      overdue: 'متأخر',
    };
    return status ? labels[status] : 'غير محدد';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* زر الرجوع */}
        <Button
          variant="ghost"
          onClick={() => setLocation('/dashboard')}
          className="mb-6 flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى لوحة التحكم
        </Button>

        {/* عنوان الطلب */}
        <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{order.project_name}</h1>
            <p className="text-gray-600 mt-1">{order.service_name}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}
          >
            {getStatusLabel(order.status)}
          </span>
        </div>

        {/* بطاقات المعلومات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              معلومات الدفع
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">الميزانية:</span>
                <span className="font-bold text-gray-900">${order.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">حالة الفاتورة:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(
                    order.invoice_status
                  )}`}
                >
                  {getInvoiceStatusLabel(order.invoice_status)}
                </span>
              </div>
              {order.invoice_due_date && (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ الاستحقاق:</span>
                  <span className="text-gray-900">
                    {new Date(order.invoice_due_date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              تواريخ المشروع
            </h2>
            <div className="space-y-3">
              {order.start_date ? (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ البدء:</span>
                  <span className="text-gray-900">
                    {new Date(order.start_date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ البدء:</span>
                  <span className="text-gray-500 italic">لم يبدأ بعد</span>
                </div>
              )}
              {order.end_date ? (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ الانتهاء:</span>
                  <span className="text-gray-900">
                    {new Date(order.end_date).toLocaleDateString('ar-EG')}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between">
                  <span className="text-gray-600">تاريخ الانتهاء:</span>
                  <span className="text-gray-500 italic">غير محدد</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">تاريخ الإنشاء:</span>
                <span className="text-gray-900">
                  {new Date(order.created_at).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>
          </Card>

          {order.website_url && (
            <Card className="p-6 md:col-span-2">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                معلومات الموقع
              </h2>
              <a
                href={order.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {order.website_url}
              </a>
            </Card>
          )}

          {order.manager_name && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                مدير المشروع
              </h2>
              <p className="text-gray-900">{order.manager_name}</p>
            </Card>
          )}

          {order.notes && (
            <Card className="p-6 md:col-span-2">
              <h2 className="text-lg font-semibold mb-2">ملاحظات إضافية</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </Card>
          )}
        </div>

        {/* وصف الخدمة */}
        {order.description && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold mb-3">وصف الخدمة</h2>
            <p className="text-gray-700">{order.description}</p>
          </Card>
        )}

        {/* زر الدفع */}
        {order.status === 'pending' && order.invoice_status !== 'paid' && (
          <div className="flex justify-center mt-8">
            <Button
              onClick={() => setLocation(`/order/${order.order_id}/payment`)}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-6 text-lg flex items-center gap-2"
            >
              ادفع الآن (${order.amount})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
