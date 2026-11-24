package com.alchemyx.erp.api;

import com.alchemyx.erp.api.Dtos.LoginRequest;
import com.alchemyx.erp.api.Dtos.LoginResponse;
import com.alchemyx.erp.api.Dtos.MemberDto;
import com.alchemyx.erp.auth.AuthInterceptor;
import com.alchemyx.erp.auth.AuthService;
import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Member;
import com.alchemyx.erp.service.MemberService;
import com.alchemyx.erp.util.Fmt;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final MemberService members;
    private final Clock clock;

    public AuthController(AuthService auth, MemberService members, Clock clock) {
        this.auth = auth;
        this.members = members;
        this.clock = clock;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest req) {
        AuthService.Login result = auth.login(req.username(), req.password());
        return new LoginResponse(
                result.token(),
                Fmt.stamp(result.expiresAt(), clock.getZone()),
                members.toDto(result.member(), members.currentWeek()));
    }

    @PostMapping("/logout")
    public void logout(HttpServletRequest request) {
        Object token = request.getAttribute(AuthInterceptor.TOKEN_ATTRIBUTE);
        auth.logout(token == null ? null : token.toString());
    }

    @GetMapping("/me")
    public MemberDto me(Member me) {
        if (me == null) {
            throw ApiException.unauthorized("Sign in to continue");
        }
        return members.dto(me);
    }
}
