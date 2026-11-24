package com.alchemyx.erp.config;

import java.time.Clock;
import java.time.ZoneId;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Dependency-free beans. Kept apart from AppConfig so the auth layer can use them without a cycle. */
@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class CoreBeans {

    private final AppProperties props;

    public CoreBeans(AppProperties props) {
        this.props = props;
    }

    /** All business dates and timestamps are interpreted in the workspace timezone (Asia/Colombo). */
    @Bean
    public Clock clock() {
        return Clock.system(ZoneId.of(props.timezone()));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
