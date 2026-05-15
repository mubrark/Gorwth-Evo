/**
 * خادم SEO الخلفي
 * 
 * المميزات:
 * - نظام مصادقة JWT
 * - تكامل Stripe للدفع
 * - إدارة المستخدمين
 * - معالجة النماذج
 * - إرسال البريد الإلكتروني
 * - معالجة الأخطاء
 */


import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';

// استيراد الخدمات
import { UserService } from './src/services/UserService';
import { PaymentService } from './src/services/PaymentService';
import { FormService } from './src/services/FormService';

dotenv.config({ override: true });

const app: Express = express();
const PORT = process.env.PORT || 5001;

// =====================================================
// إعدادات الأمان
// =====================================================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'عدد الطلبات كثير جداً، يرجى المحاولة لاحقاً'
});
app.use(limiter);

// =====================================================
// Middleware عام
// =====================================================
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// معالجة JSON (مع الاحتفاظ بـ raw body للـ webhook)
app.use(express.json({ limit: '10mb' }));
app.use(express.json({ verify: (req, res, buf) => { (req as any).rawBody = buf; } }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// =====================================================
// قاعدة البيانات
// =====================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'seo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// =====================================================
// البريد الإلكتروني
// =====================================================
let transporter: nodemailer.Transporter | null = null;
if (process.env.DISABLE_EMAIL !== 'true') {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'localhost',
    port: parseInt(process.env.EMAIL_PORT || '1025'),
    secure: process.env.EMAIL_SECURE === 'true',
    ignoreTLS: process.env.EMAIL_IGNORETLS === 'true',
    auth: process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
      : undefined
  });
  transporter.verify()
    .then(() => console.log('✅ SMTP server ready'))
    .catch(err => console.warn('⚠️ SMTP not available:', err.message));
} else {
  console.log('📧 Email disabled by configuration');
}

// =====================================================
// تهيئة الخدمات
// =====================================================
const userService = new UserService(pool, transporter, process.env.JWT_SECRET || 'secret');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2025-02-24' as any });
const paymentService = new PaymentService(stripe, pool);
const formService = new FormService(pool, transporter);

// =====================================================
// Middleware المصادقة
// =====================================================
interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    user_type: string;
  };
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'التوكن غير موجود' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded as any;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'التوكن غير صحيح' });
  }
};

// =====================================================
// مسارات المصادقة والمستخدمين
// =====================================================

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const result = await userService.register(req.body);
    return res.status(201).json({
      message: 'تم التسجيل بنجاح',
      token: result.token,
      user: {
        user_id: result.user_id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name
      }
    });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const result = await userService.login(req.body);
    return res.status(200).json({
      message: 'تم تسجيل الدخول بنجاح',
      token: result.token,
      user: {
        user_id: result.user_id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name,
        user_type: result.user_type,
        company_name: result.company_name
      }
    });
  } catch (error: any) {
    return res.status(401).json({ error: error.message });
  }
});

app.post('/api/auth/refresh-token', authMiddleware, (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  const newToken = jwt.sign(
    { user_id: req.user.user_id, email: req.user.email, user_type: req.user.user_type },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '7d' }
  );
  return res.status(200).json({ token: newToken });
});

app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const result = await userService.requestPasswordReset(req.body.email);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
  try {
    const result = await userService.resetPassword(req.body);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.get('/api/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== 'admin')
      return res.status(403).json({ error: 'غير مصرح' });
    const user = await userService.getUserById(userId);
    return res.status(200).json(user);
  } catch (error: any) {
    return res.status(404).json({ error: error.message });
  }
});

