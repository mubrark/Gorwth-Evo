/**
 * خدمة معالجة النماذج
 * 
 * - معالجة نماذج الاتصال
 * - معالجة نماذج الاشتراك
 * - التحقق من صحة البيانات
 * - إرسال رسائل البريد الإلكتروني
 */

import { Pool } from 'mysql2/promise';
import nodemailer from 'nodemailer';

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  serviceType?: string;
  amount?: number;
}

interface SubscriptionFormData {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  serviceId: number;
  amount: number;
  notes?: string;
}

interface FormValidationError {
  field: string;
  message: string;
}

export class FormService {
 
  private pool: Pool;
  private transporter: nodemailer.Transporter | null;


  constructor(pool: Pool, transporter: nodemailer.Transporter | null) {
    this.pool = pool;
    this.transporter = transporter;
  }


  /**
   * معالجة نموذج الاتصال
   */
  async handleContactForm(data: ContactFormData): Promise<any> {
    try {
      // التحقق من صحة البيانات
      const errors = this.validateContactForm(data);
      if (errors.length > 0) {
        throw new Error(`خطأ في البيانات: ${errors.map(e => e.message).join(', ')}`);
      }

      const connection = await this.pool.getConnection();

      // حفظ الرسالة في قاعدة البيانات
      const [result] = await connection.execute(
        `INSERT INTO contact_messages (name, email, phone, subject, message, status)
         VALUES (?, ?, ?, ?, ?, 'new')`,
        [data.name, data.email, data.phone || null, data.subject, data.message]
      );

      const messageId = (result as any).insertId;

      // إرسال بريد تأكيد للعميل
      await this.sendContactConfirmationEmail(data.email, data.name);

      // إرسال بريد للفريق
      await this.sendContactNotificationEmail(data);

      return {
        messageId,
        message: 'تم إرسال الرسالة بنجاح، سيتم الرد عليك قريباً'
      };
    } catch (error) {
      console.error('خطأ في معالجة نموذج الاتصال:', error);
      throw error;
    }
  }

  
  /**
   * الرد على رسالة اتصال
   */
  async replyToMessage(messageId: number, reply: string): Promise<any> {
    try {
     
      const connection = await this.pool.getConnection();

      // الحصول على بيانات الرسالة
      const [messages] = await connection.execute(
        'SELECT email, name FROM contact_messages WHERE message_id = ?',
        [messageId]
      );

      if ((messages as any[]).length === 0) {
        throw new Error('الرسالة غير موجودة');
      }

      const message = (messages as any[])[0];

      // تحديث حالة الرسالة
      await connection.execute(
        'UPDATE contact_messages SET status = ? WHERE message_id = ?',
        ['replied', messageId]
      );

      // إرسال الرد بالبريد الإلكتروني
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: message.email,
        subject: 'الرد على رسالتك - SEO',
        html: `
          <h1>مرحباً ${message.name}!</h1>
          <p>شكراً لتواصلك معنا. إليك ردنا على رسالتك:</p>
          <p>${reply}</p>
          <p>إذا كان لديك أي أسئلة أخرى، لا تتردد في التواصل معنا</p>
        `
      });

