/**
 * خدمة إدارة المستخدمين
 *
 * المسؤولة عن:
 * - تسجيل المستخدمين
 * - تسجيل الدخول
 * - إدارة الملفات الشخصية
 * - استعادة كلمة المرور
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
export class UserService {
    constructor(connection, transporter, jwtSecret) {
        this.connection = connection;
        this.transporter = transporter;
        this.jwtSecret = jwtSecret;
    }
    /**
     * تسجيل مستخدم جديد
     */
    async register(request) {
        try {
            // التحقق من البيانات
            if (!request.email || !request.password || !request.firstName || !request.lastName) {
                throw new Error('البيانات المطلوبة غير موجودة');
            }
            // التحقق من صيغة البريد الإلكتروني
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(request.email)) {
                throw new Error('صيغة البريد الإلكتروني غير صحيحة');
            }
            // التحقق من قوة كلمة المرور
            if (request.password.length < 8) {
                throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            }
            // التحقق من عدم وجود المستخدم
            const [existingUser] = await this.connection.execute('SELECT user_id FROM users WHERE email = ?', [request.email]);
            if (existingUser.length > 0) {
                throw new Error('البريد الإلكتروني مستخدم بالفعل');
            }
            // تشفير كلمة المرور
            const hashedPassword = await bcrypt.hash(request.password, 10);
            // إدراج المستخدم الجديد
            const [result] = await this.connection.execute(`INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, country, user_type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'prospect', 'active')`, [
                request.email,
                hashedPassword,
                request.firstName,
                request.lastName,
                request.companyName || null,
                request.phone || null,
                request.country || null
            ]);
            const userId = result.insertId;
            // إنشاء JWT Token
            const token = this.generateToken(userId, request.email, 'prospect');
            // إرسال بريد ترحيبي
            await this.sendWelcomeEmail(request.email, request.firstName);
            return {
                userId,
                email: request.email,
                firstName: request.firstName,
                lastName: request.lastName,
                token
            };
        }
        catch (error) {
            console.error('خطأ في التسجيل:', error);
            throw error;
        }
    }
    /**
     * تسجيل الدخول
     */
    async login(request) {
        try {
            // التحقق من البيانات
            if (!request.email || !request.password) {
                throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان');
            }
            // البحث عن المستخدم
            const [users] = await this.connection.execute('SELECT user_id, email, password_hash, first_name, last_name, user_type, status FROM users WHERE email = ?', [request.email]);
            if (users.length === 0) {
                throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            }
            const user = users[0];
            // التحقق من كلمة المرور
            const isPasswordValid = await bcrypt.compare(request.password, user.password_hash);
            if (!isPasswordValid) {
                throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
            }
            // التحقق من حالة المستخدم
            if (user.status !== 'active') {
                throw new Error('حسابك معطل');
            }
            // إنشاء JWT Token
            const token = this.generateToken(user.user_id, user.email, user.user_type);
            return {
                userId: user.user_id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                userType: user.user_type,
                token
            };
        }
        catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            throw error;
        }
    }
    /**
     * الحصول على بيانات المستخدم
     */
    async getUserById(userId) {
        try {
            const [users] = await this.connection.execute('SELECT user_id, email, first_name, last_name, company_name, phone, country, user_type, status, created_at FROM users WHERE user_id = ?', [userId]);
            if (users.length === 0) {
                throw new Error('المستخدم غير موجود');
            }
            return users[0];
        }
        catch (error) {
            console.error('خطأ في الحصول على بيانات المستخدم:', error);
            throw error;
        }
    }
    /**
     * تحديث بيانات المستخدم
     */
    async updateProfile(userId, request) {
        try {
            // التحقق من البيانات
            if (!request.firstName || !request.lastName) {
                throw new Error('الاسم الأول والأخير مطلوبان');
            }
            // تحديث قاعدة البيانات
            await this.connection.execute(`UPDATE users SET first_name = ?, last_name = ?, company_name = ?, phone = ?, country = ?, updated_at = NOW()
         WHERE user_id = ?`, [request.firstName, request.lastName, request.companyName || null, request.phone || null, request.country || null, userId]);
            return {
                message: 'تم تحديث البيانات بنجاح'
            };
        }
        catch (error) {
            console.error('خطأ في تحديث بيانات المستخدم:', error);
            throw error;
        }
    }
    /**
     * تغيير كلمة المرور
     */
    async changePassword(userId, oldPassword, newPassword) {
        try {
            // التحقق من قوة كلمة المرور الجديدة
            if (newPassword.length < 8) {
                throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            }
            // الحصول على كلمة المرور الحالية
            const [users] = await this.connection.execute('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
            if (users.length === 0) {
                throw new Error('المستخدم غير موجود');
            }
            const user = users[0];
            // التحقق من كلمة المرور القديمة
            const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
            if (!isPasswordValid) {
                throw new Error('كلمة المرور القديمة غير صحيحة');
            }
            // تشفير كلمة المرور الجديدة
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            // تحديث قاعدة البيانات
            await this.connection.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', [hashedPassword, userId]);
            return {
                message: 'تم تغيير كلمة المرور بنجاح'
            };
        }
        catch (error) {
            console.error('خطأ في تغيير كلمة المرور:', error);
            throw error;
        }
    }
    /**
     * طلب استعادة كلمة المرور
     */
    async requestPasswordReset(email) {
        try {
            // البحث عن المستخدم
            const [users] = await this.connection.execute('SELECT user_id, first_name FROM users WHERE email = ?', [email]);
            if (users.length === 0) {
                // لا نكشف إذا كان البريد موجود أم لا لأسباب أمنية
                return {
                    message: 'إذا كان البريد الإلكتروني موجود، سيتم إرسال رابط إعادة التعيين'
                };
            }
            const user = users[0];
            // إنشاء رمز إعادة التعيين
            const resetToken = jwt.sign({ user_id: user.user_id, email }, this.jwtSecret, { expiresIn: '1h' });
            // إرسال بريد إعادة التعيين
            const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: email,
                subject: 'إعادة تعيين كلمة المرور - SEO',
                html: `
          <h1>مرحباً ${user.first_name}!</h1>
          <p>تلقينا طلب لإعادة تعيين كلمة المرور الخاصة بك</p>
          <p>انقر على الرابط أدناه لإعادة تعيين كلمة المرور:</p>
          <a href="${resetLink}">إعادة تعيين كلمة المرور</a>
          <p>ينتهي صلاحية هذا الرابط في غضون ساعة واحدة</p>
          <p>إذا لم تطلب هذا، يرجى تجاهل هذا البريد</p>
        `
            });
            return {
                message: 'إذا كان البريد الإلكتروني موجود، سيتم إرسال رابط إعادة التعيين'
            };
        }
        catch (error) {
            console.error('خطأ في طلب استعادة كلمة المرور:', error);
            throw error;
        }
    }
    /**
     * إعادة تعيين كلمة المرور
     */
    async resetPassword(request) {
        try {
            // التحقق من رمز الإعادة
            const decoded = jwt.verify(request.resetToken, this.jwtSecret);
            // التحقق من قوة كلمة المرور الجديدة
            if (request.newPassword.length < 8) {
                throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            }
            // تشفير كلمة المرور الجديدة
            const hashedPassword = await bcrypt.hash(request.newPassword, 10);
            // تحديث قاعدة البيانات
            await this.connection.execute('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?', [hashedPassword, decoded.user_id]);
            return {
                message: 'تم إعادة تعيين كلمة المرور بنجاح'
            };
        }
        catch (error) {
            console.error('خطأ في إعادة تعيين كلمة المرور:', error);
            throw error;
        }
    }
    /**
     * حذف المستخدم
     */
    async deleteUser(userId) {
        try {
            // حذف جميع البيانات المرتبطة
            await this.connection.execute('DELETE FROM orders WHERE user_id = ?', [userId]);
            await this.connection.execute('DELETE FROM reviews WHERE user_id = ?', [userId]);
            await this.connection.execute('DELETE FROM users WHERE user_id = ?', [userId]);
            return {
                message: 'تم حذف الحساب بنجاح'
            };
        }
        catch (error) {
            console.error('خطأ في حذف الحساب:', error);
            throw error;
        }
    }
    /**
     * إنشاء JWT Token
     */
    generateToken(userId, email, userType) {
        return jwt.sign({ user_id: userId, email, user_type: userType }, this.jwtSecret, { expiresIn: '7d' });
    }
    /**
     * إرسال بريد ترحيبي
     */
    async sendWelcomeEmail(email, firstName) {
        try {
            await this.transporter.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@seo.com',
                to: email,
                subject: 'أهلاً وسهلاً في SEO',
                html: `
          <h1>مرحباً ${firstName}!</h1>
          <p>شكراً لتسجيلك في SEO</p>
          <p>يمكنك الآن تسجيل الدخول واستكشاف خدماتنا</p>
          <a href="${process.env.FRONTEND_URL}/dashboard">الذهاب إلى لوحة التحكم</a>
        `
            });
        }
        catch (error) {
            console.error('خطأ في إرسال البريد الترحيبي:', error);
        }
    }
}
//# sourceMappingURL=UserService.js.map