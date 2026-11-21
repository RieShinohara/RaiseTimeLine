import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import type { CommentItem, Reply } from '../api/comments'
import { excerpt, formatDateTime } from '../timeline/format'
import AuthorName from './AuthorName'
import CommentForm from './CommentForm'
import type { DeleteTarget } from './DeleteCommentDialog'

interface Props {
  comment: CommentItem
  // ログイン中の人の id（ログインなしは null）と、この投稿をした人の id。削除ボタンを出す人の判断に使う
  // （書いた人と、投稿した人。CMT-3。本当の確認は、サーバーが行う）
  currentUserId: number | null
  postAuthorId: number
  // 返信を書く（ログインしているときだけ、「返信」のボタンが出る）
  onReply: (parentCommentId: number, body: string) => Promise<void>
  onDelete: (target: DeleteTarget) => void
  // 書いた人の名前を押したとき、プロフィールを開く（渡さなければ、名前を表示するだけ）
  onOpenAuthor?: (username: string) => void
}

// コメント 1 件の表示（コメントと返信で共用）。返信には「返信」ボタンはない（返信は 1 段だけ。CMT-1a）
function CommentRow({
  item,
  canDelete,
  onDelete,
  onReplyClick,
  onOpenAuthor,
}: {
  item: Reply
  canDelete: boolean
  onDelete: () => void
  onReplyClick?: () => void
  onOpenAuthor?: (username: string) => void
}) {
  const { author } = item
  // 例：「サンプルのコメント「こんにちは…」に返信」。どのコメントのボタンかが、名前だけで分かる
  const target = `${author.displayName}のコメント「${excerpt(item.body)}」`
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1 }}>
      <Avatar aria-hidden sx={{ width: 32, height: 32, fontSize: 16 }}>
        {Array.from(author.displayName)[0] ?? '?'}
      </Avatar>
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <AuthorName displayName={author.displayName} username={author.username} onOpen={onOpenAuthor} />
          <Typography component="time" variant="caption" color="text.secondary" dateTime={item.createdAt}>
            {formatDateTime(item.createdAt)}
          </Typography>
        </Box>
        {/* 本文は、文字として表示する（HTML として解釈しない）。改行は、そのまま見せる */}
        <Typography sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.body}</Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
          {onReplyClick && (
            <Button size="small" aria-label={`${target}に返信`} onClick={onReplyClick}>
              返信
            </Button>
          )}
          {canDelete && (
            <Button size="small" color="error" aria-label={`${target}を削除`} onClick={onDelete}>
              削除
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// コメントと、その返信（古い順）。「返信」を押すと、そのコメントの下に、返信の入力欄が開く
export default function CommentThread({
  comment,
  currentUserId,
  postAuthorId,
  onReply,
  onDelete,
  onOpenAuthor,
}: Props) {
  const [replying, setReplying] = useState(false)
  const canDeleteItem = (item: Reply) =>
    currentUserId !== null && (item.author.id === currentUserId || postAuthorId === currentUserId)

  return (
    <Box component="li" sx={{ listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
      <CommentRow
        item={comment}
        canDelete={canDeleteItem(comment)}
        onDelete={() => onDelete({ id: comment.id, hasReplies: comment.replies.length > 0, isReply: false })}
        onReplyClick={currentUserId !== null ? () => setReplying(true) : undefined}
        onOpenAuthor={onOpenAuthor}
      />
      <Box sx={{ pl: 6 }}>
        {comment.replies.map((reply) => (
          <CommentRow
            key={reply.id}
            item={reply}
            canDelete={canDeleteItem(reply)}
            onDelete={() => onDelete({ id: reply.id, hasReplies: false, isReply: true })}
            onOpenAuthor={onOpenAuthor}
          />
        ))}
        {replying && (
          <Box sx={{ pt: 1 }}>
            <CommentForm
              label="返信を書く"
              submitLabel="返信する"
              autoFocus
              onCancel={() => setReplying(false)}
              onSubmit={async (body) => {
                await onReply(comment.id, body)
                // 送れたら、入力欄を閉じる（失敗したときは、開いたまま、入力を残す）
                setReplying(false)
              }}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
