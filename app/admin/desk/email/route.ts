import { getAdmin } from "@/lib/admin";
import { canAccess } from "@/lib/team-types";
import { db } from "@/lib/db";
import { ensureDeskSchema, ensureEmailSchema } from "@/lib/migrate";
import { mailProvider } from "@/lib/mail";
import { KEY } from "@/lib/mail/collab";
import { locateMessage } from "@/lib/mail/resolve";
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
    // Verified by the stable key first (UIDs can change after a move), then the sanitized Message-ID.
    const found=await locateMessage(provider,{folder:row.folder,uid:Number(row.uid),key,messageId:row.message_id==null?null:String(row.message_id)});
    return found.kind==='missing'?go('/admin/email'):go(`/admin/email?f=${encodeURIComponent(found.folder)}&m=${found.uid}`);
  }catch{return new Response('Impossibile aprire l’email in questo momento. Torna alla scrivania e riprova.',{status:503});}
}
