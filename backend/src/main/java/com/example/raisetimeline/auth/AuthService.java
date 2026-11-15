package com.example.raisetimeline.auth;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.AuthDtos.AccessTokenResponse;
import com.example.raisetimeline.auth.AuthDtos.LoginRequest;
import com.example.raisetimeline.auth.AuthDtos.LoginResponse;
import com.example.raisetimeline.auth.AuthDtos.RegisterRequest;
import com.example.raisetimeline.auth.AuthDtos.UserResponse;

@Service
public class AuthService {

	private static final String LOGIN_FAILED = "メールアドレスかパスワードが違います";
	private static final String TOKEN_INVALID = "ログインの期限が切れました。もう一度ログインしてください";

	private final UserMapper userMapper;
	private final RefreshTokenMapper refreshTokenMapper;
	private final PasswordEncoder passwordEncoder;
	private final JwtService jwtService;
	private final long refreshExpirationDays;

	public AuthService(UserMapper userMapper, RefreshTokenMapper refreshTokenMapper,
			PasswordEncoder passwordEncoder, JwtService jwtService,
			@Value("${app.jwt.refresh-expiration-days}") long refreshExpirationDays) {
		this.userMapper = userMapper;
		this.refreshTokenMapper = refreshTokenMapper;
		this.passwordEncoder = passwordEncoder;
		this.jwtService = jwtService;
		this.refreshExpirationDays = refreshExpirationDays;
	}

	public UserResponse register(RegisterRequest request) {
		String email = normalizeEmail(request.email());
		if (userMapper.existsByEmail(email)) {
			throw new ApiException(HttpStatus.CONFLICT, "このメールアドレスは、すでに使われています");
		}
		if (userMapper.existsByUsername(request.username())) {
			throw new ApiException(HttpStatus.CONFLICT, "このユーザー名は、すでに使われています");
		}
		User user = new User();
		user.setEmail(email);
		user.setUsername(request.username());
		user.setDisplayName(request.displayName());
		user.setPasswordHash(passwordEncoder.encode(request.password()));
		try {
			userMapper.insert(user);
		} catch (DuplicateKeyException e) {
			// 確認してから登録するまでの間に、同時に同じ値で登録された場合
			throw new ApiException(HttpStatus.CONFLICT, "メールアドレスかユーザー名が、すでに使われています");
		}
		return UserResponse.from(user);
	}

	public LoginResponse login(LoginRequest request) {
		User user = userMapper.findByEmail(normalizeEmail(request.email()));
		// メールが無い場合も、パスワードが違う場合も、同じ文言にする（どちらが違うかを教えない）
		if (user == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
			throw new ApiException(HttpStatus.UNAUTHORIZED, LOGIN_FAILED);
		}
		RefreshToken refreshToken = new RefreshToken();
		refreshToken.setUserId(user.getId());
		refreshToken.setToken(UUID.randomUUID().toString());
		refreshToken.setExpiresAt(Instant.now().plus(refreshExpirationDays, ChronoUnit.DAYS));
		refreshTokenMapper.insert(refreshToken);
		return new LoginResponse(jwtService.createAccessToken(user), refreshToken.getToken(),
				UserResponse.from(user));
	}

	public AccessTokenResponse refresh(String token) {
		RefreshToken refreshToken = refreshTokenMapper.findByToken(token);
		if (refreshToken == null || refreshToken.isRevoked()
				|| refreshToken.getExpiresAt().isBefore(Instant.now())) {
			throw new ApiException(HttpStatus.UNAUTHORIZED, TOKEN_INVALID);
		}
		User user = userMapper.findById(refreshToken.getUserId());
		if (user == null) {
			throw new ApiException(HttpStatus.UNAUTHORIZED, TOKEN_INVALID);
		}
		return new AccessTokenResponse(jwtService.createAccessToken(user));
	}

	// 何度呼んでも同じ結果（すでに無効、存在しない場合も、成功として扱う）
	public void logout(String token) {
		refreshTokenMapper.revokeByToken(token);
	}

	private static String normalizeEmail(String email) {
		return email.trim().toLowerCase(Locale.ROOT);
	}

}
