package com.alchemyx.erp.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "password_resets")
@Getter
@Setter
@NoArgsConstructor
public class PasswordReset {
    @Id
    @Column(name = "token_hash", length = 64)
    private String tokenHash;
    @Column(name = "member_id")
    private UUID memberId;
    @Column(name = "expires_at")
    private Instant expiresAt;
    private boolean used;
    @Column(name = "created_at")
    private Instant createdAt;

    public PasswordReset(String tokenHash, UUID memberId, Instant expiresAt, Instant createdAt) {
        this.tokenHash = tokenHash;
        this.memberId = memberId;
        this.expiresAt = expiresAt;
        this.used = false;
        this.createdAt = createdAt;
    }
}
