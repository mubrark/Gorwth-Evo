/**
 * خدمة معالجة النماذج
 *
 * المسؤولة عن:
 * - معالجة نماذج الاتصال
 * - معالجة نماذج الاشتراك
 * - التحقق من صحة البيانات
 * - إرسال رسائل البريد الإلكتروني
 */
import { Connection } from 'mysql2/promise';
import nodemailer from 'nodemailer';
interface ContactFormData {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    serviceType?: string;
    budget?: number;
}
interface SubscriptionFormData {
    email: string;
    firstName: string;
    lastName: string;
    companyName: string;
    phone: string;
    serviceId: number;
    budget: number;
    notes?: string;
}
export declare class FormService {
    private connection;
    private transporter;
    constructor(connection: Connection, transporter: nodemailer.Transporter);
    /**
     * معالجة نموذج الاتصال
     */
    handleContactForm(data: ContactFormData): Promise<any>;
    /**
     * معالجة نموذج الاشتراك
     */
    handleSubscriptionForm(data: SubscriptionFormData): Promise<any>;
    /**
     * الرد على رسالة اتصال
     */
    replyToMessage(messageId: number, reply: string): Promise<any>;
    /**
     * التحقق من صحة نموذج الاتصال
     */
    private validateContactForm;
    /**
     * التحقق من صحة نموذج الاشتراك
     */
    private validateSubscriptionForm;
    /**
     * إرسال بريد تأكيد الاتصال
     */
    private sendContactConfirmationEmail;
    /**
     * إرسال إخطار الاتصال للفريق
     */
    private sendContactNotificationEmail;
    /**
     * إرسال بريد تأكيد الاشتراك
     */
    private sendSubscriptionConfirmationEmail;
    /**
     * إرسال إخطار الاشتراك للفريق
     */
    private sendSubscriptionNotificationEmail;
}
export {};
//# sourceMappingURL=FormService.d.ts.map