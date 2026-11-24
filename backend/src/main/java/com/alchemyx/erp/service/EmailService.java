package com.alchemyx.erp.service;

import com.alchemyx.erp.config.AppProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Sends email when SMTP is configured (spring.mail.host). Without it, emails are logged and skipped,
 * so the rest of the application keeps working in development.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final ObjectProvider<JavaMailSender> mailSender;
    private final AppProperties props;

    public EmailService(ObjectProvider<JavaMailSender> mailSender, AppProperties props) {
        this.mailSender = mailSender;
        this.props = props;
    }

    /** Returns true when the message was handed to the mail server. */
    public boolean send(String to, String subject, String body, byte[] attachment, String attachmentName) {
        if (to == null || to.isBlank()) {
            return false;
        }
        JavaMailSender sender = mailSender.getIfAvailable();
        if (sender == null) {
            log.info("Email not sent (SMTP not configured): to={} subject={}", to, subject);
            return false;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, attachment != null, "UTF-8");
            helper.setFrom(props.mailFrom());
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(body, false);
            if (attachment != null) {
                helper.addAttachment(attachmentName, new ByteArrayResource(attachment), "application/pdf");
            }
            sender.send(message);
            return true;
        } catch (MessagingException | RuntimeException e) {
            log.warn("Email to {} failed: {}", to, e.getMessage());
            return false;
        }
    }
}
