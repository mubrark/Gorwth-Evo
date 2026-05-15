/**
 * خدمة معالجة النماذج
 *
 * المسؤولة عن:
 * - معالجة نماذج الاتصال
 * - معالجة نماذج الاشتراك
 * - التحقق من صحة البيانات
 * - إرسال رسائل البريد الإلكتروني
 */
export class FormService {
    constructor(connection, transporter) {
        this.connection = connection;
        this.transporter = transporter;
    }
    /**
     * معالجة نموذج الاتصال
     */
    async handleContactForm(data) {
        try {
            // التحقق من صحة البيانات
            const errors = this.validateContactForm(data);
            if (errors.length > 0) {
                throw new Error(`خطأ في البيانات: ${errors.map(e => e.message).join(', ')}`);
            }
            // حفظ الرسالة في قاعدة البيانات
            const [result] = await this.connection.execute(`INSERT INTO contact_messages (name, email, phone, subject, message, status)
         VALUES (?, ?, ?, ?, ?, 'new')`, [data.name, data.email, data.phone || null, data.subject, data.message]);
            const messageId = result.insertId;
            // إرسال بريد تأكيد للعميل
            await this.sendContactConfirmationEmail(data.email, data.name);
            // إرسال بريد للفريق
            await this.sendContactNotificationEmail(data);
            return {
                messageId,
                message: 'تم إرسال الرسالة بنجاح، سيتم الرد عليك قريباً'
            };
        }
        catch (error) {
            console.error('خطأ في معالجة نموذج الاتصال:', error);
            throw error;
        }
    }
    /**
     * معالجة نموذج الاشتراك
     */
    async handleSubscriptionForm(data) {
        try {
            // التحقق من صحة البيانات
            const errors = this.validateSubscriptionForm(data);
            if (errors.length > 0) {
                throw new Error(`خطأ في البيانات: ${errors.map(e => e.message).join(', ')}`);
            }
            // التحقق من عدم وجود المستخدم
            const [existingUser] = await this.connection.execute('SELECT user_id FROM users WHERE email = ?', [data.email]);
            let userId;
            if (existingUser.length > 0) {
                // المستخدم موجود بالفعل
                userId = existingUser[0].user_id;
            }
            else {
                // إنشاء مستخدم جديد
                const [result] = await this.connection.execute(`INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, user_type, status)
           VALUES (?, ?, ?, ?, ?, ?, 'prospect', 'active')`, [
                    data.email,
                    'temp_password', // سيتم تعيين كلمة مرور لاحقاً
                    data.firstName,
                    data.lastName,
                    data.companyName,
                    data.phone
                ]);
                userId = result.insertId;
            }
            // إنشاء طلب جديد
            const [orderResult] = await this.connection.execute(`INSERT INTO orders (user_id, service_id, project_name, budget, status, notes)
         VALUES (?, ?, ?, ?, 'pending', ?)`, [
                userId,
                data.serviceId,
                `${data.companyName} - ${data.firstName} ${data.lastName}`,
                data.budget,
                data.notes || null
            ]);
            const orderId = orderResult.insertId;
            // إرسال بريوات
            await this.sendSubscriptionConfirmationEmail(data.email, data.firstName);
            await this.sendSubscriptionNotificationEmail(data, orderId);
            return {
                orderId,
                userId,
                message: 'تم استقبال طلبك بنجاح، سيتم التواصل معك قريباً'
            };
        }
        catch (error) {
            console.error('خطأ في معالجة نموذج الاشتراك:', error);
            throw error;
        }
    }
    /**
     * الرد على رسالة اتصال
     */
    async replyToMessage(messageId, reply) {
        try {
            // الحصول على بيانات الرسالة
            const [messages] = await this.connection.execute('SELECT email, name FROM contact_messages WHERE message_id = ?', [messageId]);
            if (messages.length === 0) {
                throw new Error('الرسالة غير موجودة');
            }
            const message = messages[0];
            // تحديث حالة الرسالة
            await this.connection.execute('UPDATE contact_messages SET status = ? WHERE message_id = ?', ['replied', messageId]);
            // إرسال الرد بالبريد الإلكتروني
            await this.transporter.sendMail({
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
        }
        catch (error) {
            console.error('خطأ في الرد على الرسالة:', error);
            throw error;
        }
    }
    /**
     * التحقق من صحة نموذج الاتصال
     */
    validateContactForm(data) {
        const errors = [];
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
    validateSubscriptionForm(data) {
        const errors = [];
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
        if (!data.budget || data.budget <= 0) {
            errors.push({ field: 'budget', message: 'الميزانية يجب أن تكون أكبر من صفر' });
        }
        return errors;
    }
    /**
     * إرسال بريد تأكيد الاتصال
     */
    async sendContactConfirmationEmail(email, name) {
        try {
            await this.transporter.sendMail({
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
        }
        catch (error) {
            console.error('خطأ في إرسال بريد تأكيد الاتصال:', error);
        }
    }
    /**
     * إرسال إخطار الاتصال للفريق
     */
    async sendContactNotificationEmail(data) {
        try {
            await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: process.env.SUPPORT_EMAIL || 'support@seo.com',
                subject: `رسالة اتصال جديدة: ${data.subject}`,
                html: `
          <h2>رسالة اتصال جديدة</h2>
          <p><strong>الاسم:</strong> ${data.name}</p>
          <p><strong>البريد الإلكتروني:</strong> ${data.email}</p>
          <p><strong>الهاتف:</strong> ${data.phone || 'غير محدد'}</p>
          <p><strong>نوع الخدمة:</strong> ${data.serviceType || 'غير محدد'}</p>
          <p><strong>الميزانية:</strong> ${data.budget ? `$${data.budget}` : 'غير محددة'}</p>
          <p><strong>الموضوع:</strong> ${data.subject}</p>
          <p><strong>الرسالة:</strong></p>
          <p>${data.message}</p>
        `
            });
        }
        catch (error) {
            console.error('خطأ في إرسال إخطار الاتصال:', error);
        }
    }
    /**
     * إرسال بريد تأكيد الاشتراك
     */
    async sendSubscriptionConfirmationEmail(email, firstName) {
        try {
            await this.transporter.sendMail({
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
        }
        catch (error) {
            console.error('خطأ في إرسال بريل تأكيد الاشتراك:', error);
        }
    }
    /**
     * إرسال إخطار الاشتراك للفريق
     */
    async sendSubscriptionNotificationEmail(data, orderId) {
        try {
            await this.transporter.sendMail({
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
          <p><strong>الميزانية:</strong> $${data.budget}</p>
          <p><strong>الملاحظات:</strong> ${data.notes || 'بدون ملاحظات'}</p>
          <a href="${process.env.FRONTEND_URL}/admin/orders/${orderId}">عرض الطلب</a>
        `
            });
        }
        catch (error) {
            console.error('خطأ في إرسال إخطار الاشتراك:', error);
        }
    }
}
//# sourceMappingURL=FormService.js.map