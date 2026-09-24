#!/usr/bin/env python3
"""Render EYWA's narrated walkthrough from local screenshots and existing photos.
Usage: FFMPEG_BINARY=/path/to/ffmpeg python3 video-source/build_video.py --voice-dir /path/to/aiff
If --voice-dir is omitted, macOS say generates the narration in a temporary folder.
"""
import argparse, json, math, os, re, shutil, subprocess, tempfile, wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent.parent
SCENES=json.loads((ROOT/'video-source/narration.json').read_text())
OUT=ROOT/'assets/video'; OUT.mkdir(exist_ok=True,parents=True)
W,H,FPS=1280,720,24
GREEN='#203d30'; CREAM='#f8f7f3'; MUTED='#6b7769'; GOLD='#e6ce83'
SERIF='/System/Library/Fonts/Supplemental/Georgia.ttf'
SANS='/System/Library/Fonts/Avenir Next.ttc'

def font(n,serif=False): return ImageFont.truetype(SERIF if serif else SANS,n)
def run(args): subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def fit(im,size,centering=(.5,.5)): return ImageOps.fit(im,size,method=Image.Resampling.LANCZOS,centering=centering)
def wrap(text,f,width):
    lines=[]; cur=''
    for word in text.split():
        nextline=(cur+' '+word).strip()
        if f.getlength(nextline)>width and cur: lines.append(cur);cur=word
        else: cur=nextline
    if cur: lines.append(cur)
    return lines

def text(draw,xy,value,f,fill,width=None,gap=8):
    x,y=xy
    lines=[]
    for part in value.split('\n'):
        lines+=wrap(part,f,width) if width else [part]
    for line in lines:
        draw.text((x,y),line,font=f,fill=fill)
        y+=f.size+gap
    return y

def roundpaste(canvas,im,box,radius=6):
    x,y,w,h=box; mask=Image.new('L',(w,h),0); ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius,fill=255)
    canvas.paste(im,(x,y),mask)

