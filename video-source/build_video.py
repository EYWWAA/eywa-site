#!/usr/bin/env python3
"""Original 2D EYWA explainer: animated characters, props and website screens.
FFMPEG_BINARY=/path/to/ffmpeg python3 video-source/build_video.py --voice-dir /path/to/aiff
Use --preview to export one representative frame per scene without encoding.
All illustrations below are procedural vector-style artwork created for EYWA.
"""
from pathlib import Path
from functools import lru_cache
import argparse, hashlib, html, json, math, os, re, shutil, subprocess, tempfile, wave
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent.parent
SCENES=json.loads((ROOT/'video-source/narration.json').read_text())
OUT=ROOT/'assets/video'
W,H,S,FPS=1280,720,2,24
GREEN='#203d30'; DARK='#172c23'; CREAM='#fbf8ef'; SAGE='#e7eddf'; MOSS='#a7b996'
CLAY='#c67f60'; INK='#294035'; GOLD='#e4c97e'; WHITE='#fffefa'
SERIF='/System/Library/Fonts/Supplemental/Georgia.ttf'
SANS='/System/Library/Fonts/Avenir Next.ttc'
FONTS={}
for i in range(15):
    try: FONTS[ImageFont.truetype(SANS,20,index=i).getname()[1]]=i
    except OSError: break

@lru_cache(maxsize=80)
def font(size,style='regular'):
    if style=='serif': return ImageFont.truetype(SERIF,round(size*S))
    index=FONTS.get('Demi Bold',2) if style=='bold' else FONTS.get('Regular',0)
    return ImageFont.truetype(SANS,round(size*S),index=index)

def clamp(v): return min(1,max(0,v))
def ease(v): v=clamp(v); return v*v*(3-2*v)
def enter(t,delay=0,duration=.65): return ease((t-delay)/duration)
def mix(a,b,v): return a+(b-a)*v

class Art:
    def __init__(self,bg=CREAM):
        self.im=Image.new('RGB',(W*S,H*S),bg); self.d=ImageDraw.Draw(self.im)
    def box(self,b): return tuple(round(v*S) for v in b)
    def rect(self,b,fill,r=0,outline=None,width=1):
        if r: self.d.rounded_rectangle(self.box(b),round(r*S),fill=fill,outline=outline,width=round(width*S))
        else:self.d.rectangle(self.box(b),fill=fill,outline=outline,width=round(width*S))
    def ellipse(self,b,fill,outline=None,width=1): self.d.ellipse(self.box(b),fill=fill,outline=outline,width=round(width*S))
    def poly(self,pts,fill): self.d.polygon([(round(x*S),round(y*S)) for x,y in pts],fill=fill)
    def line(self,pts,fill,width=2,rounding=True):
        self.d.line([(round(x*S),round(y*S)) for x,y in pts],fill=fill,width=max(1,round(width*S)),joint='curve')
        if rounding:
            r=width/2
            for x,y in [pts[0],pts[-1]]:self.ellipse((x-r,y-r,x+r,y+r),fill)
    def arc(self,b,start,end,fill,width=2):self.d.arc(self.box(b),start,end,fill=fill,width=round(width*S))
    def text(self,xy,value,size=24,fill=GREEN,style='regular',anchor=None):
        self.d.text((round(xy[0]*S),round(xy[1]*S)),value,font=font(size,style),fill=fill,anchor=anchor)
    def curve(self,points,fill,width=2):
        p0,p1,p2,p3=points;pts=[]
        for n in range(25):
            v=n/24;z=1-v
            pts.append((z**3*p0[0]+3*z*z*v*p1[0]+3*z*v*v*p2[0]+v**3*p3[0],z**3*p0[1]+3*z*z*v*p1[1]+3*z*v*v*p2[1]+v**3*p3[1]))
        self.line(pts,fill,width)
    def paste(self,im,box):
        x,y,w,h=box; im=im.resize((round(w*S),round(h*S)),Image.Resampling.LANCZOS)
        self.im.paste(im,(round(x*S),round(y*S)))
    def finish(self):return self.im.resize((W,H),Image.Resampling.LANCZOS)

def leaf(a,x,y,k=1,flip=False):
    sign=-1 if flip else 1
    a.ellipse((x-13*k,y-38*k,x+13*k,y),MOSS)
    a.line([(x,y),(x+sign*18*k,y-30*k)],'#768d68',2*k)

