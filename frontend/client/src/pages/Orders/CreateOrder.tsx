import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function CreateOrder() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    service_id: '1',
    project_name: '',
    website_url: '',
    amount: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const services = [
    { id: 1, name: 'تحسين محركات البحث (SEO)' },
    { id: 2, name: 'وسائل التواصل الاجتماعي' },
    { id: 3, name: 'تحليل البيانات' },
    { id: 4, name: 'تحسين الموقع' },
    { id: 5, name: 'استشارة جديدة' },
    { id: 6, name: 'ادارة PPC' },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.project_name || !formData.amount) {
      setError('اسم المشروع والميزانية مطلوبان');
      toast.error('اسم المشروع والميزانية مطلوبان');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.createOrder({
        service_id: parseInt(formData.service_id),
        project_name: formData.project_name,
        website_url: formData.website_url || undefined,
        amount: parseFloat(formData.amount),
        notes: formData.notes || undefined,
      });

      if (response.error) {
        setError(response.error);
        toast.error(response.error);
        return;
      }

      toast.success('تم إنشاء الطلب بنجاح!');
      setLocation('/dashboard');
    } catch (err) {
      const errorMsg = 'حدث خطأ أثناء إنشاء الطلب';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <button
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            العودة إلى لوحة التحكم
          </button>
          <h1 className="text-3xl font-bold text-gray-900">طلب جديد</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8">
            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Service Selection */}
              <div>
                <label htmlFor="service_id" className="block text-sm font-medium text-gray-700 mb-2">
                  نوع الخدمة
                </label>
                <select
                  id="service_id"
                  name="service_id"
                  value={formData.service_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  اسم المشروع
                </label>
                <Input
                  type="text"
                  name="project_name"
                  placeholder="مثال: تحسين موقع متجري الإلكتروني"
                  value={formData.project_name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Website URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رابط الموقع (اختياري)
                </label>
                <Input
                  type="url"
                  name="website_url"
                  placeholder="https://example.com"
                  value={formData.website_url}
                  onChange={handleChange}
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الميزانية (بالدولار)
                </label>
                <Input
                  type="number"
                  name="amount"
                  placeholder="1000"
                  value={formData.amount}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ملاحظات (اختياري)
                </label>
                <textarea
                  name="notes"
                  placeholder="أضف أي ملاحظات أو متطلبات خاصة..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  'إنشاء الطلب'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
