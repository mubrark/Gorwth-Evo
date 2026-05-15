/**
 * خدمة إدارة الدفع
 * 
 * - إنشاء نوايا الدفع
 * - تأكيد الدفع
 * - معالجة الاسترجاع
 * - إدارة الفواتير
 */

import Stripe from 'stripe';
import { Pool } from 'mysql2/promise';


interface PaymentIntentRequest {
  orderId: number;
  amount: number;
  userId: number;
  description?: string;
}

interface PaymentConfirmRequest {
  paymentIntentId: string;
  orderId: number;
  userId: number;
}

interface RefundRequest {
  paymentIntentId: string;
  orderId: number;
  reason?: string;
}

export class PaymentService {
  private stripe: Stripe;
  private pool: Pool;

  constructor(stripe: Stripe, pool: Pool) {
    this.stripe = stripe;
    this.pool = pool;
  }

  /**
   * إنشاء نية دفع
   */
  async createPaymentIntent(request: PaymentIntentRequest): Promise<any> {
    try {
      // التحقق من صحة المبلغ
      if (request.amount <= 0) {
        throw new Error('المبلغ يجب أن يكون أكبر من صفر');
      }

      // إنشاء Payment Intent في Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100), // تحويل إلى سنتات
        currency: 'usd',
        description: request.description || `طلب رقم ${request.orderId}`,
        metadata: {
          order_id: request.orderId.toString(),
          user_id: request.userId.toString()
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      const connection = await this.pool.getConnection();

      // حفظ في قاعدة البيانات
      await connection.execute(
        `INSERT INTO invoices (order_id, invoice_number, amount, status, due_date)
         VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [request.orderId, `INV-${Date.now()}`]
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: request.amount,
        currency: 'usd'
      };
    } catch (error) {
      console.error('خطأ في إنشاء نية الدفع:', error);
      throw error;
    }
  }

  /**
   * تأكيد الدفع
   */
  async confirmPayment(request: PaymentConfirmRequest): Promise<any> {
    try {
      // التحقق من الدفع في Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        request.paymentIntentId
      );

      if (paymentIntent.status !== 'succeeded') {
        throw new Error('الدفع لم يتم بنجاح');
      }

      const connection = await this.pool.getConnection();

      // تحديث حالة الطلب
      await connection.execute(
        'UPDATE orders SET status = ?, start_date = NOW() WHERE order_id = ?',
        ['in_progress', request.orderId]
      );

      // تحديث حالة الفاتورة
      await connection.execute(
        'UPDATE invoices SET status = ?, paid_date = NOW() WHERE order_id = ?',
        ['paid', request.orderId]
      );

      // تسجيل النشاط
      await connection.execute(
        `INSERT INTO activities (order_id, activity_type, description, created_by)
         VALUES (?, 'payment_received', ?, ?)`,
        [request.orderId, `تم استقبال الدفع بنجاح - ${paymentIntent.id}`, request.userId]
      );

      return {
        success: true,
        message: 'تم تأكيد الدفع بنجاح',
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error('خطأ في تأكيد الدفع:', error);
      throw error;
    }
  }

  /**
   * معالجة webhook من Stripe
   */
  async handleStripeWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object);
          break;
        default:
          console.log(`حدث غير معالج: ${event.type}`);
      }
    } catch (error) {
      console.error('خطأ في معالجة webhook:', error);
      throw error;
    }
  }








/* =================================================
*
*مرحلة التطوير القادمة 
* 
* ===================================================
*/








  /**
   * استرجاع الدفع
   */
  async refundPayment(request: RefundRequest): Promise<any> {
    try {
      // إنشاء استرجاع في Stripe
      const refund = await this.stripe.refunds.create({
        payment_intent: request.paymentIntentId,
        reason: (request.reason as Stripe.RefundCreateParams.Reason) || 'requested_by_customer'
      });

      const connection = await this.pool.getConnection();

      // تحديث حالة الفاتورة
      await connection.execute(
        'UPDATE invoices SET status = ? WHERE order_id = ?',
        ['refunded', request.orderId]
      );

      // تحديث حالة الطلب
      await connection.execute(
        'UPDATE orders SET status = ? WHERE order_id = ?',
        ['cancelled', request.orderId]
      );

      return {
        success: true,
        message: 'تم استرجاع الدفع بنجاح',
        refundId: refund.id
      };
    } catch (error) {
      console.error('خطأ في استرجاع الدفع:', error);
      throw error;
    }
  }

  /**
   * الحصول على حالة الدفع
   */
  async getPaymentStatus(paymentIntentId: string): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: new Date(paymentIntent.created * 1000)
      };
    } catch (error) {
      console.error('خطأ في الحصول على حالة الدفع:', error);
      throw error;
    }
  }

  /**
   * الحصول على الفواتير
   */
  async getInvoices(userId: number): Promise<any[]> {
    
    const connection = await this.pool.getConnection();

    try {
      const [invoices] = await connection.execute(
        `SELECT i.invoice_id, i.invoice_number, i.amount, i.status, 
                i.due_date, i.paid_date, o.project_name
         FROM invoices i
         JOIN orders o ON i.order_id = o.order_id
         WHERE o.user_id = ?
         ORDER BY i.created_at DESC`,
        [userId]
      );

      return invoices as any[];
    } catch (error) {
      console.error('خطأ في الحصول على الفواتير:', error);
      throw error;
    }
  }

  /**
   * إنشاء فاتورة PDF
   */
  async generateInvoicePDF(invoiceId: number): Promise<Buffer> {
    
    const connection = await this.pool.getConnection();

    try {
      // الحصول على بيانات الفاتورة
      const [invoices] = await connection.execute(
        `SELECT i.*, o.project_name, o.budget, u.email, u.first_name, u.last_name, u.company_name
         FROM invoices i
         JOIN orders o ON i.order_id = o.order_id
         JOIN users u ON o.user_id = u.user_id
         WHERE i.invoice_id = ?`,
        [invoiceId]
      );

      if ((invoices as any[]).length === 0) {
        throw new Error('الفاتورة غير موجودة');
      }

      const invoice = (invoices as any[])[0];

      // إنشاء محتوى PDF (يمكن استخدام مكتبة مثل pdfkit)
      // هذا مثال مبسط
      const pdfContent = `
        فاتورة رقم: ${invoice.invoice_number}
        التاريخ: ${new Date().toLocaleDateString('ar-SA')}
        
        العميل:
        ${invoice.first_name} ${invoice.last_name}
        ${invoice.company_name || ''}
        ${invoice.email}
        
        الخدمة: ${invoice.project_name}
        المبلغ: $${invoice.amount}
        الحالة: ${invoice.status}
        تاريخ الاستحقاق: ${invoice.due_date}
      `;

      return Buffer.from(pdfContent);
    } catch (error) {
      console.error('خطأ في إنشاء فاتورة PDF:', error);
      throw error;
    }
  }


  /**
   * معالجة الدفع الناجح
   */
  private async handlePaymentSucceeded(paymentIntent: any): Promise<void> {
    try {
      const orderId = paymentIntent.metadata.order_id;
      //const userId = paymentIntent.metadata.user_id;

      const connection = await this.pool.getConnection();

      // تحديث حالة الطلب
      await connection.execute(
        'UPDATE orders SET status = ?, start_date = NOW() WHERE order_id = ?',
        ['in_progress', orderId]
      );

      // تحديث حالة الفاتورة
      await connection.execute(
        'UPDATE invoices SET status = ?, paid_date = NOW() WHERE order_id = ?',
        ['paid', orderId]
      );

      console.log(`✅ تم استقبال الدفع للطلب ${orderId}`);
    } catch (error) {
      console.error('خطأ في معالجة الدفع الناجح:', error);
    }
  }

  /**
   * معالجة فشل الدفع
   */
  private async handlePaymentFailed(paymentIntent: any): Promise<void> {
    try {
      const orderId = paymentIntent.metadata.order_id;

      const connection = await this.pool.getConnection();

      // تحديث حالة الفاتورة
      await connection.execute(
        'UPDATE invoices SET status = ? WHERE order_id = ?',
        ['failed', orderId]
      );

      console.log(`❌ فشل الدفع للطلب ${orderId}`);
    } catch (error) {
      console.error('خطأ في معالجة فشل الدفع:', error);
    }
  }

  /**
   * معالجة استرجاع الدفع
   */
  private async handleChargeRefunded(charge: any): Promise<void> {
    try {
      const connection = await this.pool.getConnection();

      // البحث عن الفاتورة المرتبطة
      const [invoices] = await connection.execute(
        'SELECT order_id FROM invoices WHERE stripe_charge_id = ?',
        [charge.id]
      );

      if ((invoices as any[]).length > 0) {
        const orderId = (invoices as any[])[0].order_id;

        // تحديث حالة الفاتورة
        await connection.execute(
          'UPDATE invoices SET status = ? WHERE order_id = ?',
          ['refunded', orderId]
        );

        console.log(`🔄 تم استرجاع الدفع للطلب ${orderId}`);
      }
    } catch (error) {
      console.error('خطأ في معالجة استرجاع الدفع:', error);
    }
  }
}
