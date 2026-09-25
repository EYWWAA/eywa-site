"""EYWA character animation, 114 seconds. Reuses the original editable character rig.
Run with the workspace Python (Pillow). Sources/audio remain in ../eywa-video-apercu.
"""
from pathlib import Path
import sys,json,math,subprocess,re,wave
import numpy as np
from functools import lru_cache
from PIL import Image
import build_video as art

ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT.parent/'eywa-video-apercu'
OUT=ROOT/'assets/video'
META=json.loads((SRC/'montage-paula.json').read_text())
FF='/private/tmp/eywa-video-deps/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
G=art.GREEN;C=art.CREAM;D=art.DARK;S=art.SAGE;M=art.MOSS;BROWN='#594332'
FPS=24
with wave.open(str(SRC/'narration-paula.wav')) as audio:
    AUDIO_RATE=audio.getframerate()
    AUDIO=np.frombuffer(audio.readframes(audio.getnframes()),dtype=np.int16).astype(np.float32)/32768

def presenter(a,i,t):
    x=157;y=618;k=.91
    pose='point' if i in (1,2,4,5) else ('wave' if t<1.7 else 'idle')
    art.character(a,x,y,k,'camille',pose,t)
    sample=int((META['chapters'][i]['start']+t)*AUDIO_RATE)
    chunk=AUDIO[max(0,sample-400):sample+700]
    level=float(np.sqrt(np.mean(chunk*chunk))) if len(chunk) else 0
    hy=-293+math.sin(t*2.2)*1.8
    # Follow the actual voice energy, including pauses, rather than a looping mouth.
    a.ellipse((x-16*k,y+(hy+20)*k,x+16*k,y+(hy+39)*k),'#edb491')
    mouth=0 if level<.008 else min(13,3+level*125)
    if mouth:
        cy=y+(hy+29)*k
        a.ellipse((x-10*k,cy-mouth*k/2,x+10*k,cy+mouth*k/2),'#743e35')
        if mouth>7:a.ellipse((x-5*k,cy+1*k,x+6*k,cy+mouth*k/2),'#d7907a')
    else:a.arc((x-10*k,y+(hy+20)*k,x+10*k,y+(hy+33)*k),10,170,'#914e3e',2*k)

def badge(a,x,y,text,w=240):
    a.rect((x,y,x+w,y+42),'#fffefa',r=21)
    a.text((x+w/2,y+10),text,17,G,'regular','mt')

def bar(a,x,y,w=590,t=0,brand=False):
    # Straight dark walnut top, white unbranded facade, tall polished machine.
    a.ellipse((x+8,y+160,x+w-8,y+189),'#dce1d3')
    for xx in (x+40,x+w-40):
        a.ellipse((xx-9,y+157,xx+9,y+179),D)
        a.ellipse((xx-3,y+164,xx+3,y+171),'#889083')
    front=('#ead9d0' if math.sin(t*.45)>0 else '#dbe3d1') if brand else '#fffefa'
    a.rect((x+9,y+9,x+w-9,y+161),front)
    a.rect((x+w-32,y+9,x+w-9,y+161),'#deded5')
    a.rect((x,y-4,x+w,y+10),BROWN)
    a.line([(x+3,y+2),(x+w-3,y+2)],'#7b6045',1)
    if brand:
        a.text((x+w/2,y+55),'VOTRE MARQUE',29,G,'serif','mt')
        a.text((x+w/2,y+100),'Votre univers, votre accueil.',15,G,'regular','mt')
    mx=x+w*.27; my=y-132
    a.rect((mx,my,mx+126,y-5),'#b7c1bd',r=6)
    a.rect((mx+7,my+7,mx+119,y-11),'#e5e9e4',r=3)
    a.rect((mx+18,my+10,mx+46,y-13),'#a0ada7',r=2)
    a.rect((mx+52,my+10,mx+74,y-13),'#f4f3e8')
    a.line([(mx+8,my+6),(mx+112,my+6)],'#ffffff',2)
    a.rect((mx+9,y-8,mx+118,y-3),D)
    gx=mx-64
    a.rect((gx,y-83,gx+46,y-4),D,r=4)
    a.poly([(gx-6,y-151),(gx+53,y-151),(gx+42,y-86),(gx+5,y-86)],'#b9c5b6')
    a.poly([(gx-2,y-143),(gx+48,y-143),(gx+37,y-93),(gx+8,y-93)],'#604735')
    a.rect((gx-9,y-157,gx+56,y-148),D,r=2)
    for j in range(5):
        a.line([(mx+144,y-88+j*9),(mx+170,y-88+j*9)],'#d4d6c9',5)
    a.poly([(mx+142,y-94),(mx+172,y-94),(mx+168,y-40),(mx+147,y-40)],'#fffdf1')
    a.rect((x+w-92,y-58,x+w-46,y-5),'#eeeadd',r=2)
    a.text((x+w-69,y-48),'CARTE',9,G,'regular','mt')
    for yy in (y-30,y-23,y-16):a.line([(x+w-84,yy),(x+w-54,yy)],M,1)
    art.plant(a,x+w-24,y-7,.29)

