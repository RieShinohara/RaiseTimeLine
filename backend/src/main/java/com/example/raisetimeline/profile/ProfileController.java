package com.example.raisetimeline.profile;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.raisetimeline.post.PostDtos.PostPageResponse;
import com.example.raisetimeline.profile.ProfileDtos.ProfileResponse;
import com.example.raisetimeline.profile.ProfileDtos.ProfileUpdateRequest;

import jakarta.validation.Valid;

// プロフィール。取得と投稿の一覧は、ログインなしで見られる（SecurityConfig で許可）。編集は、ログインが必要
// @AuthenticationPrincipal Long userId は、アクセストークンの持ち主の ID。ログインしていなければ null
@RestController
@RequestMapping("/api/users/{username}")
public class ProfileController {

	private final ProfileService profileService;

	public ProfileController(ProfileService profileService) {
		this.profileService = profileService;
	}

	@GetMapping
	public ProfileResponse get(@PathVariable String username, @AuthenticationPrincipal Long userId) {
		return profileService.get(username, userId);
	}

	@PutMapping
	public ProfileResponse update(@PathVariable String username, @Valid @RequestBody ProfileUpdateRequest request,
			@AuthenticationPrincipal Long userId) {
		return profileService.update(username, userId, request);
	}

	// そのユーザーの投稿（新しい順）。before：この投稿 id より古いものを返す（省略なら最新から）
	@GetMapping("/posts")
	public PostPageResponse posts(@PathVariable String username, @RequestParam(required = false) Long before,
			@RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal Long userId) {
		return profileService.listPosts(username, before, size, userId);
	}

}