def plant(a,x,y,k=1):
    a.ellipse((x-47*k,y-6*k,x+47*k,y+7*k),'#dce4d3')
    a.poly([(x-30*k,y-70*k),(x+30*k,y-70*k),(x+22*k,y),(x-22*k,y)],CLAY)
    a.rect((x-33*k,y-76*k,x+33*k,y-65*k),'#d59170',r=4*k)
    a.line([(x,y-76*k),(x,y-177*k)],'#8da77a',5*k)
    for dx,dy,f in [(-25,-135,0),(24,-155,1),(-20,-175,0),(22,-110,1)]:
        a.line([(x,y+dy*k+22*k),(x+dx*k,y+dy*k)],'#8da77a',3*k)
        leaf(a,x+dx*k,y+dy*k,k, bool(f))

def cup(a,x,y,k=1,color=CREAM,lid=False,steam=0):
    # x,y: top-centre of the cup, independent animated prop.
    a.poly([(x-18*k,y),(x+18*k,y),(x+14*k,y+40*k),(x-13*k,y+40*k)],color)
    a.ellipse((x-18*k,y-4*k,x+18*k,y+4*k), '#a77850' if not lid else GREEN)
    a.rect((x-15*k,y+15*k,x+15*k,y+27*k),GREEN,r=2*k)
    if k>.8:a.text((x,y+16*k),'E',12*k,WHITE,'serif','mt')
    if steam:
        for i in (-1,1):
            offset=math.sin(steam*2+i)*4*k
            a.curve([(x+i*5*k,y-9*k),(x+(i*5+offset)*k,y-23*k),(x+(i*5-offset)*k,y-29*k),(x+i*5*k,y-40*k)],'#b7c5ad',2*k)

def spark(a,x,y,k=1,color=GOLD):
    a.poly([(x,y-12*k),(x+3*k,y-3*k),(x+12*k,y),(x+3*k,y+3*k),(x,y+12*k),(x-3*k,y+3*k),(x-12*k,y),(x-3*k,y-3*k)],color)

