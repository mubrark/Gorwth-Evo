/**
 * API Client Utility
 * يدير جميع استدعاءات API مع معالجة التوكن والأخطاء
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
  token?: string;
  client_secret?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(includeAuth: boolean = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: any,
    includeAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const options: RequestInit = {
        method,
        headers: this.getHeaders(includeAuth),
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json();
        return {
          error: errorData.error || `خطأ ${response.status}`,
        };
      }

      const data = await response.json();
      return {data};
    } catch (error) {
      console.error('API Error:', error);
      return {
        error: 'حدث خطأ في الاتصال بالخادم',
      };
    }
  } 
 
  // Auth APIs
  async register(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    company_name?: string;
    phone?: string;
    country?: string;
  }) {
    return this.request<{ token: string; user: any }>('/api/auth/register', 'POST', userData, false);
  }

  async login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('/api/auth/login', 'POST', { email, password }, false);
  }

  async changePassword(data: {userId: number, oldPassword: string, newPassword: string}) {
    return this.request<{ user: any }>('/api/users/change-password', 'POST', { data }, false);
  }

 async requestPasswordReset(email: string) {
    return this.request<{ token: string; user: any }>('/api/auth/forgot-password', 'POST', { email }, false);
  }

  // تنفيذ إعادة التعيين
 async resetPassword(data: {resetToken: string; newPassword: string}) {
    return this.request<{ token: string; user: any }>('/api/auth/reset-password', 'POST', { data }, false);
  }

  async updateProfile(email: string, password: string) {
    return this.request<{ user: any }>('/api/auth/login', 'POST', { email, password }, false);
  }

  async refreshToken() {
    return this.request('/api/auth/refresh-token', 'POST', {});
  }

  // Orders APIs
  async getOrders() {
    return this.request('/api/orders', 'GET');
  }

  async getOrderById(order_id: number) {
    return this.request(`/api/orders/${order_id}`, 'GET');
  }
  
  // Orders Summary
  async getOrderSummary(order_id: number) {
    return this.request(`/api/orders/${order_id}/summary`, 'GET')
  }

  async createOrder(orderData: {
    service_id: number;
    project_name: string;
    website_url?: string;
    amount: number;
    notes?: string;
  }) {
    return this.request('/api/orders', 'POST', orderData);
  }

  async getTestimonials(){
    return this.request<{ reviews: any[]; stats: any }>('/api/reviews', 'GET');
  }

  async addTestimonial(data: { name: string; company?: string; rating: number; comment: string}) {
    return this.request('/api/reviews', 'POST', data, false);
  }


/*
// Pay APIs
async createPayment(order_id: number, amount: number, description?: string) {
  return this.request<{ clientSecret: string; paymentIntentId: string; amount: number; currency: string }>('/api/payments/create-intent', 'POST', { order_id, amount, user_id: 1, description });
}


async confirmPayment(paymentIntentId: string, orderId: number) {
  return this.request<{ message: string }>(
    '/api/payments/confirm',
    'POST',
    { paymentIntentId, orderId, userId: 1 }
  );
}

async refundPayment(paymentIntentId: string, orderId: number, reason?: string) {
  return this.request<{ message: string }>(
    '/api/payments/refund',
    'POST',
    { paymentIntentId, orderId, reason }
  );
}

async getPaymentStatus(paymentIntentId: string) {
  return this.request<{ id: string; status: string; amount: number; currency: string; created: string }>(
    `/api/payments/status/${paymentIntentId}`,
    'GET'
  );
}

async getInvoices(userId: number) {
  return this.request<any[]>(`/api/payments/invoices?userId=${userId}`, 'GET');
}

async generateInvoicePDF(invoiceId: number): Promise<Blob> {
  const url = `${this.baseUrl}/api/payments/invoice-pdf/${invoiceId}`;
  const token = getAuthToken();
  const response = await fetch(url, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  if (!response.ok) {
    throw new Error('فشل إنشاء PDF');
  }
  return await response.blob();
}
*/

  // Contact APIs
  async sendContactMessage(contactData: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }) {
    return this.request('/api/contact', 'POST', contactData, false);
  }

}

export const apiClient = new ApiClient();

// Helper functions
export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
};

/*export interface RequestResetResponse {
  message: string;
  success: boolean;
}

export interface ResetPasswordResponse {
  message: string;
  success: boolean;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}*/

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};