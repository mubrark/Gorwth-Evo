/**
 * خادم SEO الخلفي
 *
 * تاريخ الإنشاء: 22 يناير 2026
 * الإصدار: 1.0
 *
 * المميزات:
 * - نظام مصادقة JWT
 * - تكامل Stripe للدفع
 * - إدارة المستخدمين
 * - معالجة النماذج
 * - إرسال البريد الإلكتروني
 * - معالجة الأخطاء
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import Stripe from 'stripe';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// تحميل متغيرات البيئة
dotenv.config();
// إنشاء تطبيق Express
const app = express();
const PORT = process.env.PORT || 5001;
// =====================================================
// إعدادات الأمان
// =====================================================
// استخدام Helmet لتحسين الأمان
app.use(helmet());
// تحديد معدل الطلبات
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 100, // 100 طلب لكل IP
    message: 'عدد الطلبات كثير جداً، يرجى المحاولة لاحقاً'
});
app.use(limiter);
// =====================================================
// إعدادات Middleware
// =====================================================
// السماح بـ CORS
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// معالجة JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// =====================================================
// إعدادات قاعدة البيانات
// =====================================================
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'seo_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});
// =====================================================
// إعدادات Stripe
// =====================================================
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2023-10-16'
});
// =====================================================
// إعدادات البريد الإلكتروني
// =====================================================
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || ''
    }
});
const authMiddleware = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'التوكن غير موجود' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.user = decoded;
        return next();
    }
    catch (error) {
        return res.status(401).json({ error: 'التوكن غير صحيح' });
    }
};
// =====================================================
// Middleware لمعالجة الأخطاء
// =====================================================
const errorHandler = (err, _req, res, _next) => {
    console.error('خطأ:', err);
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: 'بيانات غير صحيحة' });
    }
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'غير مصرح' });
    }
    return res.status(500).json({ error: 'خطأ في الخادم' });
};
// =====================================================
// المسارات - المصادقة
// =====================================================
/**
 * تسجيل مستخدم جديد
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, first_name, last_name, company_name, phone, country } = req.body;
        // التحقق من البيانات
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ error: 'البيانات المطلوبة غير موجودة' });
        }
        // التحقق من صيغة البريد الإلكتروني
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'صيغة البريد الإلكتروني غير صحيحة' });
        }
        // التحقق من قوة كلمة المرور
        if (password.length < 8) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
        }
        const connection = await pool.getConnection();
        try {
            // التحقق من عدم وجود المستخدم
            const [existingUser] = await connection.execute('SELECT user_id FROM users WHERE email = ?', [email]);
            if (existingUser.length > 0) {
                return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
            }
            // تشفير كلمة المرور
            const hashedPassword = await bcrypt.hash(password, 10);
            // إدراج المستخدم الجديد
            const [result] = await connection.execute(`INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, country, user_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'prospect', 'active')`, [email, hashedPassword, first_name, last_name, company_name || null, phone || null, country || null]);
            const userId = result.insertId;
            // إنشاء JWT Token
            const token = jwt.sign({ user_id: userId, email, user_type: 'prospect' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            // إرسال بريد ترحيبي
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: email,
                subject: 'أهلاً وسهلاً في SEO',
                html: `
          <h1>مرحباً ${first_name}!</h1>
          <p>شكراً لتسجيلك في SEO</p>
          <p>يمكنك الآن تسجيل الدخول واستكشاف خدماتنا</p>
          <a href="${process.env.FRONTEND_URL}/dashboard">الذهاب إلى لوحة التحكم</a>
        `
            });
            return res.status(201).json({
                message: 'تم التسجيل بنجاح',
                token,
                user: {
                    user_id: userId,
                    email,
                    first_name,
                    last_name
                }
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في التسجيل:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
/**
 * تسجيل الدخول
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // التحقق من البيانات
        if (!email || !password) {
            return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
        }
        const connection = await pool.getConnection();
        try {
            // البحث عن المستخدم
            const [users] = await connection.execute('SELECT user_id, email, password_hash, first_name, last_name, user_type, status FROM users WHERE email = ?', [email]);
            if (users.length === 0) {
                return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
            }
            const user = users[0];
            // التحقق من كلمة المرور
            const isPasswordValid = await bcrypt.compare(password, user.password_hash);
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
            }
            // التحقق من حالة المستخدم
            if (user.status !== 'active') {
                return res.status(403).json({ error: 'حسابك معطل' });
            }
            // إنشاء JWT Token
            const token = jwt.sign({ user_id: user.user_id, email: user.email, user_type: user.user_type }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
            return res.status(200).json({
                message: 'تم تسجيل الدخول بنجاح',
                token,
                user: {
                    user_id: user.user_id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    user_type: user.user_type
                }
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
/**
 * تحديث التوكن
 * POST /api/auth/refresh-token
 */