def character(a,cx,ground,k=1,kind='camille',pose='idle',t=0,phase=0):
    # Jointed arms, head movement and blinking keep the character alive between actions.
    male=kind!='camille'; guest=kind=='guest'; bob=math.sin(t*2.2+phase)*1.8
    skin='#edb491' if not guest else '#b57e5b'; skinshade='#dc9c7a' if not guest else '#a16d4d'
    hair='#65483c' if not male else ('#343b32' if guest else '#3a302a')
    shirt=CLAY if not male else ('#899b77' if guest else '#eee8d6')
    def p(x,y):return (cx+x*k,ground+y*k)
    def box(x1,y1,x2,y2):return (*p(x1,y1),*p(x2,y2))
    def line(pts,col,w):a.line([p(x,y) for x,y in pts],col,w*k)
    a.ellipse(box(-57,-7,59,10),'#d2ddc7')
    # Trousers and shoes.
    line([(-17,-137),(-20,-73),(-25,-12)],'#586b59',23)
    line([(17,-137),(22,-76),(30,-12)],'#465c4c',23)
    a.ellipse(box(-47,-15,-11,1),DARK);a.ellipse(box(17,-15,55,1),DARK)
    # Hair behind face; a bob for Camille, short hair for the barista.
    hy=-293+bob
    if not male:
        a.ellipse(box(-49,hy-57,49,hy+69),hair)
        a.rect(box(-47,hy+6,47,hy+73),hair,r=18*k)
    left=[(-38,-221),(-63,-183),(-60,-147)]
    right=[(38,-221),(64,-183),(60,-147)]
    if pose=='wave': right=[(38,-218),(67,-244),(82+8*math.sin(t*3),-296)]
    elif pose=='point':right=[(38,-216),(83,-221),(123,-241+3*math.sin(t*2))]
    elif pose=='hold':right=[(38,-217),(68,-177),(103,-190)]
    elif pose=='phone':right=[(38,-217),(68,-187),(77,-239)]
    elif pose=='serve':right=[(38,-213),(83,-199),(118+26*math.sin(t*1.5),-211)]
    elif pose=='carry':left=[(-38,-220),(-68,-170),(-26,-168)];right=[(38,-220),(68,-170),(26,-168)]
    for arm in (left,right):
        line(arm,skin,14)
        x,y=arm[-1];a.ellipse(box(x-9,y-9,x+9,y+9),skin)
    a.poly([p(-38,-226),p(-47,-207),p(-31,-136),p(33,-136),p(47,-207),p(35,-226)],shirt)
    a.ellipse(box(-44,-226,-22,-200),shirt);a.ellipse(box(22,-226,44,-200),shirt)
    a.rect(box(-14,-251,14,-218),skin,r=8*k)
    a.ellipse(box(-15,-242,15,-220),skinshade)
    # Face and ears.
    a.ellipse(box(-50,hy-4,-30,hy+17),skin)
    a.ellipse(box(30,hy-4,50,hy+17),skin)
    a.ellipse(box(-39,hy-46,39,hy+48),skin)
    if male:
        a.ellipse(box(-44,hy-59,40,hy-14),hair)
        a.poly([p(-36,hy-18),p(-38,hy-45),p(-8,hy-67),p(11,hy-54),p(37,hy-58),p(42,hy-22),p(29,hy-13),p(27,hy-38),p(4,hy-23),p(-17,hy-25)],hair)
        a.rect(box(-42,hy-25,-33,hy+5),hair,r=4*k)
        a.rect(box(33,hy-25,41,hy+5),hair,r=4*k)
    else:
        a.poly([p(-41,hy+1),p(-44,hy-36),p(-26,hy-59),p(12,hy-56),p(37,hy-37),p(31,hy-19),p(16,hy-38),p(-4,hy-24),p(-26,hy-15),p(-31,hy+8)],hair)
        a.ellipse(box(32,hy-13,39,hy+16),hair)
        a.ellipse(box(-39,hy+5,-31,hy+13),GOLD)
        a.ellipse(box(31,hy+5,39,hy+13),GOLD)
    blink=(t+phase)%4.4<.13
    for x in (-14,14):
        a.arc(box(x-7,hy-12,x+7,hy-3),205,335,hair,2*k)
        if blink:line([(x-3,hy+2),(x+3,hy+2)],hair,2)
        else:a.ellipse(box(x-3,hy-2,x+3,hy+7),DARK)
    a.line([p(-1,hy+9),p(-3,hy+18),p(3,hy+18)],skinshade,2*k)
    a.ellipse(box(-27,hy+15,-14,hy+22),'#e99d87' if not guest else '#bc8463')
    a.ellipse(box(14,hy+15,27,hy+22),'#e99d87' if not guest else '#bc8463')
    a.arc(box(-13,hy+12,13,hy+35),5,175,'#914e3e',2.5*k)
    if not male:
        a.line([p(-24,-225),p(0,-211),p(23,-225)],'#a66349',2*k)
        a.line([p(-28,-143),p(30,-143)],'#9a674f',3*k)
    if male and not guest:
        a.poly([p(-22,-218),p(21,-218),p(33,-141),p(-32,-141)],GREEN)
        line([(-17,-238),(-20,-218)],GREEN,4);line([(17,-238),(20,-218)],GREEN,4)
        a.text(p(0,-190),'EYWA',13*k,CREAM,'serif','mt')
        a.rect(box(-18,-164,18,-151),'#49614c',r=2*k)
    if pose=='hold':cup(a,*p(103,-222),k,color=WHITE,steam=t+.2)
    if pose=='phone':
        a.rect(box(62,-272,91,-222),GREEN,r=5*k)
        a.rect(box(65,-266,88,-229),CREAM,r=2*k)
        a.line([p(68,-249),p(73,-244),p(83,-256)],'#7f9b68',2*k)
    return p(*right[-1])

