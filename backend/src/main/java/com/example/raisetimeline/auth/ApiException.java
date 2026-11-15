package com.example.raisetimeline.auth;

import org.springframework.http.HttpStatus;

// 画面に返すエラー（状態コードと、利用者向けの文言）
public class ApiException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final HttpStatus status;

	public ApiException(HttpStatus status, String message) {
		super(message);
		this.status = status;
	}

	public HttpStatus getStatus() {
		return status;
	}

}
