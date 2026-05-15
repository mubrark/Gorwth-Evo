import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';


export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    phone: '',
    country:'',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  
    const [fullNumber, setFullNumber] = useState<string>('');
    const [countryName, setCountryName] = useState<string>('');

    const conutries = [
    { code: "+966", name:"السعودية"},
    { code: "+249", name:"السودان"},
    { code: "+971", name:"الامارات"},
    { code: "+20", name:"مصر"},
    { code: "+961", name:"لبنان"},
    { code: "+962", name:"الاردن"},
    { code: "+1", name:"الولايات المتحدة الامركية"},
  ];

    const findCountryByCode = (inputCode: string): string => {
      const country = conutries.find((c) => inputCode.startsWith(c.code));
      return country ? country?.name : "";
    };

    const extractCountryCode = (number: string): string => {
      for (const country of conutries) {
        if (number.startsWith(country.code)) {
          return country?.code;
        }
      }
      return '';
    };

    const handleFullNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setFullNumber(newValue);

      const extractedCode = extractCountryCode(newValue);
      if (extractedCode) {
        const foundName = findCountryByCode(extractedCode);
        setCountryName(foundName);
      } else {
        setCountryName('');
      }
    };


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setError('جميع الحقول مطلوبة');
      toast.error('جميع الحقول مطلوبة');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      toast.error('كلمات المرور غير متطابقة');
      return;
    }

    if (formData.password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.register({
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        password: formData.password,
        company_name: formData.company_name || undefined,
        phone: formData.phone || undefined,
        country: formData.country || undefined,
      });

      if (response.error) {
        setError(response.error);
        toast.error(response.error);
        return;
      }
      if (response.data?.token && response.data?.user) {
        login(response.data.user as any, response.data.token);
        toast.success('تم إنشاء الحساب بنجاح!');
        setLocation('/dashboard');
      }
    } catch (err) {
      const errorMsg = 'حدث خطأ أثناء إنشاء الحساب';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">SEO</h1>
            <p className="text-gray-600">إنشاء حساب جديد</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم الأخير
                </label>
                <Input
                  type="text"
                  name="last_name"
                  placeholder="محمد"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  الاسم الأول
                </label>
                <Input
                  type="text"
                  name="first_name"
                  placeholder="أحمد"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Phone Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                رقم الهاتف (اختياري)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  name="phone"
                  placeholder="+249xxxxxxxxx"
                  value={fullNumber}
                  onChange={handleFullNumberChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Country Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                الدولة (اختياري)
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  name="country"
                  placeholder="دولتك"
                  value={countryName}
                  onChange={handleFullNumberChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Company Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                اسم الشركة (اختياري)
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  name="company_name"
                  placeholder="شركتك"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                تأكيد كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  type="password"
                  name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="pl-10"
                  required
                />
              </div>
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
                  جاري التحميل...
                </>
              ) : (
                'إنشاء حساب'
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-gray-600 text-sm">
            لديك حساب بالفعل؟{' '}
            <button
              onClick={() => setLocation('/login')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              تسجيل الدخول
            </button>
          </p>
        </div>
      </Card>
    </div>
  );
 }
