package com.example.raisetimeline.follow;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.auth.User;
import com.example.raisetimeline.auth.UserMapper;
import com.example.raisetimeline.follow.FollowDtos.FollowResponse;
import com.example.raisetimeline.follow.FollowDtos.FollowUserPageResponse;
import com.example.raisetimeline.follow.FollowDtos.FollowUserResponse;
import com.example.raisetimeline.follow.FollowMapper.FollowUserRow;

// フォロー・解除。自分自身は、フォローできない。何回押しても、結果は同じ
@Service
public class FollowService {

	// 一覧の size の上限（投稿の一覧と同じ）
	private static final int MAX_SIZE = 50;

	private final UserMapper userMapper;
	private final FollowMapper followMapper;

	public FollowService(UserMapper userMapper, FollowMapper followMapper) {
		this.userMapper = userMapper;
		this.followMapper = followMapper;
	}

	public FollowResponse follow(Long followerId, String username) {
		User target = requireUser(username);
		if (target.getId().equals(followerId)) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "自分自身は、フォローできません");
		}
		try {
			followMapper.insert(followerId, target.getId());
		} catch (DataIntegrityViolationException e) {
			// 確かめたあとに、相手が消えた（外部キーが止めた）。投稿・いいねと同じく、404 にする
			throw new ApiException(HttpStatus.NOT_FOUND, "ユーザーが見つかりません");
		}
		return new FollowResponse(followMapper.countFollowers(target.getId()), true);
	}

	public FollowResponse unfollow(Long followerId, String username) {
		User target = requireUser(username);
		followMapper.delete(followerId, target.getId());
		return new FollowResponse(followMapper.countFollowers(target.getId()), false);
	}

	// フォロワーの一覧（その人を、フォローしている人）。viewerId：ログイン中の人（ログインなしは null）
	public FollowUserPageResponse listFollowers(String username, int size, Long viewerId) {
		requireValidSize(size);
		User target = requireUser(username);
		// 1 件多く読んで、続きがあるかを知る
		return toPage(followMapper.findFollowers(target.getId(), size + 1), size, viewerId);
	}

	// フォロー中の一覧（その人が、フォローしている人）
	public FollowUserPageResponse listFollowing(String username, int size, Long viewerId) {
		requireValidSize(size);
		User target = requireUser(username);
		return toPage(followMapper.findFollowing(target.getId(), size + 1), size, viewerId);
	}

	private static void requireValidSize(int size) {
		if (size < 1 || size > MAX_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "size は 1〜" + MAX_SIZE + " で指定してください");
		}
	}

	// rows は、size + 1 件まで読んだ結果。size 件に切って、「自分がフォローしているか」を、まとめて 1 回で付ける
	// （全部で、ユーザー 1 回 ＋ 一覧 1 回 ＋ フォロー済み 1 回。人数が増えても、回数は変わらない）
	private FollowUserPageResponse toPage(List<FollowUserRow> rows, int size, Long viewerId) {
		boolean hasNext = rows.size() > size;
		List<FollowUserRow> page = rows.stream().limit(size).toList();
		List<Long> ids = page.stream().map(FollowUserRow::id).toList();
		Set<Long> followedByMe = viewerId == null || ids.isEmpty() ? Set.of()
				: new HashSet<>(followMapper.findFolloweeIds(viewerId, ids));
		List<FollowUserResponse> users = page.stream()
				.map(row -> new FollowUserResponse(row.id(), row.username(), row.displayName(), row.bio(),
						followedByMe.contains(row.id())))
				.toList();
		return new FollowUserPageResponse(users, hasNext);
	}

	private User requireUser(String username) {
		User user = userMapper.findByUsername(username);
		if (user == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "ユーザーが見つかりません");
		}
		return user;
	}

}