def coffee_bar(a,x,y,w=610,t=0,closed=False):
    # x,y: top left of countertop; draw after the barista so the counter occludes legs.
    h=167
    a.ellipse((x+7,y+h-3,x+w-7,y+h+20),'#d0dac5')
    for dx in (58,w-58):
        a.ellipse((x+dx-12,y+h-2,x+dx+12,y+h+22),DARK)
        a.ellipse((x+dx-5,y+h+5,x+dx+5,y+h+15),'#718471')
    a.rect((x+12,y+8,x+w-12,y+h),GREEN,r=8)
    a.rect((x+31,y+30,x+w-31,y+h-17),'#2d4836',r=3)
    for dx in range(65,int(w-20),40):a.line([(x+dx,y+33),(x+dx,y+h-19)],'#35513d',1)
    a.rect((x,y-3,x+w,y+14),'#c89e6e',r=6)
    a.rect((x+4,y+10,x+w-4,y+16),'#b7895d',r=2)
    a.text((x+w/2,y+50),'E Y W A',40,CREAM,'serif','mt')
    a.text((x+w/2,y+105),'COFFEE CATERING',12,'#d3dfc6','regular','mt')
    if closed:return
    # Espresso machine.
    mx=x+77;my=y-98
    a.rect((mx,my,mx+167,y-4),'#e3dfcf',r=12)
    a.rect((mx+13,my+16,mx+154,my+38),GREEN,r=4)
    for dx in (30,56,82):a.ellipse((mx+dx,my+22,mx+dx+9,my+30),GOLD)
    a.rect((mx+11,my+59,mx+156,y-13),'#b8bdaa',r=3)
    for dx in (45,117):
        a.line([(mx+dx,my+44),(mx+dx,my+60)],'#7b8c78',7)
        a.line([(mx+dx,my+50),(mx+dx+22,my+50)],DARK,5)
    cup(a,mx+105,y-36,.72,WHITE,steam=t+.1)
    a.rect((mx-8,y-10,mx+177,y-3),'#7e8e79',r=2)
    # Grinder and beans.
    gx=x+w-150
    a.rect((gx,y-68,gx+42,y-4),DARK,r=5)
    a.poly([(gx-7,y-116),(gx+49,y-116),(gx+38,y-69),(gx+3,y-69)],'#bdc6b1')
    a.poly([(gx-2,y-108),(gx+44,y-108),(gx+35,y-75),(gx+6,y-75)],'#745138')
    a.rect((gx-9,y-122,gx+50,y-113),GREEN,r=4)
    for dx in (5,20,31):a.ellipse((gx+dx,y-104,gx+dx+9,y-97),'#533b2a')
    # Stack of cups.
    for n in range(3):cup(a,x+w-55,y-52+n*9,.75,WHITE)
    a.rect((x+w/2-22,y-65,x+w/2+22,y-4),CREAM,r=3)
    a.text((x+w/2,y-53),'MENU',10,GREEN,'bold','mt')
    for n in range(3):a.line([(x+w/2-11,y-30+n*6),(x+w/2+11,y-30+n*6)],MOSS,2)

def room(a,t,bg=CREAM):
    a.rect((0,0,W,H),bg)
    a.ellipse((-180,-145,320,350),'#f1eee1' if bg==CREAM else '#dce6d2')
    a.ellipse((1085,340,1510,870),'#eef0e1' if bg==CREAM else '#dce6d2')
    a.line([(65,618),(1215,618)],'#d3dcc8',2)
    a.text((1178,30),'EYWA',18,GREEN,'serif','rt')

def heading(a,title,sub=None,t=2):
    y=80+18*(1-enter(t))
    a.text((640,y),title,46,GREEN,'serif','mt')
    if sub:a.text((640,y+66),sub,22,'#64765b','regular','mt')

def pointer(a,x,y,t):
    a.poly([(x,y),(x+4,y+32),(x+13,y+23),(x+26,y+20)],GREEN)
    a.line([(x+12,y+22),(x+20,y+37)],GREEN,5)
    r=19+6*math.sin(t*5)
    if math.sin(t*5)>.1:a.ellipse((x-r,y-r,x+r,y+r),None,'#9cab85',2)

@lru_cache(maxsize=10)
def screen_asset(name):
    im=Image.open(ROOT/'video-source/screens'/name).convert('RGB')
    crop=(375,168,905,735) if name!='reservation.png' else (364,135,916,677)
    return im.crop(crop)

def monitor(a,x,y,w,h,screen,t,highlight=False):
    # Familiar site screen, integrated into an illustrated desktop computer.
    a.ellipse((x+w*.13,y+h+60,x+w*.87,y+h+81),'#cbd7bf')
    a.poly([(x+w*.45,y+h-3),(x+w*.55,y+h-3),(x+w*.58,y+h+60),(x+w*.42,y+h+60)],'#91a180')
    a.rect((x+w*.31,y+h+54,x+w*.69,y+h+66),'#677f5c',r=7)
    a.rect((x,y,x+w,y+h),DARK,r=19)
    a.rect((x+13,y+13,x+w-13,y+h-28),WHITE,r=9)
    a.rect((x+13,y+13,x+w-13,y+45),'#e2e9da',r=7)
    for dx in (29,43,57):a.ellipse((x+dx,y+24,x+dx+5,y+29),'#8c9d7d')
    a.text((x+w/2,y+20),'eywacoffeecatering.com',13,GREEN,'regular','mt')
    a.ellipse((x+w/2-4,y+h-17,x+w/2+4,y+h-9),'#809273')
    img=screen_asset(screen); ch=h-83; cw=ch*img.width/img.height
    a.paste(img,(x+(w-cw)/2,y+49,cw,ch))
    if highlight:
        pointer(a,x+w*.70+math.sin(t)*15,y+h*.77,t)

