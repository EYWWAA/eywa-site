/* EYWA server relay. Public endpoint requires a private server secret.
   No payment or booking is ever created by this script. */
var EYWA_RELAY_VERSION='20261109';
function reply_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function doPost(e){
 var props=PropertiesService.getScriptProperties(),expected=props.getProperty('EYWA_MAIL_RELAY_SECRET'),body;
 try{body=JSON.parse(e.postData.contents);}catch(_){return reply_({ok:false});}
 if(!expected||!body.secret||body.secret!==expected)return reply_({ok:false});
 if(body.action==='messages')return readMessages_(body);
 if(body.action!=='send'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(body.id||'')||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.to||'')||String(body.html||'').length>100000||String(body.subject||'').length>250)return reply_({ok:false});
 var lock=LockService.getScriptLock();if(!lock.tryLock(20000))return reply_({ok:false});
 try{
  var doc=body.invoice||body.quoteDocument,pdf=null;
  if(doc){if(!/^[a-zA-Z0-9_-]+\.pdf$/.test(doc.filename||'')||String(doc.html||'').length>120000)return reply_({ok:false});pdf=Utilities.newBlob(doc.html,'text/html',doc.filename.replace(/\.pdf$/,'.html')).getAs('application/pdf').setName(doc.filename);}
  var key='sent:'+body.id;
  if(!props.getProperty(key)){
   if(MailApp.getRemainingDailyQuota()<1)return reply_({ok:false,error:'DAILY_QUOTA'});
   var message={to:body.to,subject:body.subject,body:body.text||'',htmlBody:body.html,name:'EYWA',replyTo:'contact.eywa08@gmail.com'};
   if(pdf)message.attachments=[pdf];MailApp.sendEmail(message);props.setProperty(key,String(Date.now()));
  }
  return reply_({ok:true,id:body.id,version:EYWA_RELAY_VERSION,pdf:pdf?Utilities.base64Encode(pdf.getBytes()):null});
 }catch(_){return reply_({ok:false,error:'DELIVERY_FAILED'});}finally{lock.releaseLock();}
}
function gmailGet_(path){
 var r=UrlFetchApp.fetch('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
 if(r.getResponseCode()!==200)throw Error('GMAIL_READ_FAILED');return JSON.parse(r.getContentText());
}
function decode_(data){try{return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8');}catch(_){return '';}}
function plain_(part){
 if(part.mimeType==='text/plain'&&part.body&&part.body.data)return decode_(part.body.data);
 var children=(part.parts||[]).map(plain_).filter(Boolean);if(children.length)return children.join('\n');
 if(part.mimeType==='text/html'&&part.body&&part.body.data)return decode_(part.body.data).replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
 return '';
}
function readMessages_(body){
 var props=PropertiesService.getScriptProperties();if(props.getProperty('EYWA_GMAIL_ARCHIVE_ENABLED')!=='true')return reply_({ok:false,error:'READ_NOT_ENABLED'});
 if(!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.email||''))return reply_({ok:false});
 var after=Number(body.after)||0,before=Number(body.before)||Date.now();
 if(after<0||before>Date.now()+60000||before<after||String(body.pageToken||'').length>1000)return reply_({ok:false});
 try{
  var q='{from:'+body.email+' to:'+body.email+'} -in:trash -in:spam -in:drafts'+(after?' after:'+Math.floor(after/1000):'')+' before:'+Math.ceil(before/1000);
  var list=gmailGet_('messages?maxResults=20&q='+encodeURIComponent(q)+(body.pageToken?'&pageToken='+encodeURIComponent(body.pageToken):''));
  var messages=(list.messages||[]).map(function(item){
   var m=gmailGet_('messages/'+encodeURIComponent(item.id)+'?format=full');var headers=m.payload.headers||[];
   var value=function(key){var h=headers.find(function(h){return h.name.toLowerCase()===key;});return h?h.value:'';};
   return {id:m.id,at:Number(m.internalDate),subject:value('subject'),from:value('from'),to:value('to'),text:plain_(m.payload).slice(0,60000)};
  });
  return reply_({ok:true,messages:messages,nextPageToken:list.nextPageToken||null});
 }catch(_){return reply_({ok:false,error:'GMAIL_READ_FAILED'});}
}
function verifyConfiguration(){
 // Safe to run from the editor: checks access and quota, sends nothing.
 var props=PropertiesService.getScriptProperties();
 var result={secretConfigured:!!props.getProperty('EYWA_MAIL_RELAY_SECRET'),remainingRecipients:MailApp.getRemainingDailyQuota(),archiveEnabled:props.getProperty('EYWA_GMAIL_ARCHIVE_ENABLED')==='true'};
 if(result.archiveEnabled)result.gmailAddress=gmailGet_('profile').emailAddress;
 console.log(JSON.stringify(result));return result;
}
