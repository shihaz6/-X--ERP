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
@Table(name = "clients")
@Getter
@Setter
@NoArgsConstructor
public class Client {
    @Id
    private UUID id;
    private String name;
    private String industry;
    private String contact;
    private String email;
    private String phone;
    private String city;
    private String stage;
    private BigDecimal value;
    @Column(name = "owner_id")
    private UUID ownerId;
    @Column(name = "follow_up")
    private LocalDate followUp;
    private LocalDate since;
    @Column(name = "created_at")
    private Instant createdAt;
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "client_id")
    @OrderBy("createdAt DESC")
    private List<ClientNote> notes = new ArrayList<>();

    public Client(UUID id, String name, String industry, String contact, String email, String phone, String city,
                  String stage, BigDecimal value, UUID ownerId, LocalDate since, Instant createdAt) {
        this.id = id;
        this.name = name;
        this.industry = industry;
        this.contact = contact;
        this.email = email;
        this.phone = phone;
        this.city = city;
        this.stage = stage;
        this.value = value;
        this.ownerId = ownerId;
        this.since = since;
        this.createdAt = createdAt;
    }
}
