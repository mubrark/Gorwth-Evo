// ../backend/server.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import jwt2 from "jsonwebtoken";
import Stripe from "stripe";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";

// ../backend/src/services/UserService.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
var UserService = class {
  constructor(pool2, transporter2, jwtSecret) {
    this.pool = pool2;
    this.transporter = transporter2;
    this.jwtSecret = jwtSecret;
  }
  //انشاء حساب جديد
  async register(request) {
    if (!request.email || !request.password || !request.first_name || !request.last_name) {
      throw new Error("\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(request.email)) {
      throw new Error("\u0635\u064A\u063A\u0629 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    if (request.password.length < 8) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
    }
    const [existing] = await this.pool.execute(
      `SELECT user_id FROM users WHERE email = ?`,
      [request.email]
    );
    if (existing.length > 0) {
      throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644");
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
        request.country || null
      ]
    );
    const userId = result.insertId;
    const token = this.generateToken(userId, request.email, "prospect");
    this.sendWelcomeEmail(request.email, request.first_name).catch(console.error);
    return {
      user_id: userId,
      email: request.email,
      first_name: request.first_name,
      last_name: request.last_name,
      token
    };
  }
  //ارسال بريد ترحيبي بعد انشاء الحساب
  async sendWelcomeEmail(email, firstName) {
    const linktoken = `http://localhost:3000/dashboard/`;
    if (!this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: email,
        subject: "\u0623\u0647\u0644\u0627\u064B \u0648\u0633\u0647\u0644\u0627\u064B \u0641\u064A SEO",
        html: `
        <h1>\u0645\u0631\u062D\u0628\u0627\u064B ${firstName}!</h1>
        <p>\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u062C\u064A\u0644\u0643 \u0645\u0639\u0646\u0627.</p>
        <h2> \u0627\u0644\u0631\u0627\u0628\u0637 ${linktoken}</h2>
        `
      });
    } catch (err) {
      console.error("\u0641\u0634\u0644 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u062A\u0631\u062D\u064A\u0628\u064A:", err);
    }
  }
  //تسجيل الدخول 
  async login(request) {
    if (!request.email || !request.password) {
      throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
    }
    const [users] = await this.pool.execute(
      `SELECT user_id, email, password_hash, first_name, last_name, user_type, company_name, status FROM users WHERE email = ?`,
      [request.email]
    );
    if (users.length === 0) {
      throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    const user = users[0];
    const isValid = await bcrypt.compare(request.password, user.password_hash);
    if (!isValid) {
      throw new Error("\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    if (user.status !== "active") {
      throw new Error("\u062D\u0633\u0627\u0628\u0643 \u0645\u0639\u0637\u0644");
    }
    const token = this.generateToken(user.user_id, user.email, user.company_name);
    return {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      user_type: user.user_type,
      company_name: user.company_name,
      token
    };
  }
  //الحصول على بيانات المستخدم
  async getUserById(userId) {
    const [users] = await this.pool.execute(
      `SELECT user_id, email, first_name, last_name, company_name, phone, country, user_type, status, created_at
       FROM users WHERE user_id = ?`,
      [userId]
    );
    if (users.length === 0) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    return users[0];
  }
  //تحديث الملف الشخصي
  async updateProfile(userId, request) {
    if (!request.first_name || !request.last_name) {
      throw new Error("\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644 \u0648\u0627\u0644\u0623\u062E\u064A\u0631 \u0645\u0637\u0644\u0648\u0628\u0627\u0646");
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
        userId
      ]
    );
    return { message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D" };
  }
  // تغير كلمة السر من نفس الصفحة
  async changePassword(userId, request) {
    if (request.newPassword.length < 8) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
    }
    const [users] = await this.pool.execute(
      `SELECT password_hash FROM users WHERE user_id = ?`,
      [userId]
    );
    if (users.length === 0) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    const user = users[0];
    const isValid = await bcrypt.compare(request.oldPassword, user.password_hash);
    if (!isValid) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    }
    const newHash = await bcrypt.hash(request.newPassword, 10);
    await this.pool.execute(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?",
      [newHash, userId]
    );
    return { message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" };
  }
  //ارسال طلب لتغير كلمة السر
  async requestPasswordReset(email) {
    const [users] = await this.pool.execute(
      "SELECT user_id, first_name FROM users WHERE email = ?",
      [email]
    );
    if (users.length === 0) {
      return { message: "\u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u0648\u062C\u0648\u062F\u0627\u064B\u060C \u0633\u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0627\u0628\u0637 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0639\u064A\u064A\u0646" };
    }
    const user = users[0];
    const resetToken = jwt.sign(
      { user_id: user.user_id, email },
      this.jwtSecret,
      { expiresIn: "1h" }
    );
    const resetLink = `http://localhost:3000/resetpassword?token=${resetToken}`;
    if (this.transporter) {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: email,
        subject: "\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
        html: `
          <h1>\u0645\u0631\u062D\u0628\u0627\u064B ${user.first_name}!</h1>
          <p>\u062A\u0644\u0642\u064A\u0646\u0627 \u0637\u0644\u0628\u0627\u064B \u0644\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631.</p>
          <a href="${resetLink}">\u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</a>
          <p>\u0627\u0644\u0631\u0627\u0628\u0637 \u0635\u0627\u0644\u062D \u0644\u0645\u062F\u0629 \u0633\u0627\u0639\u0629 \u0648\u0627\u062D\u062F\u0629.</p>
        `
      });
    }
    return { message: "\u0627\u0644\u0628\u0631\u064A\u062F \u062E\u0637\u0627" };
  }
  //طلب تغير كلمة السر
  async resetPassword(request) {
    let decoded;
    try {
      decoded = jwt.verify(request.resetToken, this.jwtSecret);
    } catch (err) {
      throw new Error("\u0627\u0644\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629");
    }
    if (request.newPassword.length < 8) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 8 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
    }
    const newHash = await bcrypt.hash(request.newPassword, 10);
    const [result] = await this.pool.execute(
      "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?",
      [newHash, decoded.user_id]
    );
    if (result.affectedRows === 0) {
      throw new Error("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F");
    }
    console.log(`Password updated for user_id: ${decoded.user_id}`);
    console.log(`affected rows: ${result.affectedRows}`);
    return { message: "\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" };
  }
  /* =================================================
  *
  *مرحلة التطوير القادمة 
  * 
  * ===================================================
  */
  async deleteUser(userId) {
    await this.pool.execute("DELETE FROM orders WHERE user_id = ?", [userId]);
    await this.pool.execute("DELETE FROM reviews WHERE user_id = ?", [userId]);
    await this.pool.execute("DELETE FROM users WHERE user_id = ?", [userId]);
    return { message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D" };
  }
  generateToken(userId, email, userType) {
    return jwt.sign(
      { user_id: userId, email, user_type: userType },
      this.jwtSecret,
      { expiresIn: "7d" }
    );
  }
};