app.post('/api/auth/refresh-token', authMiddleware, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'غير مصرح' });
        }
        const newToken = jwt.sign({ user_id: req.user.user_id, email: req.user.email, user_type: req.user.user_type }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
        return res.status(200).json({ token: newToken });
    }
    catch (error) {
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
// =====================================================
// المسارات - المستخدمين
// =====================================================
/**
 * الحصول على بيانات المستخدم
 * GET /api/users/:id
 */
app.get('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        // التحقق من الصلاحيات
        if (req.user?.user_id !== parseInt(userId) && req.user?.user_type !== 'admin') {
            return res.status(403).json({ error: 'غير مصرح' });
        }
        const connection = await pool.getConnection();
        try {
            const [users] = await connection.execute('SELECT user_id, email, first_name, last_name, company_name, phone, country, user_type, status, created_at FROM users WHERE user_id = ?', [userId]);
            if (users.length === 0) {
                return res.status(404).json({ error: 'المستخدم غير موجود' });
            }
            return res.status(200).json(users[0]);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في الحصول على بيانات المستخدم:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
/**
 * تحديث بيانات المستخدم
 * PUT /api/users/:id
 */
app.put('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.params.id;
        const { first_name, last_name, company_name, phone, country } = req.body;
        // التحقق من الصلاحيات
        if (req.user?.user_id !== parseInt(userId) && req.user?.user_type !== 'admin') {
            return res.status(403).json({ error: 'غير مصرح' });
        }
        const connection = await pool.getConnection();
        try {
            await connection.execute(`UPDATE users SET first_name = ?, last_name = ?, company_name = ?, phone = ?, country = ?, updated_at = NOW()
         WHERE user_id = ?`, [first_name, last_name, company_name || null, phone || null, country || null, userId]);
            return res.status(200).json({ message: 'تم تحديث البيانات بنجاح' });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في تحديث بيانات المستخدم:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
// =====================================================
// المسارات - الخدمات
// =====================================================
/**
 * الحصول على قائمة الخدمات
 * GET /api/services
 */
app.get('/api/services', async (_req, res) => {
    try {
        const connection = await pool.getConnection();
        try {
            const [services] = await connection.execute('SELECT service_id, service_name, service_code, description, category, base_price, duration_days, features FROM services WHERE is_active = TRUE ORDER BY service_id');
            return res.status(200).json(services);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في الحصول على الخدمات:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
/**
 * الحصول على خدمة محددة
 * GET /api/services/:id
 */
app.get('/api/services/:id', async (req, res) => {
    try {
        const serviceId = req.params.id;
        const connection = await pool.getConnection();
        try {
            const [services] = await connection.execute('SELECT * FROM services WHERE service_id = ? AND is_active = TRUE', [serviceId]);
            if (services.length === 0) {
                return res.status(404).json({ error: 'الخدمة غير موجودة' });
            }
            return res.status(200).json(services[0]);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في الحصول على الخدمة:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
// =====================================================
// المسارات - الطلبات
// =====================================================
/**
 * الحصول على طلبات المستخدم
 * GET /api/orders
 */
app.get('/api/orders', authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'غير مصرح' });
        }
        const connection = await pool.getConnection();
        try {
            const [orders] = await connection.execute(`SELECT o.order_id, o.project_name, o.website_url, o.budget, o.status, 
                o.start_date, o.end_date, s.service_name, am.name as manager_name
         FROM orders o
         JOIN services s ON o.service_id = s.service_id
         LEFT JOIN account_managers am ON o.assigned_manager_id = am.manager_id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC`, [req.user.user_id]);
            return res.status(200).json(orders);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في الحصول على الطلبات:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
/*

 // إنشاء طلب جديد
 // POST /api/orders
 
app.post('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح' });
    }

    const { service_id, project_name, website_url, budget, notes } = req.body;

    // التحقق من البيانات
    if (!service_id || !project_name || !budget) {
      return res.status(400).json({ error: 'البيانات المطلوبة غير موجودة' });
    }

    const connection = await pool.getConnection();

    try {
      const [result] = await connection.execute(
        `INSERT INTO orders (user_id, service_id, project_name, website_url, budget, status, notes)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [req.user.user_id, service_id, project_name, website_url || null, budget, notes || null]
      );

      const orderId = (result as any).insertId;

      return res.status(201).json({
        message: 'تم إنشاء الطلب بنجاح',
        order_id: orderId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('خطأ في إنشاء الطلب:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});
*/
// =====================================================
// المسارات - الدفع
// =====================================================
/*
 // إنشاء نية دفع
 // POST /api/payments/create-intent
 
app.post('/api/payments/create-intent', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح' });
    }

    const { order_id, amount } = req.body;

    // التحقق من البيانات
    if (!order_id || !amount) {
      return res.status(400).json({ error: 'البيانات المطلوبة غير موجودة' });
    }

    // إنشاء Payment Intent في Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // تحويل إلى سنتات
      currency: 'usd',
      metadata: {
        order_id: order_id.toString(),
        user_id: req.user.user_id.toString()
      }
    });

    // حفظ في قاعدة البيانات
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `INSERT INTO invoices (order_id, invoice_number, amount, status, due_date)
         VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [order_id, `INV-${Date.now()}`]
      );
    } finally {
      connection.release();
    }

    return res.status(200).json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });
  } catch (error) {
    console.error('خطأ في إنشاء نية الدفع:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});


 // تأكيد الدفع
 // POST /api/payments/confirm
 
app.post('/api/payments/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح' });
    }

    const { payment_intent_id, order_id } = req.body;

    // التحقق من الدفع في Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'الدفع لم يتم بنجاح' });
    }

    // تحديث حالة الطلب والفاتورة
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        'UPDATE orders SET status = ?, start_date = NOW() WHERE order_id = ?',
        ['in_progress', order_id]
      );

      await connection.execute(
        'UPDATE invoices SET status = ?, paid_date = NOW() WHERE order_id = ?',
        ['paid', order_id]
      );

      // إرسال بريد تأكيد الدفع
      const [users] = await connection.execute(
        'SELECT email, first_name FROM users WHERE user_id = ?',
        [req.user.user_id]
      );

      const user = (users as any[])[0];

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: user.email,
        subject: 'تأكيد الدفع - SEO',
        html: `
          <h1>شكراً ${user.first_name}!</h1>
          <p>تم استقبال دفعتك بنجاح</p>
          <p>سيتم البدء في المشروع قريباً</p>
          <a href="${process.env.FRONTEND_URL}/dashboard">عرض الطلب</a>
        `
      });
    } finally {
      connection.release();
    }

    return res.status(200).json({ message: 'تم تأكيد الدفع بنجاح' });
  } catch (error) {
    console.error('خطأ في تأكيد الدفع:', error);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});
*/
// =====================================================
// المسارات - النماذج
// =====================================================
/**
 * إرسال رسالة اتصال
 * POST /api/contact
 */
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        // التحقق من البيانات
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'البيانات المطلوبة غير موجودة' });
        }
        const connection = await pool.getConnection();
        try {
            await connection.execute(`INSERT INTO contact_messages (name, email, phone, subject, message, status)
         VALUES (?, ?, ?, ?, ?, 'new')`, [name, email, phone || null, subject, message]);
            // إرسال بريد تأكيد للعميل
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: email,
                subject: 'تأكيد استقبال رسالتك - SEO',
                html: `
          <h1>مرحباً ${name}!</h1>
          <p>شكراً لتواصلك معنا</p>
          <p>تم استقبال رسالتك بنجاح وسيتم الرد عليك قريباً</p>
        `
            });
            // إرسال بريد للفريق
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: process.env.SUPPORT_EMAIL || 'support@seo.com',
                subject: `رسالة اتصال جديدة: ${subject}`,
                html: `
          <h2>رسالة اتصال جديدة</h2>
          <p><strong>الاسم:</strong> ${name}</p>
          <p><strong>البريد الإلكتروني:</strong> ${email}</p>
          <p><strong>الهاتف:</strong> ${phone || 'غير محدد'}</p>
          <p><strong>الموضوع:</strong> ${subject}</p>
          <p><strong>الرسالة:</strong></p>
          <p>${message}</p>
        `
            });
            return res.status(201).json({ message: 'تم إرسال الرسالة بنجاح' });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        return res.status(500).json({ error: 'خطأ في الخادم' });
    }
});
// =====================================================
// Webhook من Stripe
// =====================================================
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const sig = req.headers['stripe-signature'];
        const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            console.log('الدفع نجح:', paymentIntent.id);
            // معالجة الدفع الناجح
        }
        if (event.type === 'payment_intent.payment_failed') {
            const paymentIntent = event.data.object;
            console.log('فشل الدفع:', paymentIntent.id);
            // معالجة فشل الدفع
        }
        return res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('خطأ في معالجة webhook:', error);
        return res.status(400).json({ error: 'خطأ في معالجة webhook' });
    }
});
// =====================================================
// معالجة الأخطاء العامة
// =====================================================
app.use(errorHandler);
// =====================================================
// بدء الخادم
// =====================================================
app.listen(PORT, () => {
    console.log(`✅ server is working ${PORT}`);
    console.log(`📧 Email : ${process.env.EMAIL_USER}`);
    console.log(`💳 Stripe : ${process.env.STRIPE_SECRET_KEY ? 'Containg' : 'Un Containg'}`);
    console.log(`🗄️ Data Base : ${process.env.DB_NAME}`);
});
export default app;
//# sourceMappingURL=server.js.map