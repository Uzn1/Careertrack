async function openFiles():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('careertrack-files',1)
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('files'))request.result.createObjectStore('files')}
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(new Error('브라우저 파일 저장소를 열지 못했습니다.'))
  request.onblocked=()=>reject(new Error('다른 탭의 파일 저장 작업이 끝난 뒤 다시 시도해 주세요.'))
 })
}
export async function putLocalFile(key:string,file:Blob){
 const db=await openFiles()
 try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('files','readwrite');transaction.objectStore('files').put(file,key);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('파일을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'));transaction.onabort=()=>reject(new Error('파일 저장이 중단되었습니다.'))})}finally{db.close()}
}
export async function getLocalFile(key:string):Promise<Blob>{
 const db=await openFiles()
 try{return await new Promise<Blob>((resolve,reject)=>{const request=db.transaction('files','readonly').objectStore('files').get(key);request.onsuccess=()=>request.result instanceof Blob?resolve(request.result):reject(new Error('파일을 찾지 못했습니다. 이 파일을 올린 브라우저에서 확인해 주세요.'));request.onerror=()=>reject(new Error('파일을 읽지 못했습니다.'))})}finally{db.close()}
}
export async function removeLocalFile(key:string){
 const db=await openFiles()
 try{await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('files','readwrite');transaction.objectStore('files').delete(key);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('임시 파일을 정리하지 못했습니다.'))})}finally{db.close()}
}
