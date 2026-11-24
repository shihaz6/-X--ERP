package com.alchemyx.erp.auth;

import com.alchemyx.erp.config.AppProperties;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Entities.Member;
import com.alchemyx.erp.model.Entities.Session;
import com.alchemyx.erp.repository.MemberRepository;
import com.alchemyx.erp.repository.SessionRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Email/password login with opaque bearer sessions. Tokens are random; only their SHA-256 is stored. */
@Service
public class AuthService {

    private final MemberRepository members;
    private final SessionRepository sessions;
    private final PasswordEncoder encoder;
    private final Clock clock;
    private final AppProperties props;
    private final SecureRandom random = new SecureRandom();

    public AuthService(MemberRepository members, SessionRepository sessions, PasswordEncoder encoder,
                       Clock clock, AppProperties props) {
        this.members = members;
        this.sessions = sessions;
        this.encoder = encoder;
        this.clock = clock;
        this.props = props;
    }

    public record Login(String token, Instant expiresAt, Member member) {}

    @Transactional
    public Login login(String identifier, String password) {
        String id = identifier == null ? "" : identifier.trim();
        // Accept either the username or the email address.
        Member member = (id.contains("@") ? members.findByEmailIgnoreCase(id) : members.findByUsernameIgnoreCase(id))
                .filter(Member::isActive)
                .orElse(null);
        // Same message for unknown email, wrong password and deactivated account.
        if (member == null || password == null || !encoder.matches(password, member.getPasswordHash())) {
            throw ApiException.unauthorized("Invalid email or password");
        }
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);

        Instant now = Instant.now(clock);
        Instant expires = now.plus(props.sessionTtl());
        sessions.save(new Session(sha256(token), member.getId(), now, expires));
        return new Login(token, expires, member);
    }

    @Transactional
    public void logout(String token) {
        if (token != null) {
            sessions.deleteById(sha256(token));
        }
    }

    @Transactional(readOnly = true)
    public Optional<Member> resolve(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        return sessions.findById(sha256(token))
                .filter(s -> s.getExpiresAt().isAfter(Instant.now(clock)))
                .flatMap(s -> members.findById(s.getMemberId()))
                .filter(Member::isActive);
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