def calendar(a,x,y,k=1,t=0):
    a.rect((x,y,x+120*k,y+115*k),WHITE,r=10*k)
    a.rect((x,y,x+120*k,y+30*k),CLAY,r=10*k)
    a.rect((x,y+16*k,x+120*k,y+31*k),CLAY)
    for dx in (25,91):a.line([(x+dx*k,y-7*k),(x+dx*k,y+10*k)],GREEN,5*k)
    for j in range(2):
        for i in range(3):a.ellipse((x+(22+i*32)*k,y+(48+j*31)*k,x+(30+i*32)*k,y+(56+j*31)*k),'#d4dfc7')
    a.line([(x+53*k,y+78*k),(x+62*k,y+87*k),(x+83*k,y+62*k)],GREEN,5*k)

def envelope(a,x,y,w,h,opening=0):
    a.poly([(x,y),(x+w/2,y-h*.52*opening),(x+w,y)],'#9db78d')
    a.rect((x,y,x+w,y+h),'#c4d4b3',r=7)
    a.poly([(x,y),(x+w/2,y+h*.59),(x+w,y)],'#a8c096')
    a.poly([(x,y+h),(x+w*.43,y+h*.43),(x+w*.57,y+h*.43),(x+w,y+h)],'#b7cca5')

def van(a,x,y,k=1,t=0):
    def b(x1,y1,x2,y2):return (x+x1*k,y+y1*k,x+x2*k,y+y2*k)
    a.ellipse(b(6,133,358,166),'#c9d6bc')
    a.rect(b(0,-1,241,135),GREEN,r=14*k)
    a.poly([(x+236*k,y+29*k),(x+300*k,y+29*k),(x+350*k,y+81*k),(x+350*k,y+135*k),(x+231*k,y+135*k)],'#36553d')
    a.poly([(x+249*k,y+43*k),(x+294*k,y+43*k),(x+327*k,y+80*k),(x+249*k,y+80*k)],'#dcebd9')
    a.rect(b(243,95,258,102),CREAM,r=3*k)
    a.rect(b(338,95,354,108),GOLD,r=2*k)
    a.rect(b(-4,123,357,137),'#546d4c',r=4*k)
    for dx in (67,286):
        a.ellipse(b(dx-28,109,dx+28,164),DARK)
        a.ellipse(b(dx-13,124,dx+13,150),'#c5d2b7')
        ang=t*4
        a.line([(x+dx*k,y+137*k),(x+(dx+9*math.cos(ang))*k,y+(137+9*math.sin(ang))*k)],'#809673',3*k)
    a.text((x+120*k,y+38*k),'EYWA',36*k,CREAM,'serif','mt')
    a.text((x+120*k,y+85*k),'LE COFFEE BAR MOBILE',9*k,CREAM,'regular','mt')

