import type { IncomingMessage, ServerResponse } from 'node:http'
import { generateRoutine, RoutineAIError } from '../server/routine-ai'

export default async function handler(req: IncomingMessage & {body?:unknown}, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    res.statusCode = 405
    return res.end(JSON.stringify({error:'POST 요청만 사용할 수 있습니다.'}))
  }
  try {
    const token = req.headers.authorization?.replace(/^Bearer /i, '') || ''
    const routine = await generateRoutine(req.body, token)
    res.statusCode = 200
    res.end(JSON.stringify({routine}))
  } catch (error) {
    res.statusCode = error instanceof RoutineAIError ? error.status : 500
    res.end(JSON.stringify({error:error instanceof RoutineAIError ? error.message : 'AI 요청을 처리하지 못했습니다. 다시 시도해 주세요.'}))
  }
}
