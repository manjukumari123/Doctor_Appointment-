import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.MAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.MAIL_USER || '',
        pass: process.env.MAIL_PASSWORD || '',
      },
    });
  }

  async sendRescheduleEmail(
    email: string,
    firstName: string,
    nextDates: string[],
  ): Promise<void> {
    const mailOptions = {
      from: process.env.MAIL_FROM || 'noreply@doctorapp.com',
      to: email,
      subject: 'Appointment Reschedule - Next Available Dates',
      html: `
        <h2>Hello ${firstName},</h2>
        <p>We regret to inform you that there are no available slots for your requested date.</p>
        <p>Here are the next 3 available dates:</p>
        <ul>
          ${nextDates.map((date) => `<li>${date}</li>`).join('')}
        </ul>
        <p>Please choose a new date from the above options.</p>
        <p>Thank you!</p>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Reschedule email sent to ${email}`);
    } catch (error) {
      console.error(`Failed to send email to ${email}:`, error);
    }
  }
}