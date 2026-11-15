package com.example.raisetimeline.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

// アクセストークン（JWT）の発行と検証。中身は、持ち主の ID とメールアドレスだけ（秘密は入れない）
@Component
public final class JwtService {

	private final SecretKey key;
	private final long accessExpirationMs;

	public JwtService(@Value("${app.jwt.secret}") String secret,
			@Value("${app.jwt.access-expiration-ms}") long accessExpirationMs) {
		this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
		this.accessExpirationMs = accessExpirationMs;
	}

	public String createAccessToken(User user) {
		Date now = new Date();
		return Jwts.builder()
				.subject(String.valueOf(user.getId()))
				.claim("email", user.getEmail())
				.issuedAt(now)
				.expiration(new Date(now.getTime() + accessExpirationMs))
				.signWith(key)
				.compact();
	}

	// 署名と期限が正しければ、持ち主の ID を返す。そうでなければ、空
	public Optional<Long> parseUserId(String token) {
		try {
			Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
			return Optional.of(Long.valueOf(claims.getSubject()));
		} catch (JwtException | IllegalArgumentException e) {
			return Optional.empty();
		}
	}

}