# Seven scenes tell one story, with actor poses and prop motions driven by time.
def draw_scene(scene,t,duration):
    a=Art();p=t/duration; kind=scene['id'];room(a,t, SAGE if kind in ('devis','confirmation') else CREAM)
    if kind=='camille':
        a.text((88,108),'Voici Camille.',51,GREEN,'serif')
        a.text((88,182),'Elle prépare son événement.',31,GREEN,'serif')
        a.text((89,238),'Et imagine une belle pause café.',22,'#68765e')
        # A decorated event table introduces the occasion.
        a.line([(85,360),(465,360)],'#b4c5a2',2)
        for i in range(7):
            x=100+i*50
            a.poly([(x,362),(x+32,362),(x+16,390)],GOLD if i%2 else MOSS)
        a.ellipse((133,545,435,574),'#dce4d0')
        a.line([(197,470),(167,610)],'#b89a6d',9);a.line([(370,470),(400,610)],'#b89a6d',9)
        a.rect((145,448,421,475),'#cda876',r=8)
        cup(a,208,416,.85,WHITE);cup(a,350,416,.85,WHITE)
        a.rect((270,402,297,448),CLAY,r=4)
        a.line([(283,402),(283,372)],'#7c956d',3);leaf(a,291,385,.65)
        cx=945+180*(1-enter(t));character(a,cx,614,1.08,'camille','wave',t)
        v=enter(t,.85);y=198+25*(1-v)
        if v>0:
            a.ellipse((562,y,790,y+181),WHITE)
            a.ellipse((773,y+157,798,y+182),WHITE);a.ellipse((805,y+195,818,y+208),WHITE)
            cup(a,677,y+60,1.5,CREAM,steam=t+.1)
            spark(a,731,y+46,.8);spark(a,619,y+119,.6,MOSS)
        if t>2.2:calendar(a,542,460,.83,t)
        plant(a,1170,612,.85)
    elif kind=='concept':
        heading(a,'Le coffee shop vient à vous.','Un bar. Un barista. Vos boissons préférées.',t)
        shift=600*(1-enter(t,0,.8)); character(a,635+shift,603,1.08,'barista','serve',t)
        coffee_bar(a,324+shift,429,618,t)
        character(a,1088+shift*.2,614,.9,'camille','hold',t,.8)
        for i,(label,color) in enumerate([('Café',CREAM),('Matcha','#cbdda5'),('Latte','#ead6b6')]):
            v=enter(t,.8+i*.3)
            if v:
                x=151-100*(1-v);y=290+i*122+math.sin(t*1.7+i)*3
                a.ellipse((x-45,y-33,x+45,y+56),'#e6ecda')
                cup(a,x,y-11,1.1,color,steam=t+i+.1)
                a.text((x,y+65),label,18,GREEN,'regular','mt')
        spark(a,977,245,1,GOLD)
    elif kind=='devis':
        heading(a,'Votre devis, en quelques clics.',None,t)
        character(a,229-130*(1-enter(t)),613,1.05,'camille','point',t)
        x=436+200*(1-enter(t,.1))
        image='devis.png' if p<.52 else 'options.png'
        monitor(a,x,190,704,346,image,t,True)
        a.text((786,624),'INVITÉS   ·   DURÉE   ·   LIEU   ·   DATE',17,GREEN,'bold','mt')
        if p>.52:
            a.rect((425,527,636,576),GREEN,r=24)
            a.text((530,539),'À votre image',20,WHITE,'regular','mt')
        else:
            a.rect((425,527,636,576),GREEN,r=24)
            a.text((530,539),'Devis gratuit',20,WHITE,'regular','mt')
        plant(a,1203,614,.65)
    elif kind=='reservation':
        heading(a,'Tout se réserve en ligne.','Les détails pratiques, puis le paiement.',t)
        monitor(a,114-240*(1-enter(t)),203,710,337,'reservation.png',t,True)
        character(a,1052+150*(1-enter(t)),613,1.04,'camille','phone',t)
        # A generic payment card is illustrative, without payment-provider branding.
        v=enter(t,2);cy=489+100*(1-v)
        if v:
            a.rect((668,cy,918,cy+132),GREEN,r=13)
            a.rect((693,cy+23,730,cy+51),GOLD,r=5)
            for i in range(4):a.text((694+i*48,cy+72),'••••',16,CREAM)
            a.ellipse((864,cy+16,896,cy+48),'#87a372')
            a.line([(872,cy+32),(879,cy+39),(889,cy+26)],WHITE,3)
        plant(a,69,612,.58)
    elif kind=='confirmation':
        heading(a,'Une confirmation. Un vrai suivi.',None,t)
        # The envelope arrives and its message rises into view.
        y=413;v=enter(t,.25,1)
        envelope(a,178,y,474,175,v)
        card_y=365-168*v
        a.rect((222,card_y,608,card_y+324),WHITE,r=10)
        a.text((255,card_y+25),'EYWA',27,GREEN,'serif')
        a.text((255,card_y+79),'Votre coffee bar',25,GREEN,'serif')
        a.text((255,card_y+114),'est réservé.',25,GREEN,'serif')
        for n,w in enumerate((239,195,217)):
            a.rect((255,card_y+176+n*24,255+w,card_y+182+n*24),'#d8e2cf',r=3)
        a.ellipse((529,card_y+28,577,card_y+76),GREEN)
        a.line([(541,card_y+51),(551,card_y+61),(566,card_y+42)],WHITE,4)
        # Foreground flap conceals the lower end of the letter.
        a.poly([(178,y+175),(363,y+71),(462,y+71),(652,y+175)],'#b9cca9')
        a.text((415,613),'Exemple de confirmation',16,'#6e7e62','regular','mt')
        character(a,1006,614,1.03,'camille','phone',t)
        if t>3:
            bx=722;by=244+math.sin(t)*4
            a.rect((bx,by,bx+160,by+87),WHITE,r=22)
            a.poly([(bx+114,by+78),(bx+145,by+106),(bx+145,by+76)],WHITE)
            for i in range(3):a.ellipse((bx+43+i*29,by+36,bx+54+i*29,by+47),MOSS)
            a.text((796,by+127),'Un échange si besoin',17,GREEN,'regular','mt')
    elif kind=='jour-j':
        heading(a,'Et le jour J ? On est là.',None,t)
        if p<.41:
            a.rect((882,236,1143,616),'#e6e8d8',r=70)
            a.rect((927,340,1100,616),CREAM,r=70)
            a.line([(873,616),(1168,616)],'#b3c4a1',3)
            calendar(a,998,160,.9,t)
            x=mix(-430,374,ease(p/.27))
            van(a,x,391,1.28,t)
            a.text((645,590),'Nous arrivons en avance.',22,GREEN,'regular','mt')
            plant(a,110,612,.72)
        else:
            u=enter(t,duration*.41,.65);shift=330*(1-u)
            character(a,594+shift,602,1.04,'barista','serve',t)
            coffee_bar(a,283+shift,428,624,t)
            character(a,1000+shift,614,.9,'camille','hold',t,.6)
            character(a,1164+shift,616,.86,'guest','hold',t,1.4)
            cup(a,764+28*math.sin(t*1.5),385,.85,WHITE,steam=t+.1)
            plant(a,121,612,.83)
    elif kind=='profitez':
        end=enter(t,duration*.49,1)
        if end<1:
            heading(a,'Camille profite de ses invités.',None,t)
            character(a,369,615,1.04,'camille','hold',t)
            character(a,562,615,.97,'guest','hold',t,.7)
            a.rect((213,495,677,512),'#cda876',r=9)
            a.line([(268,512),(246,612)],'#b18d5f',9);a.line([(626,512),(647,612)],'#b18d5f',9)
            shift=460*ease(p/.52)
            van(a,840+shift,475,.8,t)
            a.text((920,352),'On range,',25,GREEN,'serif','mt')
            a.text((920,390),'vous profitez.',25,GREEN,'serif','mt')
            plant(a,90,612,.8)
        if end>0:
            b=Art(CREAM);room(b,t)
            b.text((640,116),'E Y W A',84,GREEN,'serif','mt')
            b.text((640,229),'Du premier clic au dernier café.',35,GREEN,'serif','mt')
            character(b,305,628,.86,'camille','wave',t)
            character(b,969,627,.86,'barista','wave',t,.8)
            coffee_bar(b,438,445,403,t)
            b.rect((460,326,823,388),GREEN,r=6)
            b.text((642,342),'Imaginez votre événement',23,CREAM,'regular','mt')
            b.text((642,648),'eywacoffeecatering.com',19,GREEN,'regular','mt')
            spark(b,371,305,.85);spark(b,918,298,.75)
            a.im=Image.blend(a.im,b.im,end)
    return a.finish()

