import { defineEventHandler, readBody, getHeader, setResponseHeader, setResponseStatus } from 'h3'
import { generateRoutine, RoutineAIError } from '../../../../server/routine-ai'

export default defineEventHandler(async event => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    return {routine:await generateRoutine(await readBody(event), getHeader(event, 'authorization')?.replace(/^Bearer /i, '') || '', import.meta.dev)}
  } catch (error) {
    setResponseStatus(event, error instanceof RoutineAIError ? error.status : 500)
    return {error:error instanceof RoutineAIError ? error.message : 'AI 요청을 처리하지 못했습니다. 다시 시도해 주세요.'}
  }
})
