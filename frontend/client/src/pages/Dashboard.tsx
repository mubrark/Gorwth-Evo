import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, LogOut, Plus, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';


interface Order {
  order_id: number;
  user_id: number;
  project_name: string;
  website_url?: string;
  amount: number;
  status: string;
  service_name: string;
  manager_name: string;
}

export default function Dashboard() {
  
  const [, setLocation ] = useLocation();
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const totel=`${orders.reduce((sum, o) => sum + o.amount, 0)}`


  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getOrders();
      if (response.error) {
        toast.error(response.error);
      } else {
        setOrders((response.data as Order[]) || []);
      }
    } catch (err) {
      toast.error('حدث خطأ في جلب الطلبات');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('تم تسجيل الخروج بنجاح');
    setLocation('/login');
  };

  
  const handlePayment = (orderId: number, amount: number) => {
    // تخزين بيانات الدفع في sessionStorage (تُحذف عند إغلاق التبويب)
    sessionStorage.setItem('pending_payment', JSON.stringify({
    order_id: orderId,
    amount: amount,
    initiated_at: Date.now()
  }));
  // انتقل إلى صفحة الدفع الموحدة
  setLocation('/payment/initiate');
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
    const labels: { [key: string]: string } = {
      completed: 'مكتمل',
      in_progress: 'قيد التنفيذ',
      pending: 'قيد الانتظار',
      cancelled: 'ملغى',
    };
    return labels[status] || status;
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <Button
              onClick={() => setLocation('/')}
              variant="outline"
              style={{background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                font: 'inherit',
                color: 'white',
                cursor: 'pointer',
                
              }}
            >
             <h1 className="text-3xl font-bold text-blue-700">SEO</h1>
            </Button>
        </div>
      </nav>

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
            <p className="text-gray-600 mt-1">
              مرحباً {user.first_name} {user.last_name}
            </p>
          </div>
          <Button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <p className="text-gray-600 text-sm mb-2">إجمالي الطلبات</p>
            <p className="text-3xl font-bold text-blue-600">{orders.length}</p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-600 text-sm mb-2">قيد التنفيذ</p>
            <p className="text-3xl font-bold text-blue-600">
              {orders.filter((o) => o.status === 'in_progress').length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-600 text-sm mb-2">المكتملة</p>
            <p className="text-3xl font-bold text-green-600">
              {orders.filter((o) => o.status === 'completed').length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-gray-600 text-sm mb-2">الميزانية الإجمالية</p>
            <p className="text-3xl font-bold text-purple-600">
              ${totel}
            </p>
          </Card>
        </div>

        {/* Orders Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            
            <Button
              onClick={() => setLocation('/create-order')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4" />
              طلب جديد
            </Button>
            
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : orders.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-600 mb-4">لا توجد طلبات حالياً</p>
              <Button
                onClick={() => setLocation('/create-order')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                إنشاء طلب جديد
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {orders.map((order) => (
                <Card key={order.order_id} className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{order.project_name}</h3>
                      <p className="text-gray-600 text-sm mt-1">{order.service_name}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-gray-600 text-sm">الميزانية</p>
                      <p className="text-lg font-semibold text-gray-900">${order.amount}</p>
                    </div>
                    {order.manager_name && (
                      <div>
                        <p className="text-gray-600 text-sm">مدير المشروع</p>
                        <p className="text-lg font-semibold text-gray-900">{order.manager_name}</p>
                      </div>
                    )}
                    {order.website_url && (
                      <div>
                        <p className="text-gray-600 text-sm">الموقع</p>
                        <p className="text-sm text-blue-600 truncate">{order.website_url}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setLocation(`/OrderDetails?order_id=${order.order_id}&user_id=${order.user_id}`)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm"
                    >
                      <Eye className="w-4 h-4" />
                      عرض التفاصيل
                    </Button>        
                      
                    {order.status === 'pending' && (
                     <Button
                          onClick={() => {
                         // تخزين بيانات الدفع في localStorage قبل التوجيه
                          localStorage.setItem('pending_payment', JSON.stringify({
                           order_id: order.order_id,
                           amount: order.amount,
                           project_name: order.project_name,
                           }));
                         setLocation('/create-intent');  // التوجيه إلى صفحة إنشاء الدفع
                        }}
                         className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm"
                         >
                        دفع
                     </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/*
<Button
              onClick={() => setLocation('/admin-reviews')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4" />
              ادارة الاراء
            </Button>
            <Button
              onClick={() => setLocation('/dashboardpagepayment')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4" />
              ادارة الدفع
            </Button>*/