# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont
import os
import math
import random

WIDTH = 1080
HEIGHT = 1080
FPS = 24
DURATION = 6
TOTAL = FPS * DURATION

BG = (10, 10, 10)
GREEN = (0, 200, 5)
GOLD = (255, 215, 0)
WHITE = (255, 255, 255)

OUT = r"C:\Users\lanqi\powerball-lottery\video_frames"
os.makedirs(OUT, exist_ok=True)

def font(s):
    try:
        return ImageFont.truetype("arial.ttf", s)
    except:
        return ImageFont.load_default()

def ball(d, x, y, r, n, c=GREEN, g=False):
    if g:
        for i in range(12, 0, -3):
            d.ellipse([x-r-i, y-r-i, x+r+i, y+r+i], outline=c, width=2)
    d.ellipse([x-r, y-r, x+r, y+r], fill=c)
    hr = int(r * 0.2)
    d.ellipse([x-r//2, y-r//2, x-r//2+hr, y-r//2+hr], 
              fill=(min(255,c[0]+60), min(255,c[1]+60), min(255,c[2]+60)))
    f = font(int(r * 0.65))
    t = str(n)
    bb = d.textbbox((0, 0), t, font=f)
    d.text((x - (bb[2]-bb[0])//2, y - (bb[3]-bb[1])//2 - 2), t, fill=WHITE, font=f)

print(f"Creating {TOTAL} frames...")
paths = []

for fr in range(TOTAL):
    if fr % 24 == 0:
        print(f"  {fr}/{TOTAL}")
    
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    d = ImageDraw.Draw(img)
    
    p = fr / TOTAL
    
    # Grid
    for i in range(0, WIDTH, 50):
        d.line([(i, 0), (i, HEIGHT)], fill=(0, 35, 0))
        d.line([(0, i), (WIDTH, i)], fill=(0, 35, 0))
    
    # Sparkles
    random.seed(fr // 3)
    for _ in range(15):
        sx, sy = random.randint(0, WIDTH), random.randint(0, HEIGHT)
        d.ellipse([sx-2, sy-2, sx+2, sy+2], fill=(random.randint(150,255), random.randint(150,255), 50))
    
    if p < 0.25:  # Title
        a = p / 0.25
        f1 = font(85)
        f2 = font(26)
        cv = int(200 * a)
        d.text((WIDTH//2 - 150, HEIGHT//2 - 70), "BALLS", fill=(0, cv, 0), font=f1)
        d.text((WIDTH//2 - 190, HEIGHT//2 + 35), "Auto-Lottery on Robinhood", fill=(70, 70, 70), font=f2)
    
    elif p < 0.65:  # Spin
        a = (p - 0.25) / 0.4
        nums = [7, 21, 33, 42, 50]
        cy = HEIGHT // 2
        for i in range(5):
            bx = WIDTH//2 - 280 + i * 140
            by = cy + int(math.sin(fr * 0.35 + i) * 12)
            n = nums[i] if a > 0.75 else random.randint(1, 50)
            ball(d, bx, by, 52, n, glow=(a > 0.5))
        
        f = font(34)
        dots = "." * (fr // 5 % 4)
        d.text((WIDTH//2 - 70, HEIGHT - 130), f"Drawing{dots}", fill=GOLD, font=f)
    
    elif p < 0.83:  # Winner
        nums = [7, 21, 33, 42, 50]
        cy = HEIGHT // 2
        for i in range(5):
            bx = WIDTH//2 - 280 + i * 140
            if i == 2:
                sc = 1 + math.sin(fr * 0.5) * 0.07
                ball(d, bx, cy, int(58 * sc), nums[i], c=GOLD, g=True)
            else:
                ball(d, bx, cy, 58, nums[i], g=True)
        
        f = font(50)
        if (fr // 4) % 2 == 0:
            d.text((WIDTH//2 - 80, HEIGHT - 150), "WINNER!", fill=GOLD, font=f)
    
    else:  # CTA
        f1, f2, f3 = font(44), font(30), font(24)
        d.text((WIDTH//2 - 240, HEIGHT//2 - 90), "Win ETH Every Minute", fill=GREEN, font=f1)
        d.text((WIDTH//2 - 165, HEIGHT//2 - 25), "Hold BALLS. Get Paid.", fill=WHITE, font=f2)
        d.text((WIDTH//2 - 115, HEIGHT//2 + 45), "Top 200 Holders", fill=(110,110,110), font=f3)
        d.text((WIDTH//2 - 115, HEIGHT//2 + 75), "3% Tax = Prize Pool", fill=(110,110,110), font=f3)
        d.text((WIDTH//2 - 115, HEIGHT//2 + 105), "Auto ETH Payouts", fill=(110,110,110), font=f3)
        d.text((WIDTH//2 - 100, HEIGHT - 100), "@ballsonrobin", fill=GREEN, font=f2)
    
    path = os.path.join(OUT, f"f_{fr:04d}.png")
    img.save(path)
    paths.append(path)

print("All frames done!")

# Make video
vid = r"C:\Users\lanqi\powerball-lottery\balls_promo.mp4"
try:
    from moviepy.editor import ImageSequenceClip
    print("Making video...")
    clip = ImageSequenceClip(paths, fps=FPS)
    clip.write_videofile(vid, codec="libx264", fps=FPS, logger=None)
    print(f"DONE: {vid}")
except Exception as e:
    print(f"MoviePy err: {e}")
    import subprocess
    cmd = f'ffmpeg -y -framerate {FPS} -i "{OUT}\\f_%04d.png" -c:v libx264 -pix_fmt yuv420p "{vid}"'
    r = subprocess.run(cmd, shell=True, capture_output=True)
    if r.returncode == 0:
        print(f"DONE: {vid}")
    else:
        print(f"Frames ready: {OUT}")
