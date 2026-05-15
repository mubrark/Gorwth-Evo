import { useState, useEffect } from 'react';
import { useSearchParams, useLocation, Link } from 'wouter';
import { apiClient } from '../../lib/api';

export default function resetpassword () {
  const [searchParams] = useSearchParams();
  const [, setLocation] = useLocation();
  const token = searchParams.get('token');
  
  const [newPassword, setNewPassword] = useState('');
  //const [userId, setuserId ] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('رابط إعادة التعيين غير صالح أو منتهي الصلاحية');
    }
  }, [token]);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';
    }
    if (!/[A-Z]/.test(password)) {
      return 'يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل';
    }
    if (!/[a-z]/.test(password)) {
      return 'يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل';
    }
    if (!/[0-9]/.test(password)) {
      return 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('الرابط غير صالح');
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور غير متطابقة');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.resetPassword({
        resetToken: token,
        newPassword: newPassword,
      });
      
      setMessage(response.message || 'تم إعادة تعيين كلمة المرور بنجاح');
      
      // الانتقال إلى صفحة تسجيل الدخول بعد 3 ثوانٍ
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
      
    } catch (err: any) {
      setError(err.message || 'فشل إعادة تعيين كلمة المرور، الرجاء المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  if (!token && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
          <div className="text-center">
            <Link to="/reset-password" className="text-blue-600 hover:text-blue-500">
              طلب رابط جديد
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            إعادة تعيين كلمة المرور
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            الرجاء إدخال كلمة مرور جديدة قوية
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                كلمة المرور الجديدة
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="********"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center"
                >
                  <span className="text-sm text-gray-600">
                    {showPassword ? 'إخفاء' : 'إظهار'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                تأكيد كلمة المرور
              </label>
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="********"
                dir="ltr"
              />
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <p>يجب أن تحتوي كلمة المرور على:</p>
            <ul className="list-disc list-inside mr-4">
              <li>8 أحرف على الأقل</li>
              <li>حرف كبير واحد</li>
              <li>حرف صغير واحد</li>
              <li>رقم واحد</li>
            </ul>
          </div>

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{message}</div>
              <div className="text-xs text-green-600 mt-1">
                جاري التحويل إلى صفحة تسجيل الدخول...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || !token}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري إعادة التعيين...' : 'إعادة تعيين كلمة المرور'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
