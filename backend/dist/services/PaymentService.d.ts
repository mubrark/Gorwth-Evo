/**
 * خدمة إدارة الدفع
 *
 * المسؤولة عن:
 * - إنشاء نوايا الدفع
 * - تأكيد الدفع
 * - معالجة الاسترجاع
 * - إدارة الفواتير
 */
import Stripe from 'stripe';
import { Connection } from 'mysql2/promise';
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
export declare class PaymentService {
    private stripe;
    private connection;
    constructor(stripe: Stripe, connection: Connection);
    /**
     * إنشاء نية دفع
     */
    createPaymentIntent(request: PaymentIntentRequest): Promise<any>;
    /**
     * تأكيد الدفع
     */
    confirmPayment(request: PaymentConfirmRequest): Promise<any>;
    /**
     * استرجاع الدفع
     */
    refundPayment(request: RefundRequest): Promise<any>;
    /**
     * الحصول على حالة الدفع
     */
    getPaymentStatus(paymentIntentId: string): Promise<any>;
    /**
     * الحصول على الفواتير
     */
    getInvoices(userId: number): Promise<any[]>;
    /**
     * إنشاء فاتورة PDF
     */
    generateInvoicePDF(invoiceId: number): Promise<Buffer>;
    /**
     * معالجة webhook من Stripe
     */
    handleStripeWebhook(event: any): Promise<void>;
    /**
     * معالجة الدفع الناجح
     */
    private handlePaymentSucceeded;
    /**
     * معالجة فشل الدفع
     */
    private handlePaymentFailed;
    /**
     * معالجة استرجاع الدفع
     */
    private handleChargeRefunded;
}
export {};
//# sourceMappingURL=PaymentService.d.ts.map