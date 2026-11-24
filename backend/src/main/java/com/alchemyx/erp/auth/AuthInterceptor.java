package com.alchemyx.erp.auth;

import com.alchemyx.erp.error.ApiException;
import com.alchemyx.erp.model.Entities.Member;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Requires a valid bearer token on every /api route except login, and stores the member on the request. */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    public static final String MEMBER_ATTRIBUTE = "erp.currentMember";
    public static final String TOKEN_ATTRIBUTE = "erp.token";
    private static final String BEARER = "Bearer ";

    private final AuthService auth;

    public AuthInterceptor(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String header = request.getHeader("Authorization");
        String token = header != null && header.startsWith(BEARER) ? header.substring(BEARER.length()).trim() : null;
        Member member = auth.resolve(token)
                .orElseThrow(() -> ApiException.unauthorized("Sign in to continue"));
        request.setAttribute(MEMBER_ATTRIBUTE, member);
        request.setAttribute(TOKEN_ATTRIBUTE, token);
        return true;
    }
}
