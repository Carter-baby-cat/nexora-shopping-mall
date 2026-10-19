package com.me.security;

import com.me.response.ResultWriter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;
    private final ResultWriter resultWriter;

    public JwtAuthenticationFilter(
            JwtUtil jwtUtil,
            UserDetailsService userDetailsService,
            ResultWriter resultWriter) {

        this.jwtUtil = jwtUtil;
        this.userDetailsService = userDetailsService;
        this.resultWriter = resultWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path.equals("/user/login") || path.equals("/user/register");
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain)
            throws ServletException, IOException {

        String accessToken = getAccessToken(request);

        if (accessToken != null
                && jwtUtil.isValid(accessToken)
                && "access".equals(jwtUtil.getTokenType(accessToken))) {

            authenticate(accessToken);

            filterChain.doFilter(request, response);
            return;
        }

        String refreshToken = getRefreshToken(request);

        if (refreshToken != null
                && jwtUtil.isValid(refreshToken)
                && "refresh".equals(jwtUtil.getTokenType(refreshToken))) {

            String username = jwtUtil.getUsername(refreshToken);

            String newAccessToken = jwtUtil.generateAccessToken(username);

            response.setHeader("Authorization", "Bearer " + newAccessToken);
            resultWriter.write(
                    response,
                    HttpStatus.UNAUTHORIZED.value(),
                    "Access token expired; new access token issued in response header"
            );
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {

        String username = jwtUtil.getUsername(token);

        UserDetails userDetails = userDetailsService.loadUserByUsername(username);

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );

        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private String getAccessToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    private String getRefreshToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if ("refreshToken".equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}