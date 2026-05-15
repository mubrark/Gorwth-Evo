import { useState } from 'react';
import { useLocation } from 'wouter';
import { apiClient} from '../../lib/api';

export default function reset_password () {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('الرجاء إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiClient.requestPasswordReset(email);
      setMessage(response.message || 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني');
      
      // مسح الحقل بعد النجاح
      setEmail('');
      
    } catch (err: any) {
      setError(err.message || 'حدث خطأ، الرجاء المحاولة لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            نسيت كلمة المرور؟
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="sr-only">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="البريد الإلكتروني"
              dir="ltr"
            />
          </div>

          {message && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{message}</div>
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
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => setLocation('/register')}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              إنشاء حساب جديد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};