package com.me.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private static final long ACCESS_EXPIRE = 30 * 60 * 1000L;

    private static final long REFRESH_EXPIRE = 7 * 24 * 60 * 60 * 1000L;

    private final SecretKey key;

    public JwtUtil(@Value("${JWT_SECRET}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(String username) {
        return generateToken(
                username,
                ACCESS_EXPIRE,
                "access"
        );
    }

    public String generateRefreshToken(String username) {
        return generateToken(
                username,
                REFRESH_EXPIRE,
                "refresh"
        );
    }

    private String generateToken(String username, long expire, String type) {

        Date now = new Date();

        return Jwts.builder()
                .subject(username)
                .claim("type", type)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expire))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUsername(String token) {
        return parseToken(token).getSubject();
    }

    public String getTokenType(String token) {
        return parseToken(token).get("type", String.class);
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}