      return {
        message: 'تم إرسال الرد بنجاح'
      };
    } catch (error) {
      console.error('خطأ في الرد على الرسالة:', error);
      throw error;
    }
  }
  
  /**
   * إرسال بريد تأكيد الاتصال
   */
  private async sendContactConfirmationEmail(email: string, name: string): Promise<void> {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: email,
        subject: 'تأكيد استقبال رسالتك - SEO',
        html: `
          <h1>مرحباً ${name}!</h1>
          <p>شكراً لتواصلك معنا</p>
          <p>تم استقبال رسالتك بنجاح وسيتم الرد عليك قريباً</p>
          <p>متوسط وقت الرد: 24 ساعة</p>
        `
      });
    } catch (error) {
      console.error('خطأ في إرسال بريد تأكيد الاتصال:', error);
    }
  }

  /**
   * إرسال إخطار الاتصال للفريق
   */
  private async sendContactNotificationEmail(data: ContactFormData): Promise<void> {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: process.env.SUPPORT_EMAIL || 'support@seo.com',
        subject: `رسالة اتصال جديدة: ${data.subject}`,
        html: `
          <h2>رسالة اتصال جديدة</h2>
          <p><strong>الاسم:</strong> ${data.name}</p>
          <p><strong>البريد الإلكتروني:</strong> ${data.email}</p>
          <p><strong>الهاتف:</strong> ${data.phone || 'غير محدد'}</p>
          <p><strong>نوع الخدمة:</strong> ${data.serviceType || 'غير محدد'}</p>
          <p><strong>الميزانية:</strong> ${data.amount ? `$${data.amount}` : 'غير محددة'}</p>
          <p><strong>الموضوع:</strong> ${data.subject}</p>
          <p><strong>الرسالة:</strong></p>
          <p>${data.message}</p>
        `
      });
    } catch (error) {
      console.error('خطأ في إرسال إخطار الاتصال:', error);
    }
  }









