// API を呼ぶ関数が、共通で使うもの

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// サーバーが返す {"message": "..."} を、取り出す。読めなければ、決まった文言にする
export async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string }
    if (body.message) return body.message
  } catch {
    // JSON でないときは、下の文言にする
  }
  return 'エラーが起きました。もう一度、試してください'
}

export const NETWORK_ERROR_MESSAGE = 'サーバーにつながりません。しばらくしてから、もう一度、試してください'
