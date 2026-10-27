import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
Deno.serve(async(request:Request)=>{
if(request.method!=='POST')return new Response('Method not allowed',{status:405});
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
// Only the platform's invited superadmin can trigger the migration in the application.
const token=request.headers.get('Authorization')?.replace('Bearer ','');
const{data:authorized}=await db.rpc('authorize_media_import',{p_token:token||''});if(!authorized)return new Response('Authorized migration only',{status:403});
const {data:manifest,error}=await db.rpc('get_legacy_import');if(error)return Response.json({error:error.message},{status:500});
let imported=0;const failures:string[]=[];
for(let start=0;start<manifest.length;start+=4)await Promise.all(manifest.slice(start,start+4).map(async(m:any)=>{try{
if(!/^\/__l5e\/assets-v1\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+\.(jpg|jpeg)$/i.test(m.source))throw new Error('Invalid source');
const response=await fetch('https://sevensportsbar.lovable.app'+m.source);if(!response.ok)throw new Error('Source unavailable');
const buffer=await response.arrayBuffer();if(buffer.byteLength!==m.file_size)throw new Error('Size mismatch');
const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');if(digest!==m.sha256)throw new Error('Hash mismatch');
const {error:up}=await db.storage.from('tour-media').upload(m.path,buffer,{contentType:'image/jpeg',cacheControl:'31536000',upsert:false});if(up&&!up.message.toLowerCase().includes('already exists'))throw up;
const{error:done}=await db.rpc('finish_legacy_media',{p_id:m.id});if(done)throw done;imported++;
}catch(e){failures.push(m.id+': '+(e instanceof Error?e.message:'Failed'));}}));
if(!failures.length){const{data:finalized,error:finalError}=await db.rpc('finalize_legacy_import');if(finalError)return Response.json({imported,error:finalError.message},{status:500});return Response.json({imported,finalized});}
return Response.json({imported,failures},{status:502});
});