app.put('/api/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== 'admin')
      return res.status(403).json({ error: 'غير مصرح' });
    await userService.updateProfile(userId, req.body);
    return res.status(200).json({ message: 'تم تحديث البيانات بنجاح' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.post('/api/users/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
    await userService.changePassword(req.user.user_id, req.body);
    return res.status(200).json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== 'admin')
      return res.status(403).json({ error: 'غير مصرح' });
    await userService.deleteUser(userId);
    return res.status(200).json({ message: 'تم حذف الحساب بنجاح' });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// =====================================================
// مسارات الخدمات (المنتجات)
// =====================================================
app.get('/api/services', async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [services] = await connection.execute(
        `SELECT service_id, service_name, service_code, description, category, base_price, duration_days, features, benefits 
        FROM services 
        WHERE is_active = TRUE`
      );
      return res.status(200).json(services);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الخدمات' });
  }
});

app.get('/api/services/:id', async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [services] = await connection.execute(
        'SELECT * FROM services WHERE service_id = ? AND is_active = TRUE',
        [req.params.id]
      );
      if ((services as any[]).length === 0) return res.status(404).json({ error: 'الخدمة غير موجودة' });
      return res.status(200).json((services as any[])[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الخدمة' });
  }
});

// =====================================================
// مسارات الطلبات
// =====================================================
app.get('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const connection = await pool.getConnection();
    try {
      const [orders] = await connection.execute(
        `SELECT o.order_id, o.user_id, o.project_name, o.website_url, o.amount, o.status,
                o.start_date, o.end_date, s.service_name
         FROM orders o JOIN services s ON o.service_id = s.service_id
         WHERE o.user_id = ? ORDER BY o.created_at DESC`,
        [req.user.user_id]
      );
      return res.status(200).json(orders);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب الطلبات او لا توجد' });
  }
});

app.post('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  const { service_id, project_name, website_url, amount, notes } = req.body;
  if (!service_id || !project_name || !amount)
    return res.status(400).json({ error: 'البيانات المطلوبة غير موجودة' });
  try {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO orders (user_id, service_id, project_name, website_url, amount, status, notes)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [req.user.user_id, service_id, project_name, website_url || null, amount, notes || null]
      );
      return res.status(201).json({ message: 'تم إنشاء الطلب', order_id: (result as any).insertId });
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في إنشاء الطلب' });
  }
});

app.get('/api/orders/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });

    const connection = await pool.getConnection();
    try {
      const [orders] = await connection.execute(
        `SELECT o.order_id, o.project_name, o.website_url, o.amount, o.status, 
        s.service_name, s.description,
         o.start_date, o.end_date, o.notes, s.service_name, 
         i.invoice_ststus, i.invoice_due_date, m.manager_name 
         FROM orders o 
         JOIN services s ON o.service_id = s.service_id 
         JOIN invoices i ON o.order_id = i.order_id
         JOIN account_managers m ON o.manager_id = m.manager_id
         WHERE o.order_id = ? AND o.user_id = ?`,
        [req.params.id, req.user.user_id]
      );
      if (!Array.isArray(orders) || orders.length === 0) 
        return res.status(404).json({ error: 'الطلب غير موجود' });
      return res.status(200).json(orders[0]);
    } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب تفاصيل الطلب' });
  } finally {
      connection.release();
  }
});

app.get('/api/orders/:id/summary', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  try {
    const connection = await pool.getConnection();
    try {
      const [orders] = await connection.execute(
        `SELECT o.order_id, o.project_name, o.amount, s.service_name
         FROM orders o JOIN services s ON o.service_id = s.service_id
         WHERE o.order_id = ? AND o.user_id = ? AND o.status = 'pending'`,
        [req.params.id, req.user.user_id]
      );
      if ((orders as any[]).length === 0) return res.status(404).json({ error: 'لا يمكن الدفع لهذا الطلب' });
      return res.status(200).json((orders as any[])[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: 'خطأ في جلب ملخص الطلب' });
  }
});

// =====================================================
// المسارات - الباقات (packages)
// =====================================================

/**
 * الحصول على قائمة الباقات النشطة
 * GET /api/packages
 */