/* =================================================
*
*مرحلة التطوير القادمة 
* 
* ===================================================
*/









  /**
   * معالجة نموذج الاشتراك
   */
  async handleSubscriptionForm(data: SubscriptionFormData): Promise<any> {
    try {
      // التحقق من صحة البيانات
      const errors = this.validateSubscriptionForm(data);
      if (errors.length > 0) {
        throw new Error(`خطأ في البيانات: ${errors.map(e => e.message).join(', ')}`);
      }

      const connection = await this.pool.getConnection();

      // التحقق من عدم وجود المستخدم
      const [existingUser] = await connection.execute(
        'SELECT user_id FROM users WHERE email = ?',
        [data.email]
      );

      let userId: number;

      if ((existingUser as any[]).length > 0) {
        // المستخدم موجود بالفعل
        userId = (existingUser as any[])[0].user_id;
      } else {
      
        // إنشاء مستخدم جديد
        const [result] = await connection.execute(
          `INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, user_type, status)
           VALUES (?, ?, ?, ?, ?, ?, 'prospect', 'active')`,
          [
            data.email,
            'temp_password', // سيتم تعيين كلمة مرور لاحقاً
            data.firstName,
            data.lastName,
            data.companyName,
            data.phone
          ]
        );

        userId = (result as any).insertId;
      }

      // إنشاء طلب جديد
      const [orderResult] = await connection.execute(
        `INSERT INTO orders (user_id, service_id, project_name, amount, status, notes)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
        [
          userId,
          data.serviceId,
          `${data.companyName} - ${data.firstName} ${data.lastName}`,
          data.amount,
          data.notes || null
        ]
      );

      const orderId = (orderResult as any).insertId;

      // إرسال بريوات
      await this.sendSubscriptionConfirmationEmail(data.email, data.firstName);
      await this.sendSubscriptionNotificationEmail(data, orderId);

      return {
        orderId,
        userId,
        message: 'تم استقبال طلبك بنجاح، سيتم التواصل معك قريباً'
      };
    } catch (error) {
      console.error('خطأ في معالجة نموذج الاشتراك:', error);
      throw error;
    }
  }


  /**
   * التحقق من صحة نموذج الاتصال
   */
  private validateContactForm(data: ContactFormData): FormValidationError[] {
    const errors: FormValidationError[] = [];

    // التحقق من الاسم
    if (!data.name || data.name.trim().length < 2) {
      errors.push({ field: 'name', message: 'الاسم يجب أن يكون 2 أحرف على الأقل' });
    }

    // التحقق من البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push({ field: 'email', message: 'البريد الإلكتروني غير صحيح' });
    }

    // التحقق من الموضوع
    if (!data.subject || data.subject.trim().length < 3) {
      errors.push({ field: 'subject', message: 'الموضوع يجب أن يكون 3 أحرف على الأقل' });
    }

    // التحقق من الرسالة
    if (!data.message || data.message.trim().length < 10) {
      errors.push({ field: 'message', message: 'الرسالة يجب أن تكون 10 أحرف على الأقل' });
    }

    // التحقق من الهاتف (إن وجد)
    if (data.phone) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(data.phone)) {
        errors.push({ field: 'phone', message: 'رقم الهاتف غير صحيح' });
      }
    }

    return errors;
  }

  /**
   * التحقق من صحة نموذج الاشتراك
   */
  private validateSubscriptionForm(data: SubscriptionFormData): FormValidationError[] {
    const errors: FormValidationError[] = [];

    // التحقق من البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push({ field: 'email', message: 'البريد الإلكتروني غير صحيح' });
    }

    // التحقق من الأسماء
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push({ field: 'firstName', message: 'الاسم الأول يجب أن يكون 2 أحرف على الأقل' });
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push({ field: 'lastName', message: 'الاسم الأخير يجب أن يكون 2 أحرف على الأقل' });
    }

    // التحقق من اسم الشركة
    if (!data.companyName || data.companyName.trim().length < 2) {
      errors.push({ field: 'companyName', message: 'اسم الشركة يجب أن يكون 2 أحرف على الأقل' });
    }

    // التحقق من رقم الهاتف
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!data.phone || !phoneRegex.test(data.phone)) {
      errors.push({ field: 'phone', message: 'رقم الهاتف غير صحيح' });
    }

    // التحقق من الخدمة
    if (!data.serviceId || data.serviceId <= 0) {
      errors.push({ field: 'serviceId', message: 'يجب اختيار خدمة' });
    }

    // التحقق من الميزانية
    if (!data.amount || data.amount <= 0) {
      errors.push({ field: 'budget', message: 'الميزانية يجب أن تكون أكبر من صفر' });
    }

    return errors;
  }

  /**
   * إرسال بريد تأكيد الاشتراك
   */
  private async sendSubscriptionConfirmationEmail(email: string, firstName: string): Promise<void> {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: email,
        subject: 'تأكيد طلبك - SEO',
        html: `
          <h1>مرحباً ${firstName}!</h1>
          <p>شكراً على اختيارك SEO</p>
          <p>تم استقبال طلبك بنجاح</p>
          <p>سيتم التواصل معك قريباً لمناقشة تفاصيل المشروع</p>
          <a href="${process.env.FRONTEND_URL}/dashboard">عرض طلبك</a>
        `
      });
    } catch (error) {
      console.error('خطأ في إرسال بريل تأكيد الاشتراك:', error);
    }
  }

  /**
   * إرسال إخطار الاشتراك للفريق
   */
  private async sendSubscriptionNotificationEmail(data: SubscriptionFormData, orderId: number): Promise<void> {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@seo.com',
        to: process.env.SUPPORT_EMAIL || 'support@seo.com',
        subject: `طلب اشتراك جديد من ${data.companyName}`,
        html: `
          <h2>طلب اشتراك جديد</h2>
          <p><strong>رقم الطلب:</strong> ${orderId}</p>
          <p><strong>الاسم:</strong> ${data.firstName} ${data.lastName}</p>
          <p><strong>البريد الإلكتروني:</strong> ${data.email}</p>
          <p><strong>الهاتف:</strong> ${data.phone}</p>
          <p><strong>الشركة:</strong> ${data.companyName}</p>
          <p><strong>الميزانية:</strong> $${data.amount}</p>
          <p><strong>الملاحظات:</strong> ${data.notes || 'بدون ملاحظات'}</p>
          <a href="${process.env.FRONTEND_URL}/admin/orders/${orderId}">عرض الطلب</a>
        `
      });
    } catch (error) {
      console.error('خطأ في إرسال إخطار الاشتراك:', error);
    }
  }
}
