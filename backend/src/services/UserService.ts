/**
 * خدمة إدارة المستخدمين
 * 
 * - تسجيل المستخدمين
 * - تسجيل الدخول
 * - إدارة الملفات الشخصية
 * - استعادة كلمة المرور
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'mysql2/promise';
import nodemailer from 'nodemailer';

// توافق مع بيانات الواجهة الأمامية
interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;   
  last_name: string;    
  company_name?: string;
  phone?: string;
  country?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  company_name?: string;
  phone?: string;
  country?: string;
}

interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

interface ResetPasswordRequest {
  newPassword: string;
  resetToken: string;
}

export class UserService {
  private pool: Pool;
  private transporter: nodemailer.Transporter | null;
  private jwtSecret: string;

  constructor(pool: Pool, transporter: nodemailer.Transporter | null, jwtSecret: string) {
    this.pool = pool;
    this.transporter = transporter;
    this.jwtSecret = jwtSecret;
  }
  //انشاء حساب جديد
  async register(request: RegisterRequest) {
    // التحقق من البيانات
    if (!request.email || !request.password || !request.first_name || !request.last_name) {
      throw new Error('البيانات المطلوبة غير موجودة');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new Error('صيغة البريد الإلكتروني غير صحيحة');
    }
    if (request.password.length < 8) {
      throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }

    // التحقق من عدم وجود المستخدم
    const [existing] = await this.pool.execute(
      `SELECT user_id FROM users WHERE email = ?`,
      [request.email]
    );
    if ((existing as any[]).length > 0) {
      throw new Error('البريد الإلكتروني مستخدم بالفعل');
    }

    const hashedPassword = await bcrypt.hash(request.password, 10);
    const [result] = await this.pool.execute(
      `INSERT INTO users 
       (email, password_hash, first_name, last_name, company_name, phone, country, user_type, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'prospect', 'active')`,
      [
        request.email,
        hashedPassword,
        request.first_name,
        request.last_name,
        request.company_name || null,
        request.phone || null,
        request.country || null,
      ]
    );
    const userId = (result as any).insertId;

    const token = this.generateToken(userId, request.email, 'prospect');

    // إرسال بريد ترحيبي (لا ننتظره حتى لا نعطل الاستجابة)
    this.sendWelcomeEmail(request.email, request.first_name).catch(console.error);

    return {
      user_id: userId,
      email: request.email,
      first_name: request.first_name,
      last_name: request.last_name,
      token,
    };
  }

  //ارسال بريد ترحيبي بعد انشاء الحساب
 private async sendWelcomeEmail(email:string, firstName: string) {
    const linktoken =`http://localhost:3000/dashboard/`;
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: email,
        subject: 'أهلاً وسهلاً في SEO',
        html: `
        <h1>مرحباً ${firstName}!</h1>
        <p>شكراً لتسجيلك معنا.</p>
        <h2> الرابط ${linktoken}</h2>
        `,
      });
    } catch (err) {
      console.error('فشل إرسال البريد الترحيبي:', err);
    }
  }

  //تسجيل الدخول 
  async login(request: LoginRequest) {
    if (!request.email || !request.password) {
      throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان');
    }

    const [users] = await this.pool.execute(
      `SELECT user_id, email, password_hash, first_name, last_name, user_type, company_name, status FROM users WHERE email = ?`,
      [request.email]
    );
    if ((users as any[]).length === 0) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    const user = (users as any[])[0];

    const isValid = await bcrypt.compare(request.password, user.password_hash);
    if (!isValid) {
      throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    if (user.status !== 'active') {
      throw new Error('حسابك معطل');
    }

    const token = this.generateToken(user.user_id, user.email, user.company_name);
    return {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_type: user.user_type,
      company_name: user.company_name,
      token,
    };
  }
  //الحصول على بيانات المستخدم
  async getUserById(userId: number) {
    const [users] = await this.pool.execute(
      `SELECT user_id, email, first_name, last_name, company_name, phone, country, user_type, status, created_at
       FROM users WHERE user_id = ?`,
      [userId]
    );
    if ((users as any[]).length === 0) {
      throw new Error('المستخدم غير موجود');
    }
    return (users as any[])[0];
  }
  //تحديث الملف الشخصي
  async updateProfile(userId: number, request: UpdateProfileRequest) {
    if (!request.first_name || !request.last_name) {
      throw new Error('الاسم الأول والأخير مطلوبان');
    }
    await this.pool.execute(
      `UPDATE users SET first_name = ?, last_name = ?, company_name = ?, phone = ?, country = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        request.first_name,
        request.last_name,
        request.company_name || null,
        request.phone || null,
        request.country || null,
        userId,
      ]
    );
    return { message: 'تم تحديث البيانات بنجاح' };
  }
  // تغير كلمة السر من نفس الصفحة
  async changePassword(userId: number, request: ChangePasswordRequest) {
    if (request.newPassword.length < 8) {
      throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }

    const [users] = await this.pool.execute(
      `SELECT password_hash FROM users WHERE user_id = ?`,
      [userId]
    );
    if ((users as any[]).length === 0) {
      throw new Error('المستخدم غير موجود');
    }
    const user = (users as any[])[0];

    const isValid = await bcrypt.compare(request.oldPassword, user.password_hash);
    if (!isValid) {
      throw new Error('كلمة المرور القديمة غير صحيحة');
    }

    const newHash = await bcrypt.hash(request.newPassword, 10);
    await this.pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [newHash, userId]
    );
    return { message: 'تم تغيير كلمة المرور بنجاح' };
  }
  //ارسال طلب لتغير كلمة السر
  async requestPasswordReset(email: string) {
    const [users] = await this.pool.execute(
      'SELECT user_id, first_name FROM users WHERE email = ?',
      [email]
    );
    if ((users as any[]).length === 0) {
      // عدم كشف وجود البريد لأسباب أمنية
      return { message: 'إذا كان البريد الإلكتروني موجوداً، سيتم إرسال رابط إعادة التعيين' };
    }

    const user = (users as any[])[0];
    const resetToken = jwt.sign(
      { user_id: user.user_id, email },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
    const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}`;

    if (this.transporter) {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: email,
        subject: 'إعادة تعيين كلمة المرور',
        html: `
          <h1>مرحباً ${user.first_name}!</h1>
          <p>تلقينا طلباً لإعادة تعيين كلمة المرور.</p>
          <a href="${resetLink}">إعادة تعيين كلمة المرور</a>
          <p>الرابط صالح لمدة ساعة واحدة.</p>
        `,
      });
    }
        return { message: 'البريد خطا'};
  }
  //طلب تغير كلمة السر
  async resetPassword(request: ResetPasswordRequest) {
    let decoded: any;
    try {
      decoded = jwt.verify(request.resetToken, this.jwtSecret);
    } catch (err) {
      throw new Error('الرابط غير صالح أو منتهي الصلاحية');
    }
    if (request.newPassword.length < 8) {
      throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
    }
    const newHash = await bcrypt.hash(request.newPassword, 10);

    const [result]: any = await this.pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?',
      [newHash, decoded.user_id]
    );

    if (result.affectedRows === 0) {
      throw new Error('المستخدم غير موجود');
    }

    console.log(`Password updated for user_id: ${decoded.user_id}`);
    console.log(`affected rows: ${result.affectedRows}`);
    return { message: 'تم إعادة تعيين كلمة المرور بنجاح' };
  }







  


/* =================================================
*
*مرحلة التطوير القادمة 
* 
* ===================================================
*/








  async deleteUser(userId: number) {
    await this.pool.execute('DELETE FROM orders WHERE user_id = ?', [userId]);
    await this.pool.execute('DELETE FROM reviews WHERE user_id = ?', [userId]);
    await this.pool.execute('DELETE FROM users WHERE user_id = ?', [userId]);
    return { message: 'تم حذف الحساب بنجاح' };
  }

  private generateToken(userId: number, email: string, userType: string): string {
    return jwt.sign(
      { user_id: userId, email, user_type: userType },
      this.jwtSecret,
      { expiresIn: '7d' }
    );
  }

  
}