app.get('/api/packages', async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [packages] = await connection.execute(
        `SELECT package_id, package_name, package_code, description, price, duration_days, included_services, is_active, created_at, updated_at 
        FROM packages 
        WHERE is_active = TRUE
        ORDER BY price ASC`
      );
      return res.status(200).json(packages);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('خطأ في الحصول على الباقات:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

/**
 * الحصول على باقة محددة
 * GET /api/packages/:id
 */
app.get('/api/packages/:id', async (req: Request, res: Response) => {
  try {
    const packageId = req.params.id;
    const connection = await pool.getConnection();
    try {
      const [packages] = await connection.execute(
        `SELECT package_id, package_name, package_code, description, price, duration_days, included_services, is_active
         FROM packages
         WHERE id = ? AND is_active = TRUE`,
        [packageId]
      );
      if ((packages as any[]).length === 0) {
        return res.status(404).json({ error: 'الباقة غير موجودة' });
      }
      return res.status(200).json((packages as any[])[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('خطأ في الحصول على الباقة:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// =====================================================
// المسارات - الآراء (reviews)
// =====================================================

/**
 * جلب الآراء المقبولة مع الإحصائيات
 * GET /api/reviews
 */
app.get('/api/reviews', async (req: Request, res: Response) => {
  try {
    const connection = await pool.getConnection();
    try {
      // جلب قائمة الآراء المقبولة
      const [reviewsRows] = await connection.execute<any[]>(
        `SELECT review_id, user_id, name, company, rating, comment, created_at, updated_at
         FROM reviews 
         WHERE is_published = TRUE 
         ORDER BY created_at DESC
         LIMIT 20`
      );

      // حساب الإحصائيات
      const [statsRows] = await connection.execute<any[]>(
        `SELECT 
           COUNT(*) as total_reviews,
           AVG(rating) as average_rating,
           SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
           SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
           SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
           SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
           SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
         FROM reviews
         WHERE is_published = TRUE`
      );

      const stats = statsRows[0];

      return res.status(200).json({
        reviews: reviewsRows,
        stats: {
          totel_reviews: stats.total_reviews || 0,
          average_rating: Number(stats.average_rating) || 0,
          five_star: stats.five_star || 0,
          four_star: stats.four_star || 0,
          three_star: stats.three_star || 0,
          two_star: stats.two_star || 0,
          one_star: stats.one_star || 0,
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('خطأ في جلب الآراء:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

/**
 * إضافة رأي جديد (يحتاج موافقة لاحقة)
 * POST /api/reviews
 */
app.post('/api/reviews', async (req: Request, res: Response) => {
  try {
    const { name, company, rating, comment } = req.body;

    // التحقق من البيانات
    if (!name || !rating || !comment) {
      return res.status(400).json({ error: 'الاسم والتقييم والنص مطلوبة' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'التقييم يجب أن يكون بين 1 و 5' });
    }
    if (comment.length < 5) {
      return res.status(400).json({ error: 'نص الرأي قصير جداً' });
    }

    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO reviews (name, company, rating, comment, is_published) 
         VALUES (?, ?, ?, ?, FALSE)`,
        [name, company || null, rating, comment]
      );

      // إرسال إشعار للمشرف (اختياري)
      if (transporter) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || 'noreply@seo.com',
          to: process.env.SUPPORT_EMAIL || 'admin@seo.com',
          subject: 'رأي جديد بانتظار الموافقة',
          html: `<h3>رأي جديد من ${name}</h3><p>${comment}</p><p>التقييم: ${rating} نجوم</p>`
        }).catch(console.error);
      }

      return res.status(201).json({ 
        message: 'تم إرسال رأيك بنجاح، سينشر بعد المراجعة',
        review_id: (result as any).insertId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('خطأ في إضافة الرأي:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// =====================================================
// مسارات الدفع (Stripe)
// =====================================================
app.post('/api/payments/create-intent', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  const { order_id, amount } = req.body;
  if (!order_id || !amount) return res.status(400).json({ error: 'order_id و amount مطلوبان' });
  try {
    const result = await paymentService.createPaymentIntent({
      orderId: order_id,
      amount,
      userId: req.user.user_id
    });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'غير مصرح' });
  const { payment_intent_id, order_id } = req.body;
  try {
    const result = await paymentService.confirmPayment({
      paymentIntentId: payment_intent_id,
      orderId: order_id,
      userId: req.user.user_id
    });
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// Webhook Stripe (بدون مصادقة، يحتاج raw body)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event;
  try {
    event = stripe.webhooks.constructEvent((req as any).rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    await paymentService.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// =====================================================
// مسارات النماذج (الاتصال)
// =====================================================
app.post('/api/contact', async (req: Request, res: Response) => {
  try {
    const result = await formService.handleContactForm(req.body);
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// مسار إضافي للرد على الرسائل (للمسؤولين)
app.post('/api/contact/reply/:messageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  if (req.user?.user_type !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  try {
    const result = await formService.replyToMessage(parseInt(req.params.messageId), req.body.reply);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

// =====================================================
// معالجة الأخطاء العامة
// =====================================================
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'بيانات غير صحيحة' });
  if (err.name === 'UnauthorizedError') return res.status(401).json({ error: 'غير مصرح' });
  return res.status(500).json({ error: 'خطأ في الخادم' });
};
app.use(errorHandler);

// =====================================================
// بدء الخادم
// =====================================================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📧 Email: ${process.env.EMAIL_USER || 'disabled'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`🗄️ Database: ${process.env.DB_NAME}`);
});

export default app;