def prepare(scene,path):
    im=Image.open(path).convert('RGB')
    if scene['kind']=='screen':
        # All screen captures use a 1280×800 viewport and contain no client details.
        if path.stem=='devis': box=(375,168,905,730)
        elif path.stem in ('reservation','adresse'): box=(360,118,920,688)
        else: box=(375,168,905,735)
        im=im.crop(box)
        bg=Image.new('RGB',(608,498),'#eeefe8')
        resized=ImageOps.contain(im,(570,470),Image.Resampling.LANCZOS)
        bg.paste(resized,((608-resized.width)//2,(498-resized.height)//2))
        return bg
    return fit(im,(680,550),(.5,.60 if scene['id']=='preparation' else .48))

def screen_panel(base,frame,progress,t):
    # Gentle camera movement, followed by a pointer cue on the site CTA.
    w,h=frame.size; zoom=1+.018*progress
    img=frame.resize((round(w*zoom),round(h*zoom)),Image.Resampling.BICUBIC)
    img=img.crop(((img.width-w)//2,(img.height-h)//2,(img.width+w)//2,(img.height+h)//2))
    roundpaste(base,img,(608,128,w,h))
    d=ImageDraw.Draw(base)
    d.rounded_rectangle((608,94,1216,129),radius=6,fill='#e3e8df')
    for x in (625,640,655): d.ellipse((x,107,x+5,112),fill='#a5b29e')
    d.text((681,101),'eywacoffeecatering.com',font=font(14),fill=GREEN)
    if 2<t<6:
        phase=min(1,(t-2)/1.3); x=int(1170-220*phase); y=int(540+35*phase)
        d.polygon([(x,y),(x+4,y+26),(x+12,y+18),(x+23,y+17)],fill=GREEN,outline=CREAM,width=2)
        if phase==1:
            rad=int(15+8*math.sin(t*3))
            d.ellipse((x-rad,y-rad,x+rad,y+rad),outline='#809176',width=2)

def email_panel(base,t):
    d=ImageDraw.Draw(base)
    d.rounded_rectangle((608,94,1216,626),radius=8,fill='#e9ede4')
    d.rounded_rectangle((647,125,1177,590),radius=8,fill='white')
    d.text((684,150),'EYWA',font=font(28,True),fill=GREEN)
    d.text((684,201),'CONFIRMATION AUTOMATIQUE',font=font(14),fill=MUTED)
    r=min(1,t/.65); y=260+int((1-r)*12)
    d.ellipse((684,y,730,y+46),fill=GREEN)
    d.line([(698,y+23),(707,y+32),(720,y+14)],fill='white',width=3)
    text(d,(684,y+70),'Votre coffee bar\nest réservé.',font(31,True),GREEN,gap=4)
    d.line((684,426,1133,426),fill='#d7ded1')
    text(d,(684,449),'Votre récapitulatif :\ndate, lieu et horaire du service.',font(20),MUTED,width=430)
    d.text((684,550),'Un détail à préciser ? Contactez EYWA.',font=font(17),fill=GREEN)
    d.text((756,603),'Exemple de confirmation',font=font(14),fill=MUTED)

def render_scene(scene,index,t,duration,assets):
    im=Image.new('RGB',(W,H),CREAM); d=ImageDraw.Draw(im)
    d.text((60,34),'E Y W A',font=font(24,True),fill=GREEN)
    d.text((1002,40),'LE PARCOURS EN IMAGES',font=font(13),fill=MUTED)
    d.line((60,78,1216,78),fill='#d9dfd3')
    d.text((60,133),scene['label'].upper(),font=font(15),fill=MUTED)
    offset=round(10*max(0,1-t/.5))
    text(d,(57,186+offset),scene['title'],font(46,True),GREEN,width=515,gap=8)
    y=414
    for n,p in enumerate(scene['points']):
        if t>n*.35:
            d.ellipse((63,y+9,69,y+15),fill='#829175')
            text(d,(84,y),p,font(21),GREEN,width=470,gap=4)
        y+=49
    if scene['kind']=='confirmation': email_panel(im,t)
    elif scene['kind']=='screen':
        frame=assets[scene['asset']]
        if scene.get('next'):
            transition=max(0,min(1,(t-duration*.55)/.4))
            if transition: frame=Image.blend(frame,assets[scene['next']],transition)
        screen_panel(im,frame,t/duration,t)
    else:
        frame=assets[scene['asset']]
        z=1.02+.035*(t/duration); fw,fh=frame.size
        larger=frame.resize((int(fw*z),int(fh*z)),Image.Resampling.BICUBIC)
        x=int((larger.width-608)*.5);y=int((larger.height-532)*.5)
        roundpaste(im,larger.crop((x,y,x+608,y+532)),(608,94,608,532))
    d=ImageDraw.Draw(im)
    d.text((60,621),'Du premier clic au dernier café.',font=font(16),fill=MUTED)
    for n in range(len(SCENES)):
        x=60+n*167
        d.rounded_rectangle((x,674,x+148,677),radius=1,fill='#d9dfd3')
        if n<index: fill=148
        elif n==index: fill=max(1,int(148*t/duration))
        else: fill=0
        if fill: d.rounded_rectangle((x,674,x+fill,677),radius=1,fill=GREEN)
    d.text((1220,663),f'{index+1:02}',font=font(14),fill=MUTED)
    return im

def stamp(v):
    ms=round(v*1000); h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}.{ms:03}'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--voice-dir',type=Path);args=parser.parse_args()
    ffmpeg=os.environ.get('FFMPEG_BINARY') or shutil.which('ffmpeg')
    if not ffmpeg: raise SystemExit('Set FFMPEG_BINARY to an installed FFmpeg executable.')
    temp=Path(tempfile.mkdtemp(prefix='eywa-film-'));voices=args.voice_dir or temp
    if not args.voice_dir:
        for scene in SCENES:
            source=temp/(scene['id']+'.txt');source.write_text(scene['text'])
            run(['say','-v','Thomas','-r','150','-f',str(source),'-o',str(temp/(scene['id']+'.aiff'))])
    assets={}; durations=[];audiofiles=[]
    for scene in SCENES:
        for key in ('asset','next'):
            if scene.get(key): assets[scene[key]]=prepare(scene,ROOT/scene[key])
        output=temp/(scene['id']+'.wav')
        run([ffmpeg,'-y','-i',str(voices/(scene['id']+'.aiff')),'-ar','44100','-ac','1',str(output)])
        with wave.open(str(output)) as w: duration=w.getnframes()/w.getframerate()
        if duration<1: raise SystemExit('Narration missing: '+scene['id'])
        durations.append(math.ceil((duration+.55)*FPS)/FPS);audiofiles.append(output)
    combined=temp/'narration.wav'
    with wave.open(str(combined),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(44100)
        for duration,source in zip(durations,audiofiles):
            with wave.open(str(source)) as f: samples=f.readframes(f.getnframes())
            wav.writeframes(samples+b'\x00'*(2*round(duration*44100)-len(samples)))
    total=sum(durations); print(f'Duration: {total:.1f}s',flush=True)
    # WebVTT captions are split at sentence boundaries. Timing is proportional to spoken words.
    vtt=['WEBVTT','']; offset=0
    for scene,duration in zip(SCENES,durations):
        chunks=[s.strip() for s in re.split(r'(?<=[.!?])\s+',scene['text']) if s.strip()]
        words=sum(len(c.split()) for c in chunks);start=offset+.05
        for c in chunks:
            length=(duration-.45)*len(c.split())/words
            vtt.extend([f'{stamp(start)} --> {stamp(start+length)}',c,'']); start+=length
        offset+=duration
    (OUT/'eywa-parcours.fr.vtt').write_text('\n'.join(vtt))
    video=temp/'silent.mp4'
    process=subprocess.Popen([ffmpeg,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','23','-pix_fmt','yuv420p',str(video)],stdin=subprocess.PIPE)
    try:
        previous=None
        for i,(scene,duration) in enumerate(zip(SCENES,durations)):
            for frame in range(round(duration*FPS)):
                t=frame/FPS; image=render_scene(scene,i,t,duration,assets)
                if previous is not None and t<.3: image=Image.blend(previous,image,t/.3)
                process.stdin.write(image.tobytes())
            previous=image
            print('Rendered '+scene['id'],flush=True)
    finally: process.stdin.close()
    if process.wait()!=0: raise SystemExit('FFmpeg failed')
    run([ffmpeg,'-y','-i',str(video),'-i',str(combined),'-c:v','copy','-c:a','aac','-af','volume=-2dB','-b:a','128k','-movflags','+faststart','-shortest',str(OUT/'eywa-parcours.mp4')])
    poster_scene=dict(SCENES[0],title='Comment\nça marche ?',label='Le film EYWA',points=['Le concept. Le devis. La réservation.'])
    poster=render_scene(poster_scene,0,2,durations[0],assets); d=ImageDraw.Draw(poster)
    d.rounded_rectangle((60,498,363,564),radius=4,fill=GREEN)
    d.polygon([(83,518),(83,545),(104,532)],fill=CREAM)
    d.text((125,517),f'Voir le film · {round(total)} s',font=font(20),fill=CREAM)
    poster.save(OUT/'eywa-parcours-poster.jpg',quality=92)
    # Put the exact spoken narration alongside the player for an accessible text alternative.
    page=ROOT/'index.html'; content=page.read_text()
    import html
    transcript=''.join('<p><strong>'+html.escape(s['label'])+'.</strong> '+html.escape(s['text'])+'</p>' for s in SCENES)
    content=content.replace('TRANSCRIPT_PLACEHOLDER',transcript)
    page.write_text(content)
    (OUT/'eywa-parcours-meta.json').write_text(json.dumps({'duration':total,'chapters':[{'id':s['id'],'duration':d} for s,d in zip(SCENES,durations)],'voice':'Thomas — synthèse macOS','status':'Version de travail ; confirmation automatique à valider avant diffusion'},ensure_ascii=False,indent=2))
    print('Video ready: '+str(OUT/'eywa-parcours.mp4'),flush=True)
if __name__=='__main__': main()
