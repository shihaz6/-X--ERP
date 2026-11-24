package com.alchemyx.erp.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        String timezone,
        List<String> corsAllowedOrigins,
        Duration sessionTtl,
        long maxUploadBytes,
        BootstrapAdmin bootstrapAdmin,
        String mailFrom,
        String frontendUrl,
        String billingCron,
        String overdueCron) {

    /** Optional. Creates the first Super Admin when the members table is empty. */
    public record BootstrapAdmin(String username, String email, String password, String name) {}
}
