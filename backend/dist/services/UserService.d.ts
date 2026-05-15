/**
 * خدمة إدارة المستخدمين
 *
 * المسؤولة عن:
 * - تسجيل المستخدمين
 * - تسجيل الدخول
 * - إدارة الملفات الشخصية
 * - استعادة كلمة المرور
 */
import { Connection } from 'mysql2/promise';
import nodemailer from 'nodemailer';
interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    country?: string;
}
interface LoginRequest {
    email: string;
    password: string;
}
interface UpdateProfileRequest {
    firstName: string;
    lastName: string;
    companyName?: string;
    phone?: string;
    country?: string;
}
interface ResetPasswordRequest {
    email: string;
    newPassword: string;
    resetToken: string;
}
export declare class UserService {
    private connection;
    private transporter;
    private jwtSecret;
    constructor(connection: Connection, transporter: nodemailer.Transporter, jwtSecret: string);
    /**
     * تسجيل مستخدم جديد
     */
    register(request: RegisterRequest): Promise<any>;
    /**
     * تسجيل الدخول
     */
    login(request: LoginRequest): Promise<any>;
    /**
     * الحصول على بيانات المستخدم
     */
    getUserById(userId: number): Promise<any>;
    /**
     * تحديث بيانات المستخدم
     */
    updateProfile(userId: number, request: UpdateProfileRequest): Promise<any>;
    /**
     * تغيير كلمة المرور
     */
    changePassword(userId: number, oldPassword: string, newPassword: string): Promise<any>;
    /**
     * طلب استعادة كلمة المرور
     */
    requestPasswordReset(email: string): Promise<any>;
    /**
     * إعادة تعيين كلمة المرور
     */
    resetPassword(request: ResetPasswordRequest): Promise<any>;
    /**
     * حذف المستخدم
     */
    deleteUser(userId: number): Promise<any>;
    /**
     * إنشاء JWT Token
     */
    private generateToken;
    /**
     * إرسال بريد ترحيبي
     */
    private sendWelcomeEmail;
}
export {};
//# sourceMappingURL=UserService.d.ts.map