package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.PasswordReset;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PasswordResetRepository extends JpaRepository<PasswordReset, String> {

    @Modifying
    @Query("update PasswordReset r set r.used = true where r.memberId = :memberId and r.used = false")
    int invalidateForMember(@Param("memberId") UUID memberId);
}
