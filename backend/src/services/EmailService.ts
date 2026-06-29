import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4200";
    const verificationLink = `${frontendUrl}/verificar-email?token=${token}`;

    const mailOptions = {
      from: `"Sublime" <${process.env.SMTP_USER}>`,
      to: to,
      subject: "Confirme seu cadastro na Sublime",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Olá! Falta pouco para concluir seu cadastro.</h2>
          <p style="color: #666; font-size: 16px;">
            Agradecemos por se cadastrar na Sublime! Para garantir a segurança da sua conta e validar o seu e-mail, por favor, clique no botão abaixo:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
              Confirmar meu e-mail
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            Se o botão não funcionar, você pode copiar e colar o link abaixo no seu navegador:
            <br>
            <a href="${verificationLink}" style="color: #ec4899;">${verificationLink}</a>
          </p>
          <p style="color: #999; font-size: 12px; margin-top: 40px; text-align: center;">
            Se você não criou uma conta na Sublime, por favor ignore este e-mail.
          </p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
    } catch (error) {
      this.logger.error(`Erro ao enviar e-mail para ${to}:`, error);
    }
  }
}
