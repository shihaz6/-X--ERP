package com.alchemyx.erp.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "members")
@Getter
@Setter
@NoArgsConstructor
public class Member {
    @Id
    private UUID id;
    private String name;
    private String username;
    private String email;
    @Column(name = "password_hash")
    private String passwordHash;
    @Enumerated(EnumType.STRING)
    private Role role;
    @Column(name = "job_title")
    private String jobTitle;
    private String department;
    private String initials;
    @Column(name = "capacity_hours")
    private int capacityHours;
    /** Stored availability: "Available" or "Busy". "On Leave" is derived from approved leave. */
    private String availability;
    private boolean active;
    @Column(name = "created_at")
    private Instant createdAt;

    public Member(UUID id, String name, String username, String email, String passwordHash, Role role, String jobTitle,
                  String department, String initials, int capacityHours, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.username = username;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.jobTitle = jobTitle;
        this.department = department;
        this.initials = initials;
        this.capacityHours = capacityHours;
        this.availability = "Available";
        this.active = true;
        this.createdAt = createdAt;
    }
}
