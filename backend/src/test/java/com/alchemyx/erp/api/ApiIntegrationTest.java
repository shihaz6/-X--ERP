package com.alchemyx.erp.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * End-to-end checks against a real PostgreSQL container with every Flyway migration applied.
 * Skipped automatically when Docker is not available.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers(disabledWithoutDocker = true)
class ApiIntegrationTest {

    private static final String ADMIN = "test.admin";
    private static final String PASSWORD = "test-password-123";

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("app.bootstrap-admin.username", () -> ADMIN);
        registry.add("app.bootstrap-admin.email", () -> "test.admin@example.com");
        registry.add("app.bootstrap-admin.password", () -> PASSWORD);
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Test
    void adminSignsInCreatesProjectWithoutClientAndReadsWorkspace() {
        ResponseEntity<Map> login = rest.postForEntity("/api/auth/login",
                Map.of("username", ADMIN, "password", PASSWORD), Map.class);
        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        String token = (String) login.getBody().get("token");

        ResponseEntity<String> created = rest.exchange("/api/projects", org.springframework.http.HttpMethod.POST,
                json(token, Map.of("name", "No-client project", "clientId", "", "category", "Consulting",
                        "priority", "Medium", "budget", 100000, "start", "2027-01-01", "end", "2027-02-01")),
                String.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        ResponseEntity<String> workspace = rest.exchange("/api/workspace", org.springframework.http.HttpMethod.GET,
                json(token, null), String.class);
        assertThat(workspace.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(workspace.getBody()).contains("No-client project");
    }

    @Test
    void protectedRoutesRejectMissingToken() {
        ResponseEntity<String> response = rest.getForEntity("/api/workspace", String.class);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void resetRequestNeverRevealsWhetherAnEmailExists() {
        ResponseEntity<String> known = rest.postForEntity("/api/auth/forgot-password",
                Map.of("email", "test.admin@example.com"), String.class);
        ResponseEntity<String> unknown = rest.postForEntity("/api/auth/forgot-password",
                Map.of("email", "nobody@example.com"), String.class);
        assertThat(known.getStatusCode()).isEqualTo(unknown.getStatusCode());
    }

    private static HttpEntity<Object> json(String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new HttpEntity<>(body, headers);
    }
}
