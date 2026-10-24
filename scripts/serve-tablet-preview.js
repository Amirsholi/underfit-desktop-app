// Isolated LAN preview: explicit public assets only, no database or API routes.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const app=path.join(root,'tablet-app');
const publicFiles=new Map([
  ['/',[path.join(app,'index.html'),'text/html; charset=utf-8']],
  ['/styles.css',[path.join(app,'styles.css'),'text/css; charset=utf-8']],
  ['/app.js',[path.join(app,'app.js'),'text/javascript; charset=utf-8']],
  ['/api.js',[path.join(app,'api.js'),'text/javascript; charset=utf-8']],
  ['/live.js',[path.join(app,'live.js'),'text/javascript; charset=utf-8']],
  ['/model.js',[path.join(app,'model.js'),'text/javascript; charset=utf-8']],
  ['/controls.js',[path.join(app,'controls.js'),'text/javascript; charset=utf-8']],
  ['/exercises.js',[path.join(app,'exercises.js'),'text/javascript; charset=utf-8']],
  ['/routines-model.js',[path.join(app,'routines-model.js'),'text/javascript; charset=utf-8']],
  ['/routines.js',[path.join(app,'routines.js'),'text/javascript; charset=utf-8']],
  ...['squat','lunge','press','row','plank','deadlift'].map(name=>[`/exercises/${name}.gif`,[path.join(root,'assets','exercises','gifs',`${name}.gif`),'image/gif']]),
  ['/assets/logo.jpg',[path.join(root,'logo.jpg'),'image/jpeg']],
  ['/assets/gym.jpg',[path.join(root,'gym.jpg'),'image/jpeg']],
  ['/assets/title.ttf',[path.join(root,'Plate Gt Two Four MT Std Bd.ttf'),'font/ttf']],
  ...['calendar-days','dumbbell','person-running','file-lines'].map(name=>[`/icons/${name}.svg`,[path.join(root,'node_modules','@fortawesome','fontawesome-free','svgs','solid',`${name}.svg`),'image/svg+xml']]),
]);
function createPreviewServer(){return http.createServer((request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; font-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  let pathname;try{pathname=new URL(request.url,'http://preview.local').pathname;}catch{response.writeHead(400);response.end();return;}
  if(pathname==='/config.js'){response.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});response.end(request.method==='HEAD'?'':'window.UNDERFIT_TABLET_DEMO = true;');return;}
  const entry=publicFiles.get(pathname);
  if(!entry){response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('No disponible');return;}
  fs.stat(entry[0],(error,stat)=>{if(error||!stat.isFile()){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':entry[1],'Content-Length':stat.size});
    if(request.method==='HEAD'){response.end();return;}
    fs.createReadStream(entry[0]).on('error',()=>response.destroy()).pipe(response);
  });
});}
if(require.main===module){
  const host=process.argv[2]||'127.0.0.1',port=Number(process.argv[3]||4318);
  const server=createPreviewServer();
  server.on('error',error=>{console.error(`No se pudo iniciar la prueba: ${error.message}`);process.exitCode=1;});
  server.listen(port,host,()=>console.log(`Tablet de prueba: http://${host}:${port}/ (solo datos ficticios)`));
}
module.exports={createPreviewServer};
