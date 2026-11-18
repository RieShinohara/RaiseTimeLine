package com.example.raisetimeline.comment;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.example.raisetimeline.auth.ApiException;
import com.example.raisetimeline.comment.CommentDtos.CommentListResponse;
import com.example.raisetimeline.comment.CommentDtos.CommentRequest;
import com.example.raisetimeline.comment.CommentDtos.CommentResponse;
import com.example.raisetimeline.comment.CommentDtos.ReplyResponse;
import com.example.raisetimeline.post.Post;
import com.example.raisetimeline.post.PostMapper;

// コメントと返信。ログインなしで見られ、書く・消すにはログインが要る
@Service
public class CommentService {

	private final CommentMapper commentMapper;
	private final PostMapper postMapper;

	public CommentService(CommentMapper commentMapper, PostMapper postMapper) {
		this.commentMapper = commentMapper;
		this.postMapper = postMapper;
	}

	// コメントを古い順に、返信は各コメントの下に古い順に（CMT-5）。SQL は 1 回で読み、入れ子は、ここで組み立てる
	public CommentListResponse list(Long postId) {
		requirePost(postId);
		List<Comment> rows = commentMapper.findByPostId(postId);
		Map<Long, List<ReplyResponse>> repliesByParent = new LinkedHashMap<>();
		List<Comment> topLevel = new ArrayList<>();
		for (Comment c : rows) {
			if (c.getParentCommentId() == null) {
				topLevel.add(c);
				repliesByParent.put(c.getId(), new ArrayList<>());
			}
		}
		for (Comment c : rows) {
			if (c.getParentCommentId() != null) {
				repliesByParent.get(c.getParentCommentId()).add(ReplyResponse.from(c));
			}
		}
		List<CommentResponse> comments = topLevel.stream()
				.map(c -> CommentResponse.from(c, repliesByParent.get(c.getId())))
				.toList();
		// 数は、返信を含む合計（CMT-1b）
		return new CommentListResponse(comments, rows.size());
	}

	// 返信のとき、返信先が返信なら、その元のコメントの返信にする（1 段のまま。CMT-1a）
	public CommentResponse create(Long userId, Long postId, CommentRequest request) {
		requirePost(postId);
		Long parentId = null;
		if (request.parentCommentId() != null) {
			Comment parent = commentMapper.findById(request.parentCommentId());
			if (parent == null || !parent.getPostId().equals(postId)) {
				throw new ApiException(HttpStatus.BAD_REQUEST, "返信先のコメントが見つかりません");
			}
			parentId = parent.getParentCommentId() != null ? parent.getParentCommentId() : parent.getId();
		}
		Comment comment = new Comment();
		comment.setPostId(postId);
		comment.setUserId(userId);
		comment.setParentCommentId(parentId);
		comment.setBody(request.body());
		try {
			commentMapper.insert(comment);
		} catch (DataIntegrityViolationException e) {
			// 確認のあとに、投稿や返信先が消された（外部キーが止めた）
			throw new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
		}
		return CommentResponse.from(commentMapper.findById(comment.getId()), List.of());
	}

	// 削除できるのは、書いた人と、その投稿をした人（CMT-3）。返信も一緒に消える（CMT-1c）
	public void delete(Long userId, Long id) {
		Comment comment = commentMapper.findById(id);
		if (comment == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "コメントが見つかりません");
		}
		Post post = postMapper.findById(comment.getPostId());
		boolean isAuthor = comment.getUserId().equals(userId);
		boolean isPostOwner = post != null && post.getUserId().equals(userId);
		if (!isAuthor && !isPostOwner) {
			throw new ApiException(HttpStatus.FORBIDDEN, "このコメントは、削除できません");
		}
		// すでに消えていても（確認のあとに、ほかで消された）、結果は同じ「消えている」ので、件数は見ない
		commentMapper.deleteById(id);
	}

	private void requirePost(Long postId) {
		if (postMapper.findById(postId) == null) {
			throw new ApiException(HttpStatus.NOT_FOUND, "投稿が見つかりません");
		}
	}

}
