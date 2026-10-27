// One-time invitation to the owner. No passwords, auth tokens or caller-supplied identities.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
Deno.serve(async (request:Request)=>{
 if(request.method!=='POST')return new Response('Method not allowed',{status:405});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:email,error:claimError}=await db.rpc('claim_admin_invite');
 if(claimError)return Response.json({ok:false,message:'Invitation unavailable'},{status:503});
 if(!email)return Response.json({ok:false,message:'Invitation already sent or in progress'},{status:409});
 const {error}=await db.auth.admin.inviteUserByEmail(email,{redirectTo:'https://voee360tour-fn1rt8yl3-daniel-16cd.vercel.app/definir-senha'});
 await db.rpc('finish_admin_invite',{p_success:!error});
 return Response.json({ok:!error,message:error?error.message:'Administrator invited'},{status:error?502:200});
});
