package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Session;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessionRepository extends JpaRepository<Session, String> {

    @Modifying
    @Query("delete from AuthSession s where s.expiresAt < :now")
    int deleteExpiredBefore(@Param("now") Instant now);
}
