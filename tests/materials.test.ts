import { expect,it } from 'vitest'
import { attachmentError,safeWebUrl } from '../layers/planner/shared/domain'
it('accepts supported attachments and rejects executable formats, empty or oversized files',()=>{
 expect(attachmentError({name:'자소서.pdf',type:'application/pdf',size:1234})).toBe('')
 expect(attachmentError({name:'이미지.png',type:'image/png',size:1234})).toBe('')
 expect(attachmentError({name:'page.html',type:'text/html',size:100})).not.toBe('')
 expect(attachmentError({name:'empty.pdf',type:'application/pdf',size:0})).not.toBe('')
 expect(attachmentError({name:'large.pdf',type:'application/pdf',size:10485761})).not.toBe('')
 expect(attachmentError({name:'fake.pdf',type:'application/javascript',size:100})).not.toBe('')
})
it('only accepts ordinary web links without embedded credentials',()=>{
 expect(safeWebUrl('https://example.com/portfolio')).toBe(true)
 expect(safeWebUrl('javascript:alert(1)')).toBe(false)
 expect(safeWebUrl('data:text/html,test')).toBe(false)
 expect(safeWebUrl('https://name:password@example.com/')).toBe(false)
})
