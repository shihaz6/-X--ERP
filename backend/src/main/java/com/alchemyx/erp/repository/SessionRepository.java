package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Session;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessionRepository extends JpaRepository<Session, String> {

    @Modifying
    @Query("delete from AuthSession s where s.expiresAt < :now")
    int deleteExpiredBefore(@Param("now") Instant now);

    @Modifying
    @Query("delete from AuthSession s where s.memberId = :memberId")
    int deleteForMember(@Param("memberId") UUID memberId);
}
