package com.example.raisetimeline.post;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.comment.CommentMapper;
import com.example.raisetimeline.comment.CommentMapper.CommentCount;
import com.example.raisetimeline.post.PostDtos.NewCountResponse;
import com.example.raisetimeline.post.PostDtos.PostPageResponse;
import com.example.raisetimeline.post.PostDtos.PostResponse;
import com.example.raisetimeline.post.PostLikeMapper.LikeCount;

@Service
public class PostService {

	static final int MAX_SIZE = 50;

	private final PostMapper postMapper;
	private final PostLikeMapper postLikeMapper;
	private final CommentMapper commentMapper;

	public PostService(PostMapper postMapper, PostLikeMapper postLikeMapper, CommentMapper commentMapper) {
		this.postMapper = postMapper;
		this.postLikeMapper = postLikeMapper;
		this.commentMapper = commentMapper;
	}

	// before：この id より古い投稿を返す（空なら最新から）。size：1〜50
	// userId：ログイン中の人（ログインなしは null）。「自分が押したか」の判断に使う
	public PostPageResponse list(Long before, int size, Long userId) {
		requireValidSize(size);
		// 1 件多く読んで、続きがあるかを知る
		return toPage(postMapper.findOlderThan(before, size + 1), size, userId);
	}

	// プロフィール用：authorId の人の投稿だけ。見せ方は、list と同じ（新しい順、続きの目印、数のまとめ読み）。
	// authorId の人がいるかの確認は、呼ぶ側（ProfileService）で行う
	public PostPageResponse listByUserId(Long authorId, Long before, int size, Long userId) {
		requireValidSize(size);
		return toPage(postMapper.findOlderThanByUserId(authorId, before, size + 1), size, userId);
	}

	// 「フォロー中」：userId の人が、フォローしている人の投稿だけ。見せ方は、list と同じ。
	// ログインが要る（SecurityConfig で、先に 401 にする）
	public PostPageResponse listFollowing(Long userId, Long before, int size) {
		requireValidSize(size);
		return toPage(postMapper.findOlderThanFollowedBy(userId, before, size + 1), size, userId);
	}

	// 「フォロー中」の新着の件数。after より新しい、フォローしている人の投稿の数
	public NewCountResponse newCountFollowing(Long userId, long after) {
		requireValidAfter(after);
		return new NewCountResponse(postMapper.countNewerThanFollowedBy(after, userId));
	}

	private static void requireValidAfter(long after) {
		if (after < 0) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "after は 0 以上で指定してください");
		}
	}

	private static void requireValidSize(int size) {
		if (size < 1 || size > MAX_SIZE) {
			throw new ApiException(HttpStatus.BAD_REQUEST, "size は 1〜" + MAX_SIZE + " で指定してください");
		}
	}

	// rows は、size + 1 件まで読んだ結果。size 件に切って、数と「押したか」を、まとめて付ける
	private PostPageResponse toPage(List<Post> rows, int size, Long userId) {
		boolean hasNext = rows.size() > size;
		List<Post> page = rows.stream().limit(size).toList();
		// N+1 を避ける：数と「押したか」は、20 件ぶんを、まとめて 1 回ずつ聞く（全部で 1 + 1 + 1 回。
		// 件数が増えても、回数は変わらない）。1 件ずつ聞くと、1 + N + N 回になる
		List<Long> ids = page.stream().map(Post::getId).toList();
		Map<Long, Long> likeCounts = ids.isEmpty() ? Map.of()
				: postLikeMapper.countByPostIds(ids).stream()
						.collect(Collectors.toMap(LikeCount::postId, LikeCount::likeCount));
		Set<Long> likedByMe = userId == null || ids.isEmpty() ? Set.of()
				: new HashSet<>(postLikeMapper.findLikedPostIds(userId, ids));
		Map<Long, Long> commentCounts = ids.isEmpty() ? Map.of()
				: commentMapper.countByPostIds(ids).stream()
						.collect(Collectors.toMap(CommentCount::postId, CommentCount::commentCount));
		List<PostResponse> posts = page.stream()
				// いいね・コメントが 0 件の投稿は、まとめて数えた結果に出てこないので、0 にする
				.map(post -> PostResponse.from(post, likeCounts.getOrDefault(post.getId(), 0L),
						likedByMe.contains(post.getId()), commentCounts.getOrDefault(post.getId(), 0L)))
				.toList();
		return new PostPageResponse(posts, hasNext);
	}

	// 投稿 1 件（詳細画面用）。ログインなしでも見られる
	public PostResponse get(Long id, Long userId) {
		Post post = postMapper.findById(id);
		if (post == null) {
			throw notFound();
		}
		return toResponse(post, userId);
	}

	private PostResponse toResponse(Post post, Long userId) {
		long likeCount = postLikeMapper.countByPostId(post.getId());
		boolean likedByMe = userId != null && postLikeMapper.exists(post.getId(), userId);
		return PostResponse.from(post, likeCount, likedByMe, commentMapper.countByPostId(post.getId()));
	}

	// after より新しい（id が大きい）投稿の件数。ログイン中なら、自分の投稿は数えない
	// （自分が投稿したときは、一番上にすぐ出るため）
	public NewCountResponse newCount(long after, Long userId) {
		requireValidAfter(after);
		long count = userId == null
				? postMapper.countNewerThan(after)
				: postMapper.countNewerThanExcludingUser(after, userId);
		return new NewCountResponse(count);
	}

	public PostResponse create(Long userId, String body) {
		Post post = new Post();
		post.setUserId(userId);
		post.setBody(body);
		postMapper.insert(post);
		// できたばかりなので、いいね・コメントは 0 件
		return PostResponse.from(postMapper.findById(post.getId()), 0, false, 0);
	}

	public PostResponse update(Long userId, Long id, String body) {
		Post post = findOwned(userId, id);
		// 本文が同じなら、更新しない（「編集済み」にしない）。
		// 更新の SQL にも本人の条件があるので、確認のあとに投稿が消されると、0 件になる → 404（B8）
		if (!body.equals(post.getBody()) && postMapper.updateBody(id, userId, body) == 0) {
			throw notFound();
		}
		Post updated = postMapper.findById(id);
		if (updated == null) {
			throw notFound();
		}
		return toResponse(updated, userId);
	}

	public void delete(Long userId, Long id) {
		findOwned(userId, id);
		// すでに消えていても（確認のあとに、ほかで消された）、結果は同じ「消えている」ので、件数は見ない
		postMapper.deleteById(id, userId);
	}

	private static ApiException notFound() {
		return new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
	}

	// 編集・削除は、本人だけ。他の人の投稿は、サーバー側でも拒否する
	private Post findOwned(Long userId, Long id) {
		Post post = postMapper.findById(id);
		if (post == null) {
			throw notFound();
		}
		if (!post.getUserId().equals(userId)) {
			throw new ApiException(HttpStatus.FORBIDDEN, "他の人の投稿は、編集・削除できません");
		}
		return post;
	}

}
