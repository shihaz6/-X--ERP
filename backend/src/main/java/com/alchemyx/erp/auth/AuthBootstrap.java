package com.alchemyx.erp.auth;

import com.alchemyx.erp.config.AppProperties;
import com.alchemyx.erp.model.Entities.Member;
import com.alchemyx.erp.model.Role;
import com.alchemyx.erp.repository.MemberRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * On an empty database, creates the first Super Admin from BOOTSTRAP_ADMIN_* environment variables.
 * Nothing is created if the variables are not set, so no default credentials ever exist.
 */
@Component
public class AuthBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AuthBootstrap.class);

    private final MemberRepository members;
    private final PasswordEncoder encoder;
    private final AppProperties props;
    private final Clock clock;

    public AuthBootstrap(MemberRepository members, PasswordEncoder encoder, AppProperties props, Clock clock) {
        this.members = members;
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (members.count() > 0) {
            return;
        }
        AppProperties.BootstrapAdmin admin = props.bootstrapAdmin();
        if (admin == null || blank(admin.username()) || blank(admin.email())
                || admin.password() == null || admin.password().length() < 8) {
            log.warn("No members exist. Set BOOTSTRAP_ADMIN_USERNAME, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD "
                    + "(password min 8 characters) and restart to create the first Super Admin.");
            return;
        }
        String username = admin.username().trim().toLowerCase();
        if (!username.matches("^[a-z0-9._-]{3,40}$")) {
            log.error("BOOTSTRAP_ADMIN_USERNAME must be 3-40 characters: letters, digits, dot, underscore or dash.");
            return;
        }
        String name = admin.name() == null || admin.name().isBlank() ? "Administrator" : admin.name().trim();
        members.save(new Member(
                UUID.randomUUID(),
                name,
                username,
                admin.email().trim().toLowerCase(),
                encoder.encode(admin.password()),
                Role.SUPER_ADMIN,
                "Administrator",
                "Leadership",
                initials(name),
                40,
                clock.instant()));
        log.info("Created bootstrap Super Admin '{}'", username);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    static String initials(String name) {
        StringBuilder sb = new StringBuilder();
        for (String part : name.trim().split("\\s+")) {
            if (!part.isEmpty() && sb.length() < 2) {
                sb.append(Character.toUpperCase(part.charAt(0)));
            }
        }
        return sb.isEmpty() ? "?" : sb.toString();
    }
}
