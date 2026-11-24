package com.alchemyx.erp.repository;

import com.alchemyx.erp.model.Member;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, UUID> {

    List<Member> findAllByOrderByNameAsc();

    Optional<Member> findByEmailIgnoreCase(String email);

    Optional<Member> findByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);
}
