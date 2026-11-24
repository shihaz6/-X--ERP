package com.alchemyx.erp.service;

import com.alchemyx.erp.config.AppProperties;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.model.PasswordReset;
import com.alchemyx.erp.repository.MemberRepository;
import com.alchemyx.erp.repository.PasswordResetRepository;
import com.alchemyx.erp.repository.SessionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forgot-password and reset. The reply to a reset request never says whether the email exists.
 * Reset links are single use and expire after one hour. Resetting signs the member out everywhere.
 */
@Service
public class PasswordResetService {

    private static final Duration TTL = Duration.ofHours(1);

    private final MemberRepository members;
    private final PasswordResetRepository resets;
    private final SessionRepository sessions;
    private final PasswordEncoder encoder;
    private final EmailService email;
    private final AppProperties props;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(MemberRepository members, PasswordResetRepository resets, SessionRepository sessions,
                                PasswordEncoder encoder, EmailService email, AppProperties props, Clock clock) {
        this.members = members;
        this.resets = resets;
        this.sessions = sessions;
        this.encoder = encoder;
        this.email = email;
        this.props = props;
        this.clock = clock;
    }

    @Transactional
    public void request(String address) {
        if (address == null || address.isBlank()) {
            return;
        }
        members.findByEmailIgnoreCase(address.trim())
                .filter(Member::isActive)
                .ifPresent(m -> {
                    byte[] raw = new byte[32];
                    random.nextBytes(raw);
                    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
                    Instant now = Instant.now(clock);
                    resets.invalidateForMember(m.getId());
                    resets.save(new PasswordReset(sha256(token), m.getId(), now.plus(TTL), now));
                    String base = props.frontendUrl() == null ? "http://localhost:8443" : props.frontendUrl();
                    String link = base + "/?reset=" + token;
                    email.send(m.getEmail(), "Reset your AlchemyX password",
                            "Hello " + m.getName() + ",\n\nUse this link to choose a new password. It works once and expires in one hour:\n\n"
                                    + link + "\n\nIf you did not ask for this, you can ignore this email.",
                            null, null);
                });
    }

    @Transactional
    public void reset(String token, String password) {
        if (token == null || token.isBlank()) {
            throw ApiException.badRequest("This reset link is invalid or has expired");
        }
        PasswordReset r = resets.findById(sha256(token))
                .filter(x -> !x.isUsed() && x.getExpiresAt().isAfter(Instant.now(clock)))
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid or has expired"));
        if (password == null || password.length() < 8) {
            throw ApiException.badRequest("Password must be at least 8 characters");
        }
        Member m = members.findById(r.getMemberId())
                .orElseThrow(() -> ApiException.badRequest("This reset link is invalid or has expired"));
        m.setPasswordHash(encoder.encode(password));
        r.setUsed(true);
        sessions.deleteForMember(m.getId());
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
