import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, Phone, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { toast } from 'sonner';

export default function Contact() {
  const [, setLocation ] = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      setError('جميع الحقول المطلوبة يجب ملؤها');
      toast.error('جميع الحقول المطلوبة يجب ملؤها');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.sendContactMessage({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
      });

      if (response.error) {
        setError(response.error);
        toast.error(response.error);
        return;
      }

      setSuccess(true);
      toast.success('تم إرسال رسالتك بنجاح!');
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
      });

      setTimeout(() => setSuccess(false), 5001);
    } catch (err) {
      const errorMsg = 'حدث خطأ أثناء إرسال الرسالة';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">تواصل معنا</h1>
          <p className="text-gray-600 mt-2">نحن هنا للإجابة على أسئلتك والمساعدة في احتياجاتك</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Contact Info Cards */}
          <Card className="p-6 text-center">
            <Mail className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">البريد الإلكتروني</h3>
            <p className="text-gray-600">support@seo.com</p>
          </Card>
          <Card className="p-6 text-center">
            <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">الهاتف</h3>
            <p className="text-gray-600">+249 11 970 6815</p>
            <p className="text-gray-600">+249 11 111 1123</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white mx-auto mb-4 text-xl">
              ⏰
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">ساعات العمل</h3>
            <p className="text-gray-600">السبت - الخميس: 9 صباحاً - 6 مساءً</p>
          </Card>
        </div>

        {/* Contact Form */}
        <div className="max-w-2xl mx-auto">
          <Card className="p-8">
            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-700">تم إرسال رسالتك بنجاح! سنرد عليك قريباً</p>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم
                </label>
                <Input
                  type="text"
                  name="name"
                  placeholder="أحمد محمد"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  البريد الإلكتروني
                </label>
                <Input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  رقم الهاتف (اختياري)
                </label>
                <Input
                  type="tel"
                  name="phone"
                  placeholder="+249 xxxx xxx xx"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الموضوع
                </label>
                <Input
                  type="text"
                  name="subject"
                  placeholder="موضوع الرسالة"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الرسالة
                </label>
                <textarea
                  name="message"
                  placeholder="اكتب رسالتك هنا..."
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
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
                    جاري الإرسال...
                  </>
                ) : (
                  'إرسال الرسالة'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
