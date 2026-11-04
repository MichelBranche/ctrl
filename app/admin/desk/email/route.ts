import { getAdmin } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { db } from "@/lib/db";
import { ensureDeskSchema, ensureEmailSchema } from "@/lib/migrate";
import { mailProvider } from "@/lib/mail";
import { KEY } from "@/lib/mail/collab";
import { isFolder } from "@/lib/mail/types";
export async function GET(request:Request){
  const me=await getAdmin();if(!me || !canAccess(me,'email'))return new Response('Non autorizzato',{status:401});
  const url=new URL(request.url),key=url.searchParams.get('key') ?? '';
  if(!KEY.test(key))return new Response('Richiesta non valida',{status:400});
  await Promise.all([ensureDeskSchema(),ensureEmailSchema()]);
  const result=await db().execute({sql:'SELECT r.* FROM email_claims c LEFT JOIN email_references r ON r.message_key=c.message_key WHERE c.message_key=? AND c.user_id=?',args:[key,me.id]});
  if(!result.rows.length)return new Response('Email non assegnata al tuo account',{status:404});
  const row=result.rows[0],provider=mailProvider();
  const go=(path:string)=>new Response(null,{status:303,headers:{Location:path,"Cache-Control":"private, no-store"}});
  if(!provider || !row.folder || !isFolder(row.folder))return go('/admin/email');
  try {
    // Verify the stable message key before linking: UIDs can change after a move.
    const view=await provider.view({folder:row.folder,page:1,open:Number(row.uid)});
    if(view.open?.key===key)return go(`/admin/email?f=${encodeURIComponent(row.folder)}&m=${row.uid}`);
    if(row.message_id){
      const search='rfc822msgid:'+String(row.message_id).replace(/[<>]/g,'');
      for(const folder of ['all','trash','spam'] as const){const found=await provider.view({folder,page:1,search});const match=found.list.find(item=>item.key===key);if(match)return go(`/admin/email?f=${folder}&m=${match.uid}`);}
    }
    return go('/admin/email');
  }catch{return new Response('Impossibile aprire l’email in questo momento. Torna alla scrivania e riprova.',{status:503});}
}
