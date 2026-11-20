import {expect,it} from 'vitest'
import {movedProjects,orderedProjects,type Project} from '../layers/planner/shared/domain'
const projects:Project[]=['a','b','c'].map(id=>({id,user_id:'owner',title:id,company:'',deadline:null,created_at:'2026-11-20T00:00:00Z'}))
it('reorders a collection and moves projects between active and ended without changing content',()=>{
 const reordered=movedProjects(projects,'c','a',false,'2026-11-20T00:00:00Z')
 expect(orderedProjects(reordered).map(p=>p.id)).toEqual(['c','a','b'])
 expect(projects.every(p=>p.sort_order===undefined)).toBe(true)
 const archived=movedProjects(reordered,'a',null,true,'2026-11-20T01:00:00Z')
 expect(archived.find(p=>p.id==='a')).toMatchObject({title:'a',archived_at:'2026-11-20T01:00:00Z'})
 const reopened=movedProjects(archived,'a','b',false,'2026-11-20T02:00:00Z')
 expect(orderedProjects(reopened).map(p=>p.id)).toEqual(['c','a','b'])
 expect(reopened.find(p=>p.id==='a')!.archived_at).toBeNull()
})
it('rejects stale or unknown destinations and ignores dropping on the same project',()=>{
 expect(()=>movedProjects(projects,'a','missing',false,'')).toThrow()
 expect(()=>movedProjects(projects,'missing',null,true,'')).toThrow()
 expect(movedProjects(projects,'a','a',false,'')).toBe(projects)
})