// ../backend/src/services/PaymentService.ts
var PaymentService = class {
  constructor(stripe2, pool2) {
    this.stripe = stripe2;
    this.pool = pool2;
  }
  /**
   * إنشاء نية دفع
   */
  async createPaymentIntent(request) {
    try {
      if (request.amount <= 0) {
        throw new Error("\u0627\u0644\u0645\u0628\u0644\u063A \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631");
      }
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(request.amount * 100),
        // تحويل إلى سنتات
        currency: "usd",
        description: request.description || `\u0637\u0644\u0628 \u0631\u0642\u0645 ${request.orderId}`,
        metadata: {
          order_id: request.orderId.toString(),
          user_id: request.userId.toString()
        },
        automatic_payment_methods: {
          enabled: true
        }
      });
      const connection = await this.pool.getConnection();
      await connection.execute(
        `INSERT INTO invoices (order_id, invoice_number, amount, status, due_date)
         VALUES (?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
        [request.orderId, `INV-${Date.now()}`]
      );
      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: request.amount,
        currency: "usd"
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0646\u064A\u0629 \u0627\u0644\u062F\u0641\u0639:", error);
      throw error;
    }
  }
  /**
   * تأكيد الدفع
   */
  async confirmPayment(request) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        request.paymentIntentId
      );
      if (paymentIntent.status !== "succeeded") {
        throw new Error("\u0627\u0644\u062F\u0641\u0639 \u0644\u0645 \u064A\u062A\u0645 \u0628\u0646\u062C\u0627\u062D");
      }
      const connection = await this.pool.getConnection();
      await connection.execute(
        "UPDATE orders SET status = ?, start_date = NOW() WHERE order_id = ?",
        ["in_progress", request.orderId]
      );
      await connection.execute(
        "UPDATE invoices SET status = ?, paid_date = NOW() WHERE order_id = ?",
        ["paid", request.orderId]
      );
      await connection.execute(
        `INSERT INTO activities (order_id, activity_type, description, created_by)
         VALUES (?, 'payment_received', ?, ?)`,
        [request.orderId, `\u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u062F\u0641\u0639 \u0628\u0646\u062C\u0627\u062D - ${paymentIntent.id}`, request.userId]
      );
      return {
        success: true,
        message: "\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062F\u0641\u0639 \u0628\u0646\u062C\u0627\u062D",
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062F\u0641\u0639:", error);
      throw error;
    }
  }
  /**
   * معالجة webhook من Stripe
   */
  async handleStripeWebhook(event) {
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event.data.object);
          break;
        case "charge.refunded":
          await this.handleChargeRefunded(event.data.object);
          break;
        default:
          console.log(`\u062D\u062F\u062B \u063A\u064A\u0631 \u0645\u0639\u0627\u0644\u062C: ${event.type}`);
      }
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 webhook:", error);
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
  async refundPayment(request) {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: request.paymentIntentId,
        reason: request.reason || "requested_by_customer"
      });
      const connection = await this.pool.getConnection();
      await connection.execute(
        "UPDATE invoices SET status = ? WHERE order_id = ?",
        ["refunded", request.orderId]
      );
      await connection.execute(
        "UPDATE orders SET status = ? WHERE order_id = ?",
        ["cancelled", request.orderId]
      );
      return {
        success: true,
        message: "\u062A\u0645 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u062F\u0641\u0639 \u0628\u0646\u062C\u0627\u062D",
        refundId: refund.id
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u062F\u0641\u0639:", error);
      throw error;
    }
  }
  /**
   * الحصول على حالة الدفع
   */
  async getPaymentStatus(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(
        paymentIntentId
      );
      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        created: new Date(paymentIntent.created * 1e3)
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u062D\u0627\u0644\u0629 \u0627\u0644\u062F\u0641\u0639:", error);
      throw error;
    }
  }
  /**
   * الحصول على الفواتير
   */
  async getInvoices(userId) {
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
      return invoices;
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631:", error);
      throw error;
    }
  }
  /**
   * إنشاء فاتورة PDF
   */
  async generateInvoicePDF(invoiceId) {
    const connection = await this.pool.getConnection();
    try {
      const [invoices] = await connection.execute(
        `SELECT i.*, o.project_name, o.budget, u.email, u.first_name, u.last_name, u.company_name
         FROM invoices i
         JOIN orders o ON i.order_id = o.order_id
         JOIN users u ON o.user_id = u.user_id
         WHERE i.invoice_id = ?`,
        [invoiceId]
      );
      if (invoices.length === 0) {
        throw new Error("\u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      }
      const invoice = invoices[0];
      const pdfContent = `
        \u0641\u0627\u062A\u0648\u0631\u0629 \u0631\u0642\u0645: ${invoice.invoice_number}
        \u0627\u0644\u062A\u0627\u0631\u064A\u062E: ${(/* @__PURE__ */ new Date()).toLocaleDateString("ar-SA")}
        
        \u0627\u0644\u0639\u0645\u064A\u0644:
        ${invoice.first_name} ${invoice.last_name}
        ${invoice.company_name || ""}
        ${invoice.email}
        
        \u0627\u0644\u062E\u062F\u0645\u0629: ${invoice.project_name}
        \u0627\u0644\u0645\u0628\u0644\u063A: $${invoice.amount}
        \u0627\u0644\u062D\u0627\u0644\u0629: ${invoice.status}
        \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642: ${invoice.due_date}
      `;
      return Buffer.from(pdfContent);
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0641\u0627\u062A\u0648\u0631\u0629 PDF:", error);
      throw error;
    }
  }
  /**
   * معالجة الدفع الناجح
   */
  async handlePaymentSucceeded(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata.order_id;
      const connection = await this.pool.getConnection();
      await connection.execute(
        "UPDATE orders SET status = ?, start_date = NOW() WHERE order_id = ?",
        ["in_progress", orderId]
      );
      await connection.execute(
        "UPDATE invoices SET status = ?, paid_date = NOW() WHERE order_id = ?",
        ["paid", orderId]
      );
      console.log(`\u2705 \u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u062F\u0641\u0639 \u0644\u0644\u0637\u0644\u0628 ${orderId}`);
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u062F\u0641\u0639 \u0627\u0644\u0646\u0627\u062C\u062D:", error);
    }
  }
  /**
   * معالجة فشل الدفع
   */
  async handlePaymentFailed(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata.order_id;
      const connection = await this.pool.getConnection();
      await connection.execute(
        "UPDATE invoices SET status = ? WHERE order_id = ?",
        ["failed", orderId]
      );
      console.log(`\u274C \u0641\u0634\u0644 \u0627\u0644\u062F\u0641\u0639 \u0644\u0644\u0637\u0644\u0628 ${orderId}`);
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0641\u0634\u0644 \u0627\u0644\u062F\u0641\u0639:", error);
    }
  }
  /**
   * معالجة استرجاع الدفع
   */
  async handleChargeRefunded(charge) {
    try {
      const connection = await this.pool.getConnection();
      const [invoices] = await connection.execute(
        "SELECT order_id FROM invoices WHERE stripe_charge_id = ?",
        [charge.id]
      );
      if (invoices.length > 0) {
        const orderId = invoices[0].order_id;
        await connection.execute(
          "UPDATE invoices SET status = ? WHERE order_id = ?",
          ["refunded", orderId]
        );
        console.log(`\u{1F504} \u062A\u0645 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u062F\u0641\u0639 \u0644\u0644\u0637\u0644\u0628 ${orderId}`);
      }
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0633\u062A\u0631\u062C\u0627\u0639 \u0627\u0644\u062F\u0641\u0639:", error);
    }
  }
};

// ../backend/src/services/FormService.ts
var FormService = class {
  constructor(pool2, transporter2) {
    this.pool = pool2;
    this.transporter = transporter2;
  }
  /**
   * معالجة نموذج الاتصال
   */
  async handleContactForm(data) {
    try {
      const errors = this.validateContactForm(data);
      if (errors.length > 0) {
        throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: ${errors.map((e) => e.message).join(", ")}`);
      }
      const connection = await this.pool.getConnection();
      const [result] = await connection.execute(
        `INSERT INTO contact_messages (name, email, phone, subject, message, status)
         VALUES (?, ?, ?, ?, ?, 'new')`,
        [data.name, data.email, data.phone || null, data.subject, data.message]
      );
      const messageId = result.insertId;
      await this.sendContactConfirmationEmail(data.email, data.name);
      await this.sendContactNotificationEmail(data);
      return {
        messageId,
        message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0628\u0646\u062C\u0627\u062D\u060C \u0633\u064A\u062A\u0645 \u0627\u0644\u0631\u062F \u0639\u0644\u064A\u0643 \u0642\u0631\u064A\u0628\u0627\u064B"
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u062A\u0635\u0627\u0644:", error);
      throw error;
    }
  }
  /**
   * الرد على رسالة اتصال
   */
  async replyToMessage(messageId, reply) {
    try {
      const connection = await this.pool.getConnection();
      const [messages] = await connection.execute(
        "SELECT email, name FROM contact_messages WHERE message_id = ?",
        [messageId]
      );
      if (messages.length === 0) {
        throw new Error("\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629");
      }
      const message = messages[0];
      await connection.execute(
        "UPDATE contact_messages SET status = ? WHERE message_id = ?",
        ["replied", messageId]
      );
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: message.email,
        subject: "\u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u062A\u0643 - SEO",
        html: `
          <h1>\u0645\u0631\u062D\u0628\u0627\u064B ${message.name}!</h1>
          <p>\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0648\u0627\u0635\u0644\u0643 \u0645\u0639\u0646\u0627. \u0625\u0644\u064A\u0643 \u0631\u062F\u0646\u0627 \u0639\u0644\u0649 \u0631\u0633\u0627\u0644\u062A\u0643:</p>
          <p>${reply}</p>
          <p>\u0625\u0630\u0627 \u0643\u0627\u0646 \u0644\u062F\u064A\u0643 \u0623\u064A \u0623\u0633\u0626\u0644\u0629 \u0623\u062E\u0631\u0649\u060C \u0644\u0627 \u062A\u062A\u0631\u062F\u062F \u0641\u064A \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627</p>
        `
      });
      return {
        message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0631\u062F \u0628\u0646\u062C\u0627\u062D"
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0631\u062F \u0639\u0644\u0649 \u0627\u0644\u0631\u0633\u0627\u0644\u0629:", error);
      throw error;
    }
  }
  /**
   * إرسال بريد تأكيد الاتصال
   */
  async sendContactConfirmationEmail(email, name) {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: email,
        subject: "\u062A\u0623\u0643\u064A\u062F \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0631\u0633\u0627\u0644\u062A\u0643 - SEO",
        html: `
          <h1>\u0645\u0631\u062D\u0628\u0627\u064B ${name}!</h1>
          <p>\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0648\u0627\u0635\u0644\u0643 \u0645\u0639\u0646\u0627</p>
          <p>\u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0631\u0633\u0627\u0644\u062A\u0643 \u0628\u0646\u062C\u0627\u062D \u0648\u0633\u064A\u062A\u0645 \u0627\u0644\u0631\u062F \u0639\u0644\u064A\u0643 \u0642\u0631\u064A\u0628\u0627\u064B</p>
          <p>\u0645\u062A\u0648\u0633\u0637 \u0648\u0642\u062A \u0627\u0644\u0631\u062F: 24 \u0633\u0627\u0639\u0629</p>
        `
      });
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0631\u0633\u0627\u0644 \u0628\u0631\u064A\u062F \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0627\u062A\u0635\u0627\u0644:", error);
    }
  }
  /**
   * إرسال إخطار الاتصال للفريق
   */
  async sendContactNotificationEmail(data) {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: process.env.SUPPORT_EMAIL || "support@seo.com",
        subject: `\u0631\u0633\u0627\u0644\u0629 \u0627\u062A\u0635\u0627\u0644 \u062C\u062F\u064A\u062F\u0629: ${data.subject}`,
        html: `
          <h2>\u0631\u0633\u0627\u0644\u0629 \u0627\u062A\u0635\u0627\u0644 \u062C\u062F\u064A\u062F\u0629</h2>
          <p><strong>\u0627\u0644\u0627\u0633\u0645:</strong> ${data.name}</p>
          <p><strong>\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A:</strong> ${data.email}</p>
          <p><strong>\u0627\u0644\u0647\u0627\u062A\u0641:</strong> ${data.phone || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}</p>
          <p><strong>\u0646\u0648\u0639 \u0627\u0644\u062E\u062F\u0645\u0629:</strong> ${data.serviceType || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F"}</p>
          <p><strong>\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629:</strong> ${data.amount ? `$${data.amount}` : "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F\u0629"}</p>
          <p><strong>\u0627\u0644\u0645\u0648\u0636\u0648\u0639:</strong> ${data.subject}</p>
          <p><strong>\u0627\u0644\u0631\u0633\u0627\u0644\u0629:</strong></p>
          <p>${data.message}</p>
        `
      });
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0631\u0633\u0627\u0644 \u0625\u062E\u0637\u0627\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644:", error);
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
  async handleSubscriptionForm(data) {
    try {
      const errors = this.validateSubscriptionForm(data);
      if (errors.length > 0) {
        throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: ${errors.map((e) => e.message).join(", ")}`);
      }
      const connection = await this.pool.getConnection();
      const [existingUser] = await connection.execute(
        "SELECT user_id FROM users WHERE email = ?",
        [data.email]
      );
      let userId;
      if (existingUser.length > 0) {
        userId = existingUser[0].user_id;
      } else {
        const [result] = await connection.execute(
          `INSERT INTO users (email, password_hash, first_name, last_name, company_name, phone, user_type, status)
           VALUES (?, ?, ?, ?, ?, ?, 'prospect', 'active')`,
          [
            data.email,
            "temp_password",
            // سيتم تعيين كلمة مرور لاحقاً
            data.firstName,
            data.lastName,
            data.companyName,
            data.phone
          ]
        );
        userId = result.insertId;
      }
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
      const orderId = orderResult.insertId;
      await this.sendSubscriptionConfirmationEmail(data.email, data.firstName);
      await this.sendSubscriptionNotificationEmail(data, orderId);
      return {
        orderId,
        userId,
        message: "\u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D\u060C \u0633\u064A\u062A\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0642\u0631\u064A\u0628\u0627\u064B"
      };
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0645\u0639\u0627\u0644\u062C\u0629 \u0646\u0645\u0648\u0630\u062C \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:", error);
      throw error;
    }
  }
  /**
   * التحقق من صحة نموذج الاتصال
   */
  validateContactForm(data) {
    const errors = [];
    if (!data.name || data.name.trim().length < 2) {
      errors.push({ field: "name", message: "\u0627\u0644\u0627\u0633\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 2 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push({ field: "email", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
    }
    if (!data.subject || data.subject.trim().length < 3) {
      errors.push({ field: "subject", message: "\u0627\u0644\u0645\u0648\u0636\u0648\u0639 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 3 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    if (!data.message || data.message.trim().length < 10) {
      errors.push({ field: "message", message: "\u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 10 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    if (data.phone) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(data.phone)) {
        errors.push({ field: "phone", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
      }
    }
    return errors;
  }
  /**
   * التحقق من صحة نموذج الاشتراك
   */
  validateSubscriptionForm(data) {
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!data.email || !emailRegex.test(data.email)) {
      errors.push({ field: "email", message: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
    }
    if (!data.firstName || data.firstName.trim().length < 2) {
      errors.push({ field: "firstName", message: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u0648\u0644 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 2 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    if (!data.lastName || data.lastName.trim().length < 2) {
      errors.push({ field: "lastName", message: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0623\u062E\u064A\u0631 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 2 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    if (!data.companyName || data.companyName.trim().length < 2) {
      errors.push({ field: "companyName", message: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 2 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644" });
    }
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!data.phone || !phoneRegex.test(data.phone)) {
      errors.push({ field: "phone", message: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
    }
    if (!data.serviceId || data.serviceId <= 0) {
      errors.push({ field: "serviceId", message: "\u064A\u062C\u0628 \u0627\u062E\u062A\u064A\u0627\u0631 \u062E\u062F\u0645\u0629" });
    }
    if (!data.amount || data.amount <= 0) {
      errors.push({ field: "budget", message: "\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0635\u0641\u0631" });
    }
    return errors;
  }
  /**
   * إرسال بريد تأكيد الاشتراك
   */
  async sendSubscriptionConfirmationEmail(email, firstName) {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: email,
        subject: "\u062A\u0623\u0643\u064A\u062F \u0637\u0644\u0628\u0643 - SEO",
        html: `
          <h1>\u0645\u0631\u062D\u0628\u0627\u064B ${firstName}!</h1>
          <p>\u0634\u0643\u0631\u0627\u064B \u0639\u0644\u0649 \u0627\u062E\u062A\u064A\u0627\u0631\u0643 SEO</p>
          <p>\u062A\u0645 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0637\u0644\u0628\u0643 \u0628\u0646\u062C\u0627\u062D</p>
          <p>\u0633\u064A\u062A\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0642\u0631\u064A\u0628\u0627\u064B \u0644\u0645\u0646\u0627\u0642\u0634\u0629 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0634\u0631\u0648\u0639</p>
          <a href="${process.env.FRONTEND_URL}/dashboard">\u0639\u0631\u0636 \u0637\u0644\u0628\u0643</a>
        `
      });
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0631\u0633\u0627\u0644 \u0628\u0631\u064A\u0644 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:", error);
    }
  }
  /**
   * إرسال إخطار الاشتراك للفريق
   */
  async sendSubscriptionNotificationEmail(data, orderId) {
    try {
      await this.transporter?.sendMail({
        from: process.env.EMAIL_FROM || "noreply@seo.com",
        to: process.env.SUPPORT_EMAIL || "support@seo.com",
        subject: `\u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u062C\u062F\u064A\u062F \u0645\u0646 ${data.companyName}`,
        html: `
          <h2>\u0637\u0644\u0628 \u0627\u0634\u062A\u0631\u0627\u0643 \u062C\u062F\u064A\u062F</h2>
          <p><strong>\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628:</strong> ${orderId}</p>
          <p><strong>\u0627\u0644\u0627\u0633\u0645:</strong> ${data.firstName} ${data.lastName}</p>
          <p><strong>\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A:</strong> ${data.email}</p>
          <p><strong>\u0627\u0644\u0647\u0627\u062A\u0641:</strong> ${data.phone}</p>
          <p><strong>\u0627\u0644\u0634\u0631\u0643\u0629:</strong> ${data.companyName}</p>
          <p><strong>\u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629:</strong> $${data.amount}</p>
          <p><strong>\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A:</strong> ${data.notes || "\u0628\u062F\u0648\u0646 \u0645\u0644\u0627\u062D\u0638\u0627\u062A"}</p>
          <a href="${process.env.FRONTEND_URL}/admin/orders/${orderId}">\u0639\u0631\u0636 \u0627\u0644\u0637\u0644\u0628</a>
        `
      });
    } catch (error) {
      console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0631\u0633\u0627\u0644 \u0625\u062E\u0637\u0627\u0631 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643:", error);
    }
  }
};

// ../backend/server.ts
dotenv.config({ override: true });
var app = express();
var PORT = process.env.PORT ;
app.use(helmet());
var limiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 100,
  message: "\u0639\u062F\u062F \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0643\u062B\u064A\u0631 \u062C\u062F\u0627\u064B\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u0627\u064B"
});
app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL ,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.json({ verify: (req, res, buf) => {
  req.rawBody = buf;
} }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
var pool = mysql.createPool({
  host: process.env.DB_HOST ,
  user: process.env.DB_USER ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_NAME ,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4"
});
var transporter = null;
if (process.env.DISABLE_EMAIL !== "true") {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "localhost",
    port: parseInt(process.env.EMAIL_PORT || "1025"),
    secure: process.env.EMAIL_SECURE === "true",
    ignoreTLS: process.env.EMAIL_IGNORETLS === "true",
    auth: process.env.EMAIL_USER && process.env.EMAIL_PASSWORD ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD } : void 0
  });
  transporter.verify().then(() => console.log("\u2705 SMTP server ready")).catch((err) => console.warn("\u26A0\uFE0F SMTP not available:", err.message));
} else {
  console.log("\u{1F4E7} Email disabled by configuration");
}
var userService = new UserService(pool, transporter, process.env.JWT_SECRET || "secret");
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-02-24" });
var paymentService = new PaymentService(stripe, pool);
var formService = new FormService(pool, transporter);
var authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "\u0627\u0644\u062A\u0648\u0643\u0646 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    const decoded = jwt2.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "\u0627\u0644\u062A\u0648\u0643\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D" });
  }
};
app.post("/api/auth/register", async (req, res) => {
  try {
    const result = await userService.register(req.body);
    return res.status(201).json({
      message: "\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0628\u0646\u062C\u0627\u062D",
      token: result.token,
      user: {
        user_id: result.user_id,
        email: result.email,
        first_name: result.first_name,
        last_name: result.last_name
      }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.post("/api/auth/login", async (req, res) => {
  try {
    const result = await userService.login(req.body);
    return res.status(200).json({
      message: "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D",
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
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});
app.post("/api/auth/refresh-token", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const newToken = jwt2.sign(
    { user_id: req.user.user_id, email: req.user.email, user_type: req.user.user_type },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );
  return res.status(200).json({ token: newToken });
});
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const result = await userService.requestPasswordReset(req.body.email);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const result = await userService.resetPassword(req.body);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.get("/api/users/:id", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== "admin")
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
    const user = await userService.getUserById(userId);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
});
app.put("/api/users/:id", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== "admin")
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
    await userService.updateProfile(userId, req.body);
    return res.status(200).json({ message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.post("/api/users/change-password", authMiddleware, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
    await userService.changePassword(req.user.user_id, req.body);
    return res.status(200).json({ message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.delete("/api/users/:id", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (req.user?.user_id !== userId && req.user?.user_type !== "admin")
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
    await userService.deleteUser(userId);
    return res.status(200).json({ message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D" });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.get("/api/services", async (req, res) => {
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
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0627\u062A" });
  }
});
app.get("/api/services/:id", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [services] = await connection.execute(
        "SELECT * FROM services WHERE service_id = ? AND is_active = TRUE",
        [req.params.id]
      );
      if (services.length === 0) return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      return res.status(200).json(services[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u062E\u062F\u0645\u0629" });
  }
});
app.get("/api/orders", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
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
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u0637\u0644\u0628\u0627\u062A \u0627\u0648 \u0644\u0627 \u062A\u0648\u062C\u062F" });
  }
});
app.post("/api/orders", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const { service_id, project_name, website_url, amount, notes } = req.body;
  if (!service_id || !project_name || !amount)
    return res.status(400).json({ error: "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  try {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO orders (user_id, service_id, project_name, website_url, amount, status, notes)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [req.user.user_id, service_id, project_name, website_url || null, amount, notes || null]
      );
      return res.status(201).json({ message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628", order_id: result.insertId });
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628" });
  }
});
app.get("/api/orders/:id", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
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
      return res.status(404).json({ error: "\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
    return res.status(200).json(orders[0]);
  } catch (error) {
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628" });
  } finally {
    connection.release();
  }
});
app.get("/api/orders/:id/summary", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  try {
    const connection = await pool.getConnection();
    try {
      const [orders] = await connection.execute(
        `SELECT o.order_id, o.project_name, o.amount, s.service_name
         FROM orders o JOIN services s ON o.service_id = s.service_id
         WHERE o.order_id = ? AND o.user_id = ? AND o.status = 'pending'`,
        [req.params.id, req.user.user_id]
      );
      if (orders.length === 0) return res.status(404).json({ error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062F\u0641\u0639 \u0644\u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628" });
      return res.status(200).json(orders[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0645\u0644\u062E\u0635 \u0627\u0644\u0637\u0644\u0628" });
  }
});
app.get("/api/packages", async (req, res) => {
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
    console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0628\u0627\u0642\u0627\u062A:", error);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
app.get("/api/packages/:id", async (req, res) => {
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
      if (packages.length === 0) {
        return res.status(404).json({ error: "\u0627\u0644\u0628\u0627\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
      }
      return res.status(200).json(packages[0]);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0627\u0644\u0628\u0627\u0642\u0629:", error);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
app.get("/api/reviews", async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [reviewsRows] = await connection.execute(
        `SELECT review_id, user_id, name, company, rating, comment, created_at, updated_at
         FROM reviews 
         WHERE is_published = TRUE 
         ORDER BY created_at DESC
         LIMIT 20`
      );
      const [statsRows] = await connection.execute(
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
          one_star: stats.one_star || 0
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u0622\u0631\u0627\u0621:", error);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
app.post("/api/reviews", async (req, res) => {
  try {
    const { name, company, rating, comment } = req.body;
    if (!name || !rating || !comment) {
      return res.status(400).json({ error: "\u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0648\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628\u0629" });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "\u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u064A\u0646 1 \u0648 5" });
    }
    if (comment.length < 5) {
      return res.status(400).json({ error: "\u0646\u0635 \u0627\u0644\u0631\u0623\u064A \u0642\u0635\u064A\u0631 \u062C\u062F\u0627\u064B" });
    }
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO reviews (name, company, rating, comment, is_published) 
         VALUES (?, ?, ?, ?, FALSE)`,
        [name, company || null, rating, comment]
      );
      if (transporter) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || "noreply@seo.com",
          to: process.env.SUPPORT_EMAIL || "admin@seo.com",
          subject: "\u0631\u0623\u064A \u062C\u062F\u064A\u062F \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629",
          html: `<h3>\u0631\u0623\u064A \u062C\u062F\u064A\u062F \u0645\u0646 ${name}</h3><p>${comment}</p><p>\u0627\u0644\u062A\u0642\u064A\u064A\u0645: ${rating} \u0646\u062C\u0648\u0645</p>`
        }).catch(console.error);
      }
      return res.status(201).json({
        message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0623\u064A\u0643 \u0628\u0646\u062C\u0627\u062D\u060C \u0633\u064A\u0646\u0634\u0631 \u0628\u0639\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629",
        review_id: result.insertId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("\u062E\u0637\u0623 \u0641\u064A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0631\u0623\u064A:", error);
    return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
  }
});
app.post("/api/payments/create-intent", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const { order_id, amount } = req.body;
  if (!order_id || !amount) return res.status(400).json({ error: "order_id \u0648 amount \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
  try {
    const result = await paymentService.createPaymentIntent({
      orderId: order_id,
      amount,
      userId: req.user.user_id
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});
app.post("/api/payments/confirm", authMiddleware, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  const { payment_intent_id, order_id } = req.body;
  try {
    const result = await paymentService.confirmPayment({
      paymentIntentId: payment_intent_id,
      orderId: order_id,
      userId: req.user.user_id
    });
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    await paymentService.handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err) {
    console.error(`Webhook error: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
app.post("/api/contact", async (req, res) => {
  try {
    const result = await formService.handleContactForm(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
app.post("/api/contact/reply/:messageId", authMiddleware, async (req, res) => {
  if (req.user?.user_type !== "admin") return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  try {
    const result = await formService.replyToMessage(parseInt(req.params.messageId), req.body.reply);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
var errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.name === "ValidationError") return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
  if (err.name === "UnauthorizedError") return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D" });
  return res.status(500).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
};
app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`\u{1F680} Server running on port ${PORT}`);
  console.log(`\u{1F4E7} Email: ${process.env.EMAIL_USER || "disabled"}`);
  console.log(`\u{1F4B3} Stripe: ${process.env.STRIPE_SECRET_KEY ? "Enabled" : "Disabled"}`);
  console.log(`\u{1F5C4}\uFE0F Database: ${process.env.DB_NAME}`);
});
var server_default = app;
export {
  server_default as default
};
