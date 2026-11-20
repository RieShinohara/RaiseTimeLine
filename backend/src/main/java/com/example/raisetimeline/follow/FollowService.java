package com.example.raisetimeline.follow;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.auth.User;
import com.example.raisetimeline.auth.UserMapper;
import com.example.raisetimeline.follow.FollowDtos.FollowResponse;

// フォロー・解除。自分自身は、フォローできない。何回押しても、結果は同じ
@Service
public class FollowService {

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

	private User requireUser(String username) {
		User user = userMapper.findByUsername(username);
		if (user == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "ユーザーが見つかりません");
		}
		return user;
	}

}
