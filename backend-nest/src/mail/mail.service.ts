import { Inject, Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { AppConfig, CONFIG } from '../config.provider';

interface Attachment {
  name: string;
  content: Buffer;
}

/**
 * Sends email over SMTP when MAIL_HOST is set. Without it, messages are logged and skipped,
 * so the rest of the API keeps working in development.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private readonly transport: Transporter | null;

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {
    const { host, port, username, password } = config.mail;
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: username ? { user: username, pass: password } : undefined,
        })
      : null;
  }

  /** Resolves true when the message was handed to the mail server. Never throws. */
  async send(to: string | null | undefined, subject: string, text: string, attachment?: Attachment): Promise<boolean> {
    if (!to || !to.trim()) return false;
    if (!this.transport) {
      this.log.log(`Email not sent (SMTP not configured): to=${to} subject=${subject}`);
      return false;
    }
    try {
      await this.transport.sendMail({
        from: this.config.mailFrom,
        to,
        subject,
        text,
        attachments: attachment
          ? [{ filename: attachment.name, content: attachment.content, contentType: 'application/pdf' }]
          : undefined,
      });
      return true;
    } catch (err) {
      this.log.warn(`Email to ${to} failed: ${(err as Error).message}`);
      return false;
    }
  }
}
