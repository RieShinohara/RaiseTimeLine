package com.example.raisetimeline.search;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.auth.UserMapper;
import com.example.raisetimeline.auth.UserMapper.UserSearchRow;
import com.example.raisetimeline.follow.FollowDtos.FollowUserPageResponse;
import com.example.raisetimeline.follow.FollowDtos.FollowUserResponse;
import com.example.raisetimeline.follow.FollowMapper;

// ユーザー検索（UC-12）。ユーザー名か表示名に、入力した文字を含む人（部分一致・大文字小文字を区別しない）
@Service
public class UserSearchService {

	// 1 回に返す人数の上限（フォロー一覧・投稿の一覧と同じ）
	private static final int MAX_SIZE = 50;
	// 入力の長さの上限（表示名の上限と同じ）
	static final int MAX_QUERY_LENGTH = 50;

	private final UserMapper userMapper;
	private final FollowMapper followMapper;

	public UserSearchService(UserMapper userMapper, FollowMapper followMapper) {
		this.userMapper = userMapper;
		this.followMapper = followMapper;
	}

	// q：入力した文字。size：1〜50。viewerId：ログイン中の人（ログインなしは null）
	public FollowUserPageResponse search(String q, int size, Long viewerId) {
		if (size < 1 || size > MAX_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "size は 1〜" + MAX_SIZE + " で指定してください");
		}
		// 前後の空白（全角も）を取る。空白だけ・空は、探さない
		String text = q.strip();
		if (text.isEmpty()) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "検索する文字を入力してください");
		}
		if (text.length() > MAX_QUERY_LENGTH) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "検索する文字は " + MAX_QUERY_LENGTH + " 文字までです");
		}
		// 1 件多く読んで、続きがあるかを知る
		List<UserSearchRow> rows = userMapper.search(toContainsPattern(text), size + 1);
		boolean hasNext = rows.size() > size;
		List<UserSearchRow> page = rows.stream().limit(size).toList();
		// 「自分がフォローしているか」は、まとめて 1 回で聞く（N+1 を避ける。全部で、検索 1 回 ＋ フォロー済み 1 回）
		List<Long> ids = page.stream().map(UserSearchRow::id).toList();
		Set<Long> followedByMe = viewerId == null || ids.isEmpty() ? Set.of()
				: new HashSet<>(followMapper.findFolloweeIds(viewerId, ids));
		List<FollowUserResponse> users = page.stream()
				.map(row -> new FollowUserResponse(row.id(), row.username(), row.displayName(), row.bio(),
						followedByMe.contains(row.id())))
				.toList();
		return new FollowUserPageResponse(users, hasNext);
	}

	// 「入力した文字を含む」を表す LIKE の形（%入力%）にする。
	// LIKE では、% は「何文字でも」、_ は「1 文字」の意味になる。ユーザー名には _ が使えるので、そのままだと
	// 「a_b」で「axb」まで当てはまってしまう。入力の中の \ % _ には、前に \ を付けて、ただの文字として扱わせる
	// （\ を最初に直す。あとにすると、付けた \ まで、二重に直してしまう）
	static String toContainsPattern(String text) {
		String escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return "%" + escaped + "%";
	}

}