def background(a,i,t,title,subtitle):
    a.rect((0,0,1280,720),C)
    a.ellipse((700,-160,1400,545),'#edf0e3')
    a.ellipse((-180,370,310,870),'#f0eadc')
    a.text((58,31),'E Y W A',23,G,'serif')
    a.text((1220,35),f'0{i+1} / 07',14,'#75816b','regular','rt')
    a.text((640,92),title,40,G,'serif','mt')
    a.text((640,150),subtitle,20,'#65755d','regular','mt')
    a.line([(60,618),(1220,618)],'#d5dec9',2)
    start=META['chapters'][i]['start']
    a.line([(58,680),(1222,680)],'#dbe0d1',2)
    a.line([(58,680),(58+1164*(start+t)/META['duration'],680)],G,3)
    a.text((58,692),'EYWA · COFFEE CATERING',12,'#718069')
    a.text((1222,692),'eywacoffeecatering.com',12,'#718069','regular','rt')

@lru_cache(maxsize=4)
def screen(name):return Image.open(SRC/name).convert('RGB')
def laptop(a,x,y,w,h,name,t,previous=None,change=0):
    a.rect((x,y,x+w,y+h),D,r=13)
    a.rect((x+9,y+9,x+w-9,y+34),'#e6ebdd',r=4)
    for dx in (20,32,44):a.ellipse((x+dx,y+18,x+dx+4,y+22),M)
    a.text((x+w/2,y+15),'eywacoffeecatering.com',11,G,'regular','mt')
    image=screen(name)
    if previous and t<change+.32:
        image=Image.blend(screen(previous).resize(image.size),image,art.ease((t-change)/.32))
    a.paste(image,(x+9,y+36,w-18,h-46))
    a.poly([(x-29,y+h),(x+w+29,y+h),(x+w+47,y+h+15),(x-47,y+h+15)],'#8d9b86')
    a.line([(x-47,y+h+15),(x+w+47,y+h+15)],G,3)

