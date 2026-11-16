package com.example.raisetimeline.post;

import java.time.Instant;

// posts 表の 1 行。一覧と詳細では、投稿者の名前（users 表）も、同じ SQL で一緒に読む（N+1 を避ける）
public class Post {

	private Long id;
	private Long userId;
	private String body;
	private Instant createdAt;
	private Instant updatedAt;
	// 以下の 2 つは、users 表から。読むときだけ入る
	private String username;
	private String displayName;

	public Long getId() {
		return id;
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getUserId() {
		return userId;
	}

	public void setUserId(Long userId) {
		this.userId = userId;
	}

	public String getBody() {
		return body;
	}

	public void setBody(String body) {
		this.body = body;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

	public void setUpdatedAt(Instant updatedAt) {
		this.updatedAt = updatedAt;
	}

	public String getUsername() {
		return username;
	}

	public void setUsername(String username) {
		this.username = username;
	}

	public String getDisplayName() {
		return displayName;
	}

	public void setDisplayName(String displayName) {
		this.displayName = displayName;
	}

}