def poster(total):
    a=Art(SAGE);room(a,2,SAGE)
    a.text((78,96),'LE PETIT FILM EYWA',17,GREEN,'bold')
    a.text((76,160),'Comment',61,GREEN,'serif')
    a.text((76,234),'ça marche ?',61,GREEN,'serif')
    a.text((80,337),'Suivez Camille, du premier clic',23,'#617455')
    a.text((80,376),'au dernier café.',23,'#617455')
    a.rect((80,462,397,532),GREEN,r=6)
    a.poly([(109,484),(109,513),(132,498)],CREAM)
    a.text((155,480),f'Voir le film · {round(total)} s',22,CREAM)
    character(a,720,623,1.15,'camille','wave',2)
    character(a,1067,619,1.03,'barista','hold',2)
    cup(a,931,327,1.6,WHITE,steam=2.2)
    a.ellipse((876,307,882,313),GOLD);spark(a,972,277,.9)
    a.line([(678,103),(1135,103)],'#b2c5a0',2)
    for i in range(8):
        x=690+i*54;a.poly([(x,105),(x+35,105),(x+17,140)],GOLD if i%2 else '#b7cba2')
    return a.finish()

def run(args):
    result=subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError(result.stderr.decode(errors='replace')[-2000:])
def stamp(v):
    ms=round(v*1000);h,ms=divmod(ms,3600000);m,ms=divmod(ms,60000);s,ms=divmod(ms,1000)
    return f'{h:02}:{m:02}:{s:02}.{ms:03}'

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--voice-dir',type=Path);parser.add_argument('--preview',action='store_true');args=parser.parse_args()
    if args.preview:
        dest=Path('/private/tmp/eywa-animation-preview');dest.mkdir(exist_ok=True)
        for scene in SCENES:
            draw_scene(scene,5.2,9).save(dest/(scene['id']+'.png'))
        poster(60).save(dest/'poster.png')
        print(dest);return
    ffmpeg=os.environ.get('FFMPEG_BINARY') or shutil.which('ffmpeg')
    if not ffmpeg:raise SystemExit('Set FFMPEG_BINARY to an installed FFmpeg executable.')
    temp=Path(tempfile.mkdtemp(prefix='eywa-animation-')); voices=args.voice_dir or temp
    if not args.voice_dir:
        for scene in SCENES:
            txt=temp/(scene['id']+'.txt');txt.write_text(scene['text'])
            run(['say','-v','Thomas','-r','151','-f',str(txt),'-o',str(temp/(scene['id']+'.aiff'))])
    durations=[];audiofiles=[]
    for i,scene in enumerate(SCENES):
        output=temp/(scene['id']+'.wav')
        run([ffmpeg,'-y','-i',str(voices/(scene['id']+'.aiff')),'-ar','44100','-ac','1',str(output)])
        with wave.open(str(output)) as wav: duration=wav.getnframes()/wav.getframerate()
        if duration<1:raise SystemExit('Narration missing: '+scene['id'])
        duration+=.6 if i<6 else 1.1
        durations.append(math.ceil(duration*FPS)/FPS);audiofiles.append(output)
    combined=temp/'narration.wav'
    with wave.open(str(combined),'wb') as wav:
        wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(44100)
        for duration,source in zip(durations,audiofiles):
            with wave.open(str(source)) as f:samples=f.readframes(f.getnframes())
            lead=b'\x00'*(2*round(.18*44100));trail=b'\x00'*(2*round(duration*44100)-len(samples)-len(lead))
            wav.writeframes(lead+samples+trail)
    total=sum(durations);print(f'Duration: {total:.2f}s',flush=True)
    vtt=['WEBVTT',''];offset=0
    for scene,duration in zip(SCENES,durations):
        chunks=[s.strip() for s in re.split(r'(?<=[.!?])\s+',scene['text']) if s.strip()]
        words=sum(len(c.split()) for c in chunks);start=offset+.18
        for c in chunks:
            length=(duration-.7)*len(c.split())/words
            vtt.extend([f'{stamp(start)} --> {stamp(start+length)}',c,'']);start+=length
        offset+=duration
    video=temp/'silent.mp4'
    log=(temp/'ffmpeg.log').open('w')
    process=subprocess.Popen([ffmpeg,'-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p',str(video)],stdin=subprocess.PIPE,stderr=log)
    try:
        prev=None
        for i,(scene,duration) in enumerate(zip(SCENES,durations)):
            for f in range(round(duration*FPS)):
                t=f/FPS;im=draw_scene(scene,t,duration)
                # A fast horizontal transition connects the story's scenes.
                if prev is not None and t<.32:
                    u=ease(t/.32);x=round(W*u);out=Image.new('RGB',(W,H),CREAM)
                    out.paste(prev,(-x,0));out.paste(im,(W-x,0));im=out
                process.stdin.write(im.tobytes())
            prev=im
            print('Rendered '+scene['id'],flush=True)
    finally:process.stdin.close()
    if process.wait()!=0:raise SystemExit('Video encoder failed; see '+str(temp/'ffmpeg.log'))
    result=temp/'eywa-animation.mp4'
    run([ffmpeg,'-y','-i',str(video),'-i',str(combined),'-c:v','copy','-c:a','aac','-af','volume=-2dB','-b:a','128k','-movflags','+faststart','-shortest',str(result)])
    OUT.mkdir(exist_ok=True,parents=True)
    shutil.copy2(result,OUT/'eywa-parcours.mp4')
    poster(total).save(OUT/'eywa-parcours-poster.jpg',quality=94)
    (OUT/'eywa-parcours.fr.vtt').write_text('\n'.join(vtt))
    (OUT/'eywa-parcours-meta.json').write_text(json.dumps({'duration':total,'version':'Animation 2D — Camille','chapters':[{'id':s['id'],'duration':d} for s,d in zip(SCENES,durations)],'voice':'Thomas — synthèse macOS','status':'Confirmation automatique illustrative, à valider avant diffusion'},ensure_ascii=False,indent=2))
    page=ROOT/'index.html';content=page.read_text()
    transcript=''.join('<p><strong>'+html.escape(s['label'])+'.</strong> '+html.escape(s['text'])+'</p>' for s in SCENES)
    content=re.sub(r'(<div id="film-transcript-body">).*?(</div>)',lambda m:m[1]+transcript+m[2],content,flags=re.S)
    version=hashlib.sha256((OUT/'eywa-parcours.mp4').read_bytes()).hexdigest()[:10]
    content=re.sub(r'(assets/video/eywa-parcours(?:-poster\.jpg|\.mp4|\.fr\.vtt))(?:\?v=[^"\s<>]+)?',lambda m:m[1]+'?v='+version,content)
    content=re.sub(r'(<p class="film-caption" id="film-caption">).*?(</p>)',lambda m:m[1]+f'Un dessin animé de {round(total)} secondes, du premier clic au jour J. Voix de synthèse française.'+m[2],content)
    page.write_text(content)
    print('Ready: '+str(OUT/'eywa-parcours.mp4'),flush=True)
if __name__=='__main__':main()