def draw(i,t,duration):
    a=art.Art();p=t/duration
    titles=['Un café. Une belle rencontre.','Un coffee shop, sur place.','Le soin de chaque tasse.','Le jour J, on s’occupe de tout.','Un coffee bar à votre image.','Votre devis, pas à pas.','On prépare la suite ensemble.']
    subs=['Pour vos clients, vos équipes et vos invités.','Un comptoir mobile · Un barista dédié · Vos boissons préférées',
          'Préparé à la demande. Servi avec attention.','Installation et rangement en dehors du temps de service.',
          'Comptoir, gobelets, carte et tenues personnalisables.','Vos coordonnées restent nécessaires pour accéder au devis.',
          'Les détails et la disponibilité sont validés avec vous.']
    background(a,i,t,titles[i],subs[i])
    if i==0:
        shift=250*(1-art.enter(t,0,1))
        art.character(a,735+shift,607,1.01,'barista','serve',t)
        bar(a,335+shift,439,590,t)
        art.character(a,1064,617,.92,'guest','hold',t,.7)
        art.cup(a,736+20*math.sin(t),400,.76,steam=t+.1)
        if p>.34:
            for k,(label,x) in enumerate([('Bureaux',320),('Boutiques',620),('Événements',920)]):
                if art.enter(t,duration*.34+k*.6):badge(a,x,208,label)
        if p>.7:a.text((640,644),'Charleville-Mézières · Reims · Au-delà',18,G,'regular','mt')
        art.plant(a,1188,615,.65)
    elif i==1:
        art.character(a,1120,615,.94,'barista','point',t)
        names=['Espresso','Latte & cappuccino','Matcha','Chocolat']
        colors=['#e8d7b2','#eee5d5','#cad8a8','#d2af89']
        for k,label in enumerate(names):
            v=art.enter(t,.5+k*.7,.8)
            x=460+(k%2)*320;y=313+(k//2)*208+35*(1-v)
            if v:
                a.ellipse((x-105,y-67,x+105,y+100),'#e8eddd')
                art.cup(a,x,y-18,1.45,colors[k],steam=t+k+.3)
                a.text((x,y+93),label,21,G,'regular','mt')
        if p>.56:badge(a,950,207,'Chaud ou glacé',260)
    elif i==2:
        if p<.52:
            # The barista controls a working espresso machine; the coffee visibly pours.
            art.character(a,335,615,1.14,'barista','point',t)
            a.rect((526,249,1054,557),'#b6c1b6',r=18)
            a.rect((550,270,1030,326),G,r=7)
            for x in (590,642,694):a.ellipse((x,286,x+15,301),'#d4dcbc')
            a.rect((550,359,1030,535),'#e9ece2',r=7)
            for x in (715,875):
                a.line([(x,335),(x,391)],D,12)
                a.line([(x-5,350),(x+62,350)],BROWN,10)
                a.line([(x,397),(x,452+4*math.sin(t*5))],'#95643f',3)
                art.cup(a,x,457,1.3,steam=t+.1)
            a.rect((509,549,1075,568),BROWN)
            art.plant(a,1170,617,.75)
        else:
            art.character(a,537,616,1.0,'barista','serve',t)
            art.character(a,843,616,.97,'guest','hold',t,1.3)
            a.rect((258,494,940,514),BROWN)
            a.line([(293,515),(280,615)],BROWN,10);a.line([(899,515),(914,615)],BROWN,10)
            badge(a,432,210,'Un accueil à votre mesure',380)
            art.plant(a,1130,617,.9)
    elif i==3:
        shift=700*(1-art.enter(t,.2,2))
        art.character(a,725+shift,611,.98,'barista','carry' if t<2.2 else 'wave',t)
        bar(a,252+shift,438,650,t)
        art.character(a,1090,617,.92,'guest','hold',t)
        for k,(name,x) in enumerate([('Emplacement',220),('Prise électrique',515),('Accès adapté',810)]):
            if art.enter(t,3+k*.7):badge(a,x,207,name,250)
        phase=min(2,int(p*3));stages=['01  Installation','02  Service','03  Rangement']
        for j,text in enumerate(stages):
            a.text((258+j*364,645),text,19,G if j==phase else '#9aa38c','bold' if j==phase else 'regular','mt')
    elif i==4:
        art.character(a,1110,617,.95,'barista','hold',t)
        bar(a,328,437,609,t,True)
        for k,col in enumerate(['#ead9d0','#dbe3d1','#203d30','#e7d6af']):
            x=444+k*127
            a.ellipse((x,233,x+46,279),col)
            if k==int(t*.5)%4:a.ellipse((x-6,227,x+52,285),None,G,2)
        a.text((640,197),'Votre logo · Vos couleurs',20,G,'regular','mt')
        if p>.66:badge(a,403,632,'Visuel validé avant production',473)
    elif i==5:
        # Timings measured from Paula's actual audio (including the 150 ms lead).
        name='site.png' if t<4.10 else ('devis.png' if t<9.59 else 'coordonnees.png')
        previous=None if t<4.10 else ('site.png' if t<9.59 else 'devis.png')
        change=4.10 if t<9.59 else 9.59
        laptop(a,417,209,715,406,name,t,previous,change)
        label='Obtenir mon devis instantané' if t<4.10 else ('Durée et nombre d’invités' if t<9.59 else 'Vos coordonnées pour accéder au devis')
        badge(a,461,633,label,630)
        if t>12.25:
            a.rect((460,468,1090,581),G,r=12)
            a.text((775,492),'Besoin d’aide pour choisir ?',25,C,'serif','mt')
            a.text((775,538),'Contactez-nous, on en parle ensemble.',19,C,'regular','mt')
    else:
        if p<.73:
            art.character(a,1021,615,1.0,'barista','wave',t,.7)
            a.rect((466,238,824,585),'#fffefa',r=18)
            a.text((645,259),'Votre événement',27,G,'serif','mt')
            for j,text in enumerate(['Les détails pratiques','La personnalisation','La disponibilité']):
                yy=331+j*72
                a.ellipse((490,yy,518,yy+28),S)
                if p>(.12+j*.13):a.line([(497,yy+14),(503,yy+20),(513,yy+7)],G,3)
                a.text((535,yy+2),text,18,G)
            a.line([(359,398),(437,398)],M,3);a.line([(850,398),(925,398)],M,3)
            badge(a,469,624,'Puis réservation en ligne',355)
        else:
            art.character(a,1036,617,.95,'barista','wave',t,.9)
            bar(a,380,433,520,t)
            a.text((640,222),'Vous accueillez. Nous prenons soin du café.',28,G,'serif','mt')
            badge(a,447,631,'Obtenir mon devis instantané',390)
    presenter(a,i,t)
    return a.finish()

def poster():
    a=art.Art();background(a,0,0,'Votre coffee bar, de A à Z.','Le concept, le devis et le jour J en moins de deux minutes.')
    art.character(a,320,617,.99,'camille','wave',2)
    art.character(a,934,617,.99,'barista','wave',2,.7)
    bar(a,414,440,448,2)
    seconds=int(META['duration'])
    badge(a,468,632,f'Le film EYWA · {seconds//60} min {seconds%60:02}',343)
    return a.finish()

def stamp(t):
    ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'

def main():
    OUT.mkdir(exist_ok=True)
    poster().save(OUT/'eywa-animation-v2-poster.webp',quality=92)
    preview=SRC/'animation-v2-controles';preview.mkdir(exist_ok=True)
    for i,ch in enumerate(META['chapters']):draw(i,ch['duration']*.7,ch['duration']).save(preview/f'{i+1}.jpg')
    if '--preview' in sys.argv:return
    out=OUT/'eywa-animation-v2.mp4'
    proc=subprocess.Popen([FF,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s','1280x720','-r',str(FPS),'-i','-','-i',str(SRC/'narration-paula.wav'),'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(out)],stdin=subprocess.PIPE)
    last=None
    for i,ch in enumerate(META['chapters']):
        print(f'Scène {i+1}/7',flush=True)
        for f in range(round(ch['duration']*FPS)):
            t=f/FPS;im=draw(i,t,ch['duration'])
            if last is not None and t<.3:im=Image.blend(last,im,art.ease(t/.3))
            proc.stdin.write(im.tobytes())
        last=im
    proc.stdin.close();assert proc.wait()==0
    cues=['WEBVTT','']
    for ch in META['chapters']:
        sentences=re.split(r'(?<=[.!?])\s+',ch['narration']);total=sum(len(s) for s in sentences);at=ch['start']+.15
        speech=ch['duration']-(2.35 if ch is META['chapters'][-1] else .35)
        for sentence in sentences:
            end=at+speech*len(sentence)/total
            cues.extend([f'{stamp(at)} --> {stamp(end)}',sentence,'']);at=end
    (OUT/'eywa-animation-v2.fr.vtt').write_text('\n'.join(cues))
    print(out,flush=True)

if __name__=='__main__':main()